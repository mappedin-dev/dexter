import { createWorker, type BullJob } from "@mapthew/shared/queue";
import type { Job, QueueJob } from "@mapthew/shared/types";
import {
  isAdminJob,
  isGitHubJob,
  isJiraJob,
  getBotName,
} from "@mapthew/shared/utils";
import { initConfigStore } from "@mapthew/shared/config";
import { postGitHubComment, postJiraComment } from "@mapthew/shared/api";
import {
  getOrCreateWorkspace,
  hasExistingSession,
  workspaceExists,
  getMaxSessions,
  getSessionCount,
  evictOldestSession,
  pruneInactiveSessions,
  getPruneThresholdDays,
  getPruneIntervalDays,
} from "@mapthew/shared/workspace";
import { invokeClaudeCode } from "./claude.js";
import { getReadableId, getIssueKey } from "./utils.js";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const JIRA_BASE_URL = process.env.JIRA_BASE_URL || "";
const JIRA_EMAIL = process.env.JIRA_EMAIL || "";
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN || "";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";

// JIRA credentials for posting comments
const jiraCredentials = {
  baseUrl: JIRA_BASE_URL,
  email: JIRA_EMAIL,
  apiToken: JIRA_API_TOKEN,
};

/**
 * Post a comment to the appropriate source (JIRA or GitHub)
 */
async function postComment(job: Job, comment: string): Promise<void> {
  if (isGitHubJob(job)) {
    const number = job.prNumber ?? job.issueNumber;
    if (number) {
      await postGitHubComment(
        GITHUB_TOKEN,
        job.owner,
        job.repo,
        number,
        comment,
      );
    }
  } else if (isJiraJob(job)) {
    await postJiraComment(jiraCredentials, job.issueKey, comment);
  } else if (isAdminJob(job)) {
    // Admin jobs don't have an external source to post comments to
    // Status is visible on the dashboard
  }
}

/**
 * Process a regular job using persistent workspaces for session reuse
 */
async function processRegularJob(job: Job): Promise<void> {
  const jobId = getReadableId(job);
  const issueKey = getIssueKey(job);

  console.log(`Processing job for ${jobId}: ${job.instruction}`);
  console.log(`[Session] Issue key: ${issueKey}`);

  // Check if this job can reuse an existing session
  const hasExisting = await workspaceExists(issueKey);

  // Soft cap: if no existing workspace and at capacity, evict the oldest
  // session (LRU) to make room instead of blocking
  if (!hasExisting) {
    const count = await getSessionCount();
    const max = await getMaxSessions();
    if (count >= max) {
      console.log(
        `[Session] At soft cap (${count}/${max}), evicting oldest session`,
      );
      await evictOldestSession();
    }
  }

  // Get or create the persistent workspace
  const workDir = await getOrCreateWorkspace(issueKey);
  console.log(`[Session] Workspace: ${workDir}`);

  // Check if there's an existing Claude session to resume
  const hasSession = await hasExistingSession(workDir);
  if (hasSession) {
    console.log(`[Session] Found existing session, will resume`);
  } else {
    console.log(`[Session] No existing session, starting fresh`);
  }

  // Invoke Claude with session context
  const result = await invokeClaudeCode(job, workDir, { hasSession });

  if (!result.success) {
    throw new Error(result.error || "Claude Code CLI failed");
  }

  console.log(`Job completed for ${jobId}`);
  // Note: We intentionally do NOT clean up the workspace here
  // Workspaces are pruned periodically based on inactivity threshold
}

/**
 * Process a queue job
 */
async function processJob(bullJob: BullJob<QueueJob>): Promise<void> {
  await processRegularJob(bullJob.data);
}

// Create worker
const worker = createWorker(REDIS_URL, processJob);

// Handle failed jobs - post error to appropriate source
worker.on("failed", async (job, err) => {
  if (job) {
    const data = job.data as QueueJob;
    console.error(`Job failed for ${getReadableId(data)}:`, err.message);
    await postComment(data, `🤓 Oops, I hit an error: ${err.message}`);
  }
});

// Handle completed jobs
worker.on("completed", (job) => {
  const data = job.data as QueueJob;
  console.log(`Job completed: ${getReadableId(data)}`);
});

// --- Periodic session pruning ---

async function runPrune(): Promise<void> {
  const thresholdDays = await getPruneThresholdDays();
  console.log(
    `[Session] Running scheduled prune (threshold: ${thresholdDays} days)`,
  );
  try {
    await pruneInactiveSessions(thresholdDays);
  } catch (error) {
    console.error("[Session] Prune failed:", error);
  }
}

// Initialize config store so the worker can read settings from Redis,
// then start pruning on schedule
let pruneInterval: ReturnType<typeof setInterval>;

async function startPruning(): Promise<void> {
  await initConfigStore(REDIS_URL);
  const intervalDays = await getPruneIntervalDays();
  const intervalMs = intervalDays * 24 * 60 * 60 * 1000;

  // Run an initial prune, then on schedule
  void runPrune();
  pruneInterval = setInterval(() => void runPrune(), intervalMs);

  console.log(
    `Worker started as @${getBotName()}, waiting for jobs... (prune every ${intervalDays}d)`,
  );
}

void startPruning();

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("Shutting down worker...");
  clearInterval(pruneInterval);
  await worker.close();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("Shutting down worker...");
  clearInterval(pruneInterval);
  await worker.close();
  process.exit(0);
});
