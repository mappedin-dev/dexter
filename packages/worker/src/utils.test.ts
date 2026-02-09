import { describe, it, expect } from "vitest";
import { getReadableId, getIssueKey } from "./utils.js";
import type { JiraJob, GitHubJob, AdminJob } from "@mapthew/shared/types";

describe("getReadableId", () => {
  describe("JiraJob", () => {
    it("returns issue key for JiraJob", () => {
      const job: JiraJob = {
        source: "jira",
        issueKey: "DXTR-123",
        projectKey: "DXTR",
        instruction: "implement this",
        triggeredBy: "user@example.com",
      };
      expect(getReadableId(job)).toBe("DXTR-123");
    });
  });

  describe("GitHubJob", () => {
    it("returns repo#prNumber for PR job", () => {
      const job: GitHubJob = {
        source: "github",
        owner: "org",
        repo: "myrepo",
        prNumber: 42,
        instruction: "fix this",
        triggeredBy: "user",
      };
      expect(getReadableId(job)).toBe("myrepo#42");
    });

    it("returns repo#issueNumber for issue job", () => {
      const job: GitHubJob = {
        source: "github",
        owner: "org",
        repo: "myrepo",
        issueNumber: 15,
        instruction: "fix this",
        triggeredBy: "user",
      };
      expect(getReadableId(job)).toBe("myrepo#15");
    });

    it("returns just repo when no number", () => {
      const job: GitHubJob = {
        source: "github",
        owner: "org",
        repo: "myrepo",
        instruction: "do something",
        triggeredBy: "user",
      };
      expect(getReadableId(job)).toBe("myrepo");
    });

    it("prefers prNumber over issueNumber", () => {
      const job: GitHubJob = {
        source: "github",
        owner: "org",
        repo: "myrepo",
        prNumber: 10,
        issueNumber: 20,
        instruction: "fix this",
        triggeredBy: "user",
      };
      expect(getReadableId(job)).toBe("myrepo#10");
    });
  });

  describe("AdminJob", () => {
    it("returns 'admin' for AdminJob", () => {
      const job: AdminJob = {
        source: "admin",
        instruction: "do something",
        triggeredBy: "admin",
      };
      expect(getReadableId(job)).toBe("admin");
    });

    it("returns 'admin' even with optional context", () => {
      const job: AdminJob = {
        source: "admin",
        instruction: "do something",
        triggeredBy: "admin",
        jiraIssueKey: "ABC-123",
        githubOwner: "org",
        githubRepo: "repo",
      };
      expect(getReadableId(job)).toBe("admin");
    });
  });
});

describe("getIssueKey", () => {
  describe("Jira jobs", () => {
    it("returns the issueKey directly", () => {
      const job: JiraJob = {
        source: "jira",
        issueKey: "DXTR-123",
        projectKey: "DXTR",
        instruction: "implement this",
        triggeredBy: "user@example.com",
      };
      expect(getIssueKey(job)).toBe("DXTR-123");
    });
  });

  describe("GitHub jobs", () => {
    it("extracts issue key from branch name with feature prefix", () => {
      const job: GitHubJob = {
        source: "github",
        owner: "org",
        repo: "repo",
        prNumber: 42,
        instruction: "fix this",
        triggeredBy: "user",
        branchName: "feature/DXTR-123-add-auth",
      };
      expect(getIssueKey(job)).toBe("DXTR-123");
    });

    it("extracts issue key from branch name with dexter prefix", () => {
      const job: GitHubJob = {
        source: "github",
        owner: "org",
        repo: "repo",
        prNumber: 42,
        instruction: "fix this",
        triggeredBy: "user",
        branchName: "dexter_DXTR-456",
      };
      expect(getIssueKey(job)).toBe("DXTR-456");
    });

    it("extracts issue key from plain branch name", () => {
      const job: GitHubJob = {
        source: "github",
        owner: "org",
        repo: "repo",
        prNumber: 42,
        instruction: "fix this",
        triggeredBy: "user",
        branchName: "ABC-789-fix-bug",
      };
      expect(getIssueKey(job)).toBe("ABC-789");
    });

    it("handles lowercase issue keys in branch", () => {
      const job: GitHubJob = {
        source: "github",
        owner: "org",
        repo: "repo",
        prNumber: 42,
        instruction: "fix this",
        triggeredBy: "user",
        branchName: "feature/dxtr-123-lowercase",
      };
      expect(getIssueKey(job)).toBe("DXTR-123");
    });

    it("returns composite key when no branch name", () => {
      const job: GitHubJob = {
        source: "github",
        owner: "mappedin",
        repo: "my-repo",
        prNumber: 99,
        instruction: "fix this",
        triggeredBy: "user",
      };
      expect(getIssueKey(job)).toBe("gh-mappedin-my-repo-99");
    });

    it("returns composite key when branch has no issue key", () => {
      const job: GitHubJob = {
        source: "github",
        owner: "mappedin",
        repo: "my-repo",
        prNumber: 99,
        instruction: "fix this",
        triggeredBy: "user",
        branchName: "main",
      };
      expect(getIssueKey(job)).toBe("gh-mappedin-my-repo-99");
    });

    it("returns composite key for feature branch without issue key", () => {
      const job: GitHubJob = {
        source: "github",
        owner: "mappedin",
        repo: "my-repo",
        prNumber: 99,
        instruction: "fix this",
        triggeredBy: "user",
        branchName: "feature/add-new-thing",
      };
      expect(getIssueKey(job)).toBe("gh-mappedin-my-repo-99");
    });
  });
});
