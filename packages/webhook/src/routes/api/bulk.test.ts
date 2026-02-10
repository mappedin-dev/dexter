import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// Use vi.hoisted to define mocks before vi.mock hoisting
const mockQueue = vi.hoisted(() => ({
  add: vi.fn().mockResolvedValue({ id: "job-123" }),
}));

const mockFetch = vi.hoisted(() => vi.fn());

// Mock config module
vi.mock("../../config.js", () => ({
  queue: mockQueue,
  JIRA_BASE_URL: "https://test.atlassian.net",
  JIRA_EMAIL: "test@example.com",
  JIRA_API_TOKEN: "mock-token",
}));

// Mock global fetch
vi.stubGlobal("fetch", mockFetch);

import bulkRouter from "./bulk.js";

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/bulk", bulkRouter);
  return app;
}

describe("Bulk trigger API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.JIRA_LABEL_TRIGGER;
  });

  describe("POST /api/bulk/label-trigger", () => {
    it("returns 400 when no label configured and none provided", async () => {
      const app = createApp();
      const res = await request(app)
        .post("/api/bulk/label-trigger")
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("No trigger label configured");
    });

    it("uses label from request body over env var", async () => {
      process.env.JIRA_LABEL_TRIGGER = "default-label";

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          total: 1,
          issues: [{ key: "PROJ-1", fields: { summary: "Test" } }],
        }),
      });

      const app = createApp();
      const res = await request(app)
        .post("/api/bulk/label-trigger")
        .send({ label: "custom-label" });

      expect(res.status).toBe(200);
      expect(res.body.label).toBe("custom-label");

      // Verify JQL used the custom label
      const fetchUrl = mockFetch.mock.calls[0][0] as string;
      expect(fetchUrl).toContain("custom-label");
    });

    it("uses JIRA_LABEL_TRIGGER env var when no label in body", async () => {
      process.env.JIRA_LABEL_TRIGGER = "claude-ready";

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          total: 0,
          issues: [],
        }),
      });

      const app = createApp();
      const res = await request(app)
        .post("/api/bulk/label-trigger")
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.label).toBe("claude-ready");
    });

    it("returns empty result when no issues found", async () => {
      process.env.JIRA_LABEL_TRIGGER = "claude-ready";

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          total: 0,
          issues: [],
        }),
      });

      const app = createApp();
      const res = await request(app)
        .post("/api/bulk/label-trigger")
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.queued).toBe(0);
      expect(res.body.message).toContain("No open issues found");
      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it("enqueues jobs for all matching issues", async () => {
      process.env.JIRA_LABEL_TRIGGER = "claude-ready";

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          total: 3,
          issues: [
            { key: "PROJ-1", fields: { summary: "First ticket" } },
            { key: "PROJ-2", fields: { summary: "Second ticket" } },
            { key: "OTHER-5", fields: { summary: "Third ticket" } },
          ],
        }),
      });

      const app = createApp();
      const res = await request(app)
        .post("/api/bulk/label-trigger")
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.queued).toBe(3);
      expect(res.body.issues).toEqual(["PROJ-1", "PROJ-2", "OTHER-5"]);
      expect(mockQueue.add).toHaveBeenCalledTimes(3);

      // Verify first job
      expect(mockQueue.add).toHaveBeenCalledWith(
        "process-ticket",
        expect.objectContaining({
          source: "jira",
          issueKey: "PROJ-1",
          projectKey: "PROJ",
          instruction: "implement the change described in this ticket",
          triggeredBy: "bulk-label-trigger",
        }),
        expect.any(Object),
      );

      // Verify project key extraction for different project
      expect(mockQueue.add).toHaveBeenCalledWith(
        "process-ticket",
        expect.objectContaining({
          issueKey: "OTHER-5",
          projectKey: "OTHER",
        }),
        expect.any(Object),
      );
    });

    it("handles JIRA API errors", async () => {
      process.env.JIRA_LABEL_TRIGGER = "claude-ready";

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        text: async () => "Invalid credentials",
      });

      const app = createApp();
      const res = await request(app)
        .post("/api/bulk/label-trigger")
        .send({});

      expect(res.status).toBe(401);
      expect(res.body.error).toContain("JIRA search failed");
    });
  });
});
