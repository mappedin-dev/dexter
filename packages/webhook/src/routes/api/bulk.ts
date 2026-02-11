import { Router } from "express";
import type { JiraJob } from "@mapthew/shared/types";
import { getLabelTrigger } from "@mapthew/shared/utils";
import { getConfig } from "@mapthew/shared/config";
import { queue, JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN } from "../../config.js";

const router: Router = Router();

/**
 * Extract project key from issue key (e.g., "DXTR-123" -> "DXTR")
 */
function extractProjectKey(issueKey: string): string {
  const match = issueKey.match(/^([A-Z]+)-\d+$/i);
  return match ? match[1].toUpperCase() : issueKey.split("-")[0].toUpperCase();
}

/**
 * POST /api/bulk/label-trigger
 *
 * Searches JIRA for all open issues with the configured trigger label
 * and enqueues a job for each one. Optionally accepts a custom label
 * to override the env var.
 *
 * Body: { label?: string }
 */
router.post("/label-trigger", async (req, res) => {
  try {
    const config = await getConfig();
    const label = (req.body?.label as string) || getLabelTrigger(config);

    if (!label) {
      res.status(400).json({
        error:
          "No trigger label configured. Set JIRA_LABEL_TRIGGER env var or pass a label in the request body.",
      });
      return;
    }

    if (!JIRA_BASE_URL || !JIRA_EMAIL || !JIRA_API_TOKEN) {
      res.status(503).json({ error: "JIRA credentials not configured" });
      return;
    }

    // Search JIRA for open issues with the trigger label
    const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString(
      "base64",
    );
    const jql = `labels = "${label}" AND statusCategory != Done`;
    const url = new URL(`${JIRA_BASE_URL}/rest/api/3/search/jql`);
    url.searchParams.set("jql", jql);
    url.searchParams.set("maxResults", "100");
    url.searchParams.set("fields", "key,summary");

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("JIRA search error during bulk trigger:", errorText);
      res.status(response.status).json({
        error: `JIRA search failed: ${response.status} ${response.statusText}`,
      });
      return;
    }

    const data = (await response.json()) as {
      total: number;
      issues: Array<{ key: string; fields: { summary: string } }>;
    };

    if (data.issues.length === 0) {
      res.json({
        status: "ok",
        label,
        queued: 0,
        message: `No open issues found with label "${label}"`,
      });
      return;
    }

    // Enqueue a job for each issue
    const queued: string[] = [];
    for (const issue of data.issues) {
      const job: JiraJob = {
        issueKey: issue.key,
        instruction: "implement the change described in this ticket",
        triggeredBy: "bulk-label-trigger",
        source: "jira",
        projectKey: extractProjectKey(issue.key),
      };

      await queue.add("process-ticket", job, {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
      });

      queued.push(issue.key);
    }

    console.log(
      `Bulk label trigger: queued ${queued.length} jobs for label "${label}": ${queued.join(", ")}`,
    );

    res.json({
      status: "ok",
      label,
      queued: queued.length,
      total: data.total,
      issues: queued,
    });
  } catch (error) {
    console.error("Bulk label trigger error:", error);
    res.status(500).json({ error: "Failed to run bulk label trigger" });
  }
});

export default router;
