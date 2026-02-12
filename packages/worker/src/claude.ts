import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import type { Job } from "@mapthew/shared/types";
import { getClaudeModel } from "@mapthew/shared/config";
import { buildPrompt } from "./prompt.js";
import { getReadableId } from "./utils.js";

// ES module equivalent of __dirname
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// MCP config path
const mcpConfigPath = path.join(__dirname, "..", "mcp-config.json");

/** Default max buffer size: 10 MB */
const DEFAULT_MAX_BUFFER_BYTES = 10 * 1024 * 1024;

/**
 * A buffer that retains only the most recent `maxBytes` of appended text.
 * When the limit is exceeded, older content is discarded (tail approach).
 */
export class BoundedBuffer {
  private buf = "";
  private _truncated = false;
  readonly maxBytes: number;

  constructor(maxBytes: number) {
    this.maxBytes = maxBytes;
  }

  /** Append text, discarding oldest content if the limit would be exceeded. */
  append(text: string): void {
    this.buf += text;
    if (this.buf.length > this.maxBytes) {
      this.buf = this.buf.slice(-this.maxBytes);
      this._truncated = true;
    }
  }

  /** Whether older content has been discarded at least once. */
  get truncated(): boolean {
    return this._truncated;
  }

  /** Return the current buffer contents. */
  toString(): string {
    return this.buf;
  }
}

/** Read max buffer size from the environment (bytes). */
export function getMaxBufferBytes(): number {
  const env = process.env.MAX_OUTPUT_BUFFER_BYTES;
  if (env) {
    const parsed = parseInt(env, 10);
    if (!Number.isNaN(parsed) && parsed > 0) return parsed;
  }
  return DEFAULT_MAX_BUFFER_BYTES;
}

/**
 * Options for invoking Claude Code CLI
 */
export interface InvokeOptions {
  /** Whether to resume an existing session */
  hasSession?: boolean;
}

/**
 * Invoke Claude Code CLI to process a job
 *
 * @param job - The job to process
 * @param workDir - The working directory for Claude
 * @param options - Optional settings (e.g., session resume)
 */
export async function invokeClaudeCode(
  job: Job,
  workDir: string,
  options: InvokeOptions = {},
): Promise<{ success: boolean; output: string; error?: string }> {
  const { hasSession = false } = options;
  const prompt = buildPrompt(job);
  const model = await getClaudeModel();
  const maxBytes = getMaxBufferBytes();

  return new Promise((resolve) => {
    // Build args based on whether we're resuming a session
    const args: string[] = [];

    if (hasSession) {
      // Resume existing session with new prompt
      // --continue resumes the most recent conversation in this directory
      args.push("--continue", "--print", prompt);
      console.log(
        `[Session] Resuming existing session for ${getReadableId(job)}`,
      );
    } else {
      // Start new session
      args.push("--print", prompt);
      console.log(`[Session] Starting new session for ${getReadableId(job)}`);
    }

    // Common args
    args.push(
      "--mcp-config",
      mcpConfigPath,
      "--dangerously-skip-permissions",
      "--model",
      model,
    );

    console.log(
      `Invoking Claude Code CLI for ${getReadableId(job)} with model ${model}...`,
    );

    const proc = spawn("claude", args, {
      cwd: workDir,
      env: {
        ...process.env,
        // MCP config will be loaded from mcp-config.json
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    const stdoutBuf = new BoundedBuffer(maxBytes);
    const stderrBuf = new BoundedBuffer(maxBytes);
    let stdoutWarned = false;
    let stderrWarned = false;

    proc.stdout.on("data", (data) => {
      const text = data.toString();
      stdoutBuf.append(text);
      process.stdout.write(text);
      if (stdoutBuf.truncated && !stdoutWarned) {
        stdoutWarned = true;
        console.warn(
          `[Buffer] stdout buffer limit reached (${maxBytes} bytes) for ${getReadableId(job)} — older output truncated`,
        );
      }
    });

    proc.stderr.on("data", (data) => {
      const text = data.toString();
      stderrBuf.append(text);
      process.stderr.write(text);
      if (stderrBuf.truncated && !stderrWarned) {
        stderrWarned = true;
        console.warn(
          `[Buffer] stderr buffer limit reached (${maxBytes} bytes) for ${getReadableId(job)} — older output truncated`,
        );
      }
    });

    proc.on("close", (code) => {
      const stdout = stdoutBuf.toString();
      const stderr = stderrBuf.toString();

      if (code === 0) {
        resolve({ success: true, output: stdout });
      } else {
        resolve({
          success: false,
          output: stdout,
          error: stderr || `Process exited with code ${code}`,
        });
      }
    });

    proc.on("error", (err) => {
      resolve({
        success: false,
        output: stdoutBuf.toString(),
        error: `Failed to spawn process: ${err.message}`,
      });
    });
  });
}
