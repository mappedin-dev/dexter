import { getTriggerPattern } from "./config.js";
import type {
  Job,
  JiraJob,
  GitHubJob,
  AdminJob,
  WebhookPayload,
  GitHubWebhookPayload,
} from "./types.js";

/**
 * Type guard for JiraJob
 */
export function isJiraJob(job: Job): job is JiraJob {
  return job.source === "jira";
}

/**
 * Type guard for GitHubJob
 */
export function isGitHubJob(job: Job): job is GitHubJob {
  return job.source === "github";
}

/**
 * Type guard for AdminJob
 */
export function isAdminJob(job: Job): job is AdminJob {
  return job.source === "admin";
}

/**
 * Check if a webhook payload is a comment_created event
 */
export function isCommentCreatedEvent(payload: WebhookPayload): boolean {
  return payload.webhookEvent === "comment_created";
}

/**
 * Extract bot instruction from comment body
 * Returns null if no trigger found (e.g., @mapthew or configured bot name)
 */
export function extractBotInstruction(commentBody: string): string | null {
  const match = commentBody.match(getTriggerPattern());
  return match ? match[1].trim() : null;
}

/**
 * Check if a GitHub webhook payload is a PR comment event
 */
export function isGitHubPRCommentEvent(payload: GitHubWebhookPayload): boolean {
  return (
    payload.action === "created" && payload.issue?.pull_request !== undefined
  );
}

/**
 * Check if a GitHub webhook payload is an issue comment event
 */
export function isGitHubIssueCommentEvent(
  payload: GitHubWebhookPayload
): boolean {
  return (
    payload.action === "created" && payload.issue?.pull_request === undefined
  );
}

/**
 * Extract JIRA issue key from PR branch name or title
 * Looks for patterns like DXTR-123, ABC-456, etc.
 */
export function extractIssueKeyFromBranch(branchName: string): string | null {
  const match = branchName.match(/([A-Z]+-\d+)/i);
  return match ? match[1].toUpperCase() : null;
}
