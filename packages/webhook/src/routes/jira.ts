import { Router } from "express";
import type { JiraJob, WebhookPayload, JiraIssueUpdatedPayload } from "@mapthew/shared/types";
import {
  isCommentCreatedEvent,
  extractBotInstruction,
  getBotName,
  isIssueUpdatedEvent,
  wasLabelAdded,
  getLabelTrigger,
} from "@mapthew/shared/utils";
import { postJiraComment } from "@mapthew/shared/api";
import { getConfig } from "@mapthew/shared/config";
import { queue, jiraCredentials } from "../config.js";
import { jiraWebhookAuth } from "../middleware/index.js";

const router: Router = Router();

/**
 * Extract project key from issue key (e.g., "DXTR-123" -> "DXTR")
 */
function extractProjectKey(issueKey: string): string {
  const match = issueKey.match(/^([A-Z]+)-\d+$/i);
  return match ? match[1].toUpperCase() : issueKey.split("-")[0].toUpperCase();
}

/**
 * JIRA webhook endpoint
 *
 * Handles two event types:
 * 1. comment_created — When someone comments @botName on a ticket
 * 2. jira:issue_updated — When the configured trigger label is added to a ticket
 */
router.post("/", jiraWebhookAuth, async (req, res) => {
  try {
    const payload = req.body;
    const config = await getConfig();
    const eventType = payload.webhookEvent ?? "unknown";
    const issueKey = payload.issue?.key ?? "unknown";

    console.log(
      `Jira webhook received: event=${eventType} issue=${issueKey}`,
    );

    // --- Handle comment_created events (existing behaviour) ---
    if (isCommentCreatedEvent(payload as WebhookPayload)) {
      const commentPayload = payload as WebhookPayload;
      const instruction = extractBotInstruction(commentPayload.comment.body);
      if (!instruction) {
        if (config.verboseLogs)
          console.log(
            `Jira webhook ignored: no @${getBotName()} trigger in ${commentPayload.issue.key} comment by ${commentPayload.comment.author.displayName}`,
          );
        return res.status(200).json({
          status: "ignored",
          reason: `no @${getBotName()} trigger found`,
        });
      }

      const job: JiraJob = {
        issueKey: commentPayload.issue.key,
        instruction,
        triggeredBy: commentPayload.comment.author.displayName,
        source: "jira",
        projectKey: extractProjectKey(commentPayload.issue.key),
      };

      await queue.add("process-ticket", job, {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
      });

      console.log(`Job queued for ${job.issueKey}: ${job.instruction}`);

      await postJiraComment(jiraCredentials, job.issueKey, "\uD83E\uDD13 Okie dokie!");

      return res.status(200).json({ status: "queued", issueKey: job.issueKey });
    }

    // --- Handle jira:issue_updated events (label trigger) ---
    const labelTrigger = getLabelTrigger(config);
    if (isIssueUpdatedEvent(payload as JiraIssueUpdatedPayload)) {
      const updatedPayload = payload as JiraIssueUpdatedPayload;
      const changelogItems = updatedPayload.changelog?.items ?? [];

      console.log(
        `Jira issue_updated: issue=${issueKey} labelTrigger="${labelTrigger || "(not configured)"}" changelog=${JSON.stringify(changelogItems)}`,
      );

      if (!labelTrigger) {
        console.log(
          `Jira webhook ignored: JIRA_LABEL_TRIGGER not configured`,
        );
        return res.status(200).json({
          status: "ignored",
          reason: "label trigger not configured",
        });
      }

      if (!wasLabelAdded(updatedPayload, labelTrigger)) {
        const labelChanges = changelogItems.filter(
          (item: { field: string }) => item.field === "labels",
        );
        if (labelChanges.length === 0) {
          console.log(
            `Jira webhook ignored: no "labels" field in changelog (fields changed: ${changelogItems.map((i: { field: string }) => i.field).join(", ") || "none"})`,
          );
        } else {
          console.log(
            `Jira webhook ignored: label "${labelTrigger}" was not added. Label changes: ${JSON.stringify(labelChanges)}`,
          );
        }
        return res.status(200).json({
          status: "ignored",
          reason: `trigger label "${labelTrigger}" was not added`,
        });
      }

      const job: JiraJob = {
        issueKey: updatedPayload.issue.key,
        instruction: "implement the change described in this ticket",
        triggeredBy: updatedPayload.user?.displayName ?? "label-trigger",
        source: "jira",
        projectKey: extractProjectKey(updatedPayload.issue.key),
      };

      await queue.add("process-ticket", job, {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
      });

      console.log(
        `Job queued for ${job.issueKey} via label trigger "${labelTrigger}"`,
      );

      await postJiraComment(jiraCredentials, job.issueKey, "\uD83E\uDD13 Okie dokie!");

      return res.status(200).json({ status: "queued", issueKey: job.issueKey });
    }

    // --- Unhandled event ---
    if (config.verboseLogs)
      console.log(
        `Jira webhook ignored: unhandled event (webhookEvent: ${payload.webhookEvent ?? "unknown"})`,
      );
    return res
      .status(200)
      .json({ status: "ignored", reason: "unhandled event" });
  } catch (error) {
    console.error("JIRA webhook error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
