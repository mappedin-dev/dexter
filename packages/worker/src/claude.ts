import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { Job } from "@dexter/shared";

// ES module equivalent of __dirname
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// MCP config path
const mcpConfigPath = path.join(__dirname, "..", "mcp-config.json");

// Default instructions path (bundled with worker)
const defaultInstructionsPath = path.join(__dirname, "..", "instructions.txt");

// Cache for instructions loaded from URL
let cachedInstructions: string | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL_MS = 60_000; // 1 minute cache TTL

/**
 * Load instructions template from configured source.
 * Priority:
 * 1. INSTRUCTIONS_URL - fetch from remote URL (cached for 1 minute)
 * 2. INSTRUCTIONS_PATH - read from custom file path
 * 3. Default bundled instructions.txt
 */
async function loadInstructions(): Promise<string> {
  const instructionsUrl = process.env.INSTRUCTIONS_URL;
  const instructionsPath = process.env.INSTRUCTIONS_PATH;

  // Option 1: Load from URL
  if (instructionsUrl) {
    const now = Date.now();
    if (cachedInstructions && now - cacheTimestamp < CACHE_TTL_MS) {
      return cachedInstructions;
    }

    try {
      console.log(`Fetching instructions from URL: ${instructionsUrl}`);
      const response = await fetch(instructionsUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      cachedInstructions = await response.text();
      cacheTimestamp = now;
      return cachedInstructions;
    } catch (error) {
      console.error(`Failed to fetch instructions from URL: ${error}`);
      // Fall back to cached version if available
      if (cachedInstructions) {
        console.log("Using cached instructions as fallback");
        return cachedInstructions;
      }
      // Fall back to default
      console.log("Falling back to default instructions");
    }
  }

  // Option 2: Load from custom file path
  if (instructionsPath) {
    try {
      console.log(`Loading instructions from path: ${instructionsPath}`);
      return fs.readFileSync(instructionsPath, "utf-8");
    } catch (error) {
      console.error(`Failed to read instructions from path: ${error}`);
      console.log("Falling back to default instructions");
    }
  }

  // Option 3: Load from default bundled file
  return fs.readFileSync(defaultInstructionsPath, "utf-8");
}

/**
 * Build the prompt for Claude Code CLI
 */
async function buildPrompt(job: Job): Promise<string> {
  const instructionsTemplate = await loadInstructions();
  return instructionsTemplate
    .replace(/\{\{issueKey\}\}/g, job.issueKey)
    .replace(/\{\{triggeredBy\}\}/g, job.triggeredBy)
    .replace(/\{\{instruction\}\}/g, job.instruction)
    .replace(/\{\{timestamp\}\}/g, String(Date.now()))
    .trim();
}

/**
 * Invoke Claude Code CLI to process a job
 */
export async function invokeClaudeCode(
  job: Job,
  workDir: string
): Promise<{ success: boolean; output: string; error?: string }> {
  const prompt = await buildPrompt(job);

  return new Promise((resolve) => {
    // Pass prompt as argument (prompt must come right after --print)
    // --dangerously-skip-permissions is required for non-interactive/automated usage
    // to allow MCP tools without interactive permission prompts
    const args = [
      "--print",
      prompt,
      "--mcp-config",
      mcpConfigPath,
      "--dangerously-skip-permissions",
    ];

    // Add model if specified via environment variable
    if (process.env.CLAUDE_MODEL) {
      args.push("--model", process.env.CLAUDE_MODEL);
    }

    console.log(`Invoking Claude Code CLI for ${job.issueKey}...`);

    const proc = spawn("claude", args, {
      cwd: workDir,
      env: {
        ...process.env,
        // MCP config will be loaded from mcp-config.json
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      const text = data.toString();
      stdout += text;
      process.stdout.write(text);
    });

    proc.stderr.on("data", (data) => {
      const text = data.toString();
      stderr += text;
      process.stderr.write(text);
    });

    proc.on("close", (code) => {
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
        output: stdout,
        error: `Failed to spawn process: ${err.message}`,
      });
    });
  });
}
