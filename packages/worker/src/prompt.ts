import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  type Job,
  isGitHubJob,
  isJiraJob,
  getBotName,
  getBranchPrefix,
} from "@mapthew/shared";

// ES module equivalent of __dirname
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load all instruction markdown files at startup
const instructionsDir = path.join(__dirname, "..", "instructions");

function loadInstructions(): string[] {
  const files = fs.readdirSync(instructionsDir);
  const mdFiles = files.filter((f) => f.endsWith(".md"));

  // Ensure general.md is always first, then sort the rest alphabetically
  const sorted = mdFiles.sort((a, b) => {
    if (a === "general.md") return -1;
    if (b === "general.md") return 1;
    return a.localeCompare(b);
  });

  return sorted.map((file) =>
    fs.readFileSync(path.join(instructionsDir, file), "utf-8")
  );
}

const instructionTemplates = loadInstructions();

/**
 * Build the prompt for Claude Code CLI
 *
 * All instruction files are loaded and concatenated. Job-specific
 * context is injected via template placeholders. Missing values
 * are replaced with "unknown".
 */
export function buildPrompt(job: Job): string {
  // Build job context for template replacement
  const context: Record<string, string> = {
    triggeredBy: job.triggeredBy,
    instruction: job.instruction,
    botName: getBotName(),
    branchPrefix: getBranchPrefix(),
    // GitHub context (defaults to "unknown")
    "github.owner": isGitHubJob(job) ? job.owner : "unknown",
    "github.repo": isGitHubJob(job) ? job.repo : "unknown",
    "github.prNumber":
      isGitHubJob(job) && job.prNumber ? String(job.prNumber) : "unknown",
    // Jira context (defaults to "unknown")
    "jira.issueKey": isJiraJob(job) ? job.issueKey : "unknown",
  };

  // Process all instruction templates
  const prompt = instructionTemplates
    .map((template) => replaceVariables(template, context))
    .join("\n\n---\n\n");

  return prompt.trim();
}

/**
 * Replace variable placeholders with values from context
 */
function replaceVariables(
  template: string,
  context: Record<string, string>
): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    const value = context[key.trim()];
    return value !== undefined ? value : "unknown";
  });
}
