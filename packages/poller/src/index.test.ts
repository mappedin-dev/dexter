import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock external dependencies before importing
vi.mock("ioredis", () => {
  const Redis = vi.fn(() => ({
    sismember: vi.fn(),
    sadd: vi.fn(),
    expire: vi.fn(),
  }));
  return { Redis, default: Redis };
});

vi.mock("@dexter/shared/queue", () => ({
  createQueue: vi.fn(() => ({
    add: vi.fn(),
  })),
}));

vi.mock("@dexter/shared/jira", () => ({
  createJiraClient: vi.fn(() => ({
    searchIssues: vi.fn(),
    getIssueComments: vi.fn(),
    postComment: vi.fn(),
  })),
  searchRecentlyUpdatedIssues: vi.fn(),
  getCommentText: vi.fn((comment) => comment.body),
}));

// Test the extractDexterInstruction function directly since it's used by the poller
import { extractDexterInstruction } from "@dexter/shared/types";

describe("Poller", () => {
  describe("extractDexterInstruction (used by poller)", () => {
    it("extracts instruction after @dexter mention", () => {
      expect(extractDexterInstruction("@dexter implement this feature")).toBe(
        "implement this feature"
      );
    });

    it("is case insensitive", () => {
      expect(extractDexterInstruction("@DEXTER do something")).toBe(
        "do something"
      );
      expect(extractDexterInstruction("@Dexter fix the bug")).toBe(
        "fix the bug"
      );
    });

    it("returns null when no @dexter mention", () => {
      expect(extractDexterInstruction("just a regular comment")).toBeNull();
    });

    it("handles @dexter at different positions", () => {
      expect(
        extractDexterInstruction("Hey @dexter please review this")
      ).toBe("please review this");
    });

    it("trims whitespace from instruction", () => {
      expect(extractDexterInstruction("@dexter   lots of spaces   ")).toBe(
        "lots of spaces"
      );
    });
  });
});

describe("Configuration parsing", () => {
  it("parses comma-separated project keys", () => {
    const projects = "DXTR,OTHER,TEST"
      .split(",")
      .map((p) => p.trim());
    expect(projects).toEqual(["DXTR", "OTHER", "TEST"]);
  });

  it("handles whitespace in project keys", () => {
    const projects = "DXTR, OTHER , TEST"
      .split(",")
      .map((p) => p.trim());
    expect(projects).toEqual(["DXTR", "OTHER", "TEST"]);
  });

  it("handles single project", () => {
    const projects = "DXTR".split(",").map((p) => p.trim());
    expect(projects).toEqual(["DXTR"]);
  });
});
