import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock ioredis with ioredis-mock before importing config
vi.mock("ioredis", async () => {
  const RedisMock = (await import("ioredis-mock")).default;
  return { Redis: RedisMock };
});

import {
  isValidBotName,
  isValidJiraUrl,
  getBotName,
  setBotName,
  getBotDisplayName,
  getTriggerPattern,
  getQueueName,
  getBranchPrefix,
  initConfigStore,
  getConfig,
  saveConfig,
  getClaudeModel,
} from "./config.js";

describe("isValidBotName", () => {
  it("accepts valid lowercase alphanumeric names", () => {
    expect(isValidBotName("mapthew")).toBe(true);
    expect(isValidBotName("bot123")).toBe(true);
    expect(isValidBotName("mybot")).toBe(true);
  });

  it("accepts names with dashes and underscores", () => {
    expect(isValidBotName("my-bot")).toBe(true);
    expect(isValidBotName("my_bot")).toBe(true);
    expect(isValidBotName("code-bot-123")).toBe(true);
  });

  it("rejects names starting with dash or underscore", () => {
    expect(isValidBotName("-bot")).toBe(false);
    expect(isValidBotName("_bot")).toBe(false);
  });

  it("rejects uppercase letters", () => {
    expect(isValidBotName("MyBot")).toBe(false);
    expect(isValidBotName("MAPTHEW")).toBe(false);
  });

  it("rejects special characters", () => {
    expect(isValidBotName("bot@name")).toBe(false);
    expect(isValidBotName("bot.name")).toBe(false);
    expect(isValidBotName("bot name")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidBotName("")).toBe(false);
  });

  it("rejects names longer than 32 characters", () => {
    expect(isValidBotName("a".repeat(32))).toBe(true);
    expect(isValidBotName("a".repeat(33))).toBe(false);
  });
});

describe("isValidJiraUrl", () => {
  it("accepts valid HTTPS URLs", () => {
    expect(isValidJiraUrl("https://company.atlassian.net")).toBe(true);
    expect(isValidJiraUrl("https://jira.example.com")).toBe(true);
  });

  it("accepts empty string (not configured)", () => {
    expect(isValidJiraUrl("")).toBe(true);
  });

  it("rejects HTTP URLs", () => {
    expect(isValidJiraUrl("http://company.atlassian.net")).toBe(false);
  });

  it("rejects invalid URLs", () => {
    expect(isValidJiraUrl("not-a-url")).toBe(false);
    expect(isValidJiraUrl("company.atlassian.net")).toBe(false);
  });
});

describe("getBotName and setBotName", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    // Reset to known state
    setBotName("mapthew");
  });

  it("returns the name set by setBotName", () => {
    setBotName("testbot");
    expect(getBotName()).toBe("testbot");
  });

  it("throws error for invalid bot name", () => {
    expect(() => setBotName("Invalid-Name")).toThrow();
    expect(() => setBotName("")).toThrow();
    expect(() => setBotName("-invalid")).toThrow();
  });

  it("preserves valid name after failed setBotName attempt", () => {
    setBotName("validbot");
    expect(() => setBotName("Invalid-Name")).toThrow();
    // Should still have the previous valid name
    expect(getBotName()).toBe("validbot");
  });
});

describe("getBotDisplayName", () => {
  beforeEach(() => {
    setBotName("mapthew");
  });

  it("capitalizes first letter", () => {
    setBotName("mapthew");
    expect(getBotDisplayName()).toBe("Mapthew");
  });

  it("handles names with dashes", () => {
    setBotName("code-bot");
    expect(getBotDisplayName()).toBe("Code-bot");
  });

  it("handles single character name", () => {
    setBotName("a");
    expect(getBotDisplayName()).toBe("A");
  });
});

describe("getTriggerPattern", () => {
  beforeEach(() => {
    setBotName("mapthew");
  });

  it("creates regex for default bot name", () => {
    setBotName("mapthew");
    const pattern = getTriggerPattern();
    expect(pattern.test("@mapthew do something")).toBe(true);
    expect(pattern.test("@MAPTHEW do something")).toBe(true); // case insensitive
  });

  it("creates regex for custom bot name", () => {
    setBotName("testbot");
    const pattern = getTriggerPattern();
    expect(pattern.test("@testbot implement this")).toBe(true);
    expect(pattern.test("@mapthew implement this")).toBe(false);
  });

  it("captures instruction after trigger", () => {
    setBotName("mapthew");
    const pattern = getTriggerPattern();
    const match = "@mapthew implement auth".match(pattern);
    expect(match).not.toBeNull();
    expect(match![1]).toBe("implement auth");
  });
});

describe("getQueueName", () => {
  it("returns queue name based on bot name", () => {
    setBotName("mapthew");
    expect(getQueueName()).toBe("mapthew-jobs");
  });

  it("updates when bot name changes", () => {
    setBotName("testbot");
    expect(getQueueName()).toBe("testbot-jobs");
  });
});

describe("getBranchPrefix", () => {
  it("returns branch prefix based on bot name", () => {
    setBotName("mapthew");
    expect(getBranchPrefix()).toBe("mapthew-bot");
  });

  it("updates when bot name changes", () => {
    setBotName("testbot");
    expect(getBranchPrefix()).toBe("testbot-bot");
  });
});

describe("config persistence with Redis", () => {
  beforeEach(async () => {
    // Initialize with mock Redis
    await initConfigStore("redis://localhost:6379");
    setBotName("mapthew");
  });

  it("saves and retrieves config", async () => {
    await saveConfig({
      botName: "persistbot",
      claudeModel: "claude-sonnet-4-5",
      jiraBaseUrl: "https://test.atlassian.net",
    });

    const config = await getConfig();
    expect(config.botName).toBe("persistbot");
    expect(config.claudeModel).toBe("claude-sonnet-4-5");
    expect(config.jiraBaseUrl).toBe("https://test.atlassian.net");
  });

  it("throws on invalid bot name during save", async () => {
    await expect(
      saveConfig({
        botName: "Invalid-Name",
        claudeModel: "claude-sonnet-4-5",
        jiraBaseUrl: "",
      })
    ).rejects.toThrow();
  });

  it("throws on invalid JIRA URL during save", async () => {
    await expect(
      saveConfig({
        botName: "validbot",
        claudeModel: "claude-sonnet-4-5",
        jiraBaseUrl: "http://not-https.com",
      })
    ).rejects.toThrow();
  });

  it("returns default config when Redis has no data", async () => {
    // Create a fresh mock Redis connection
    await initConfigStore("redis://localhost:6380");
    const config = await getConfig();
    expect(config.botName).toBeDefined();
    expect(config.claudeModel).toBeDefined();
  });
});

describe("getClaudeModel", () => {
  beforeEach(async () => {
    await initConfigStore("redis://localhost:6379");
    setBotName("mapthew");
  });

  it("returns model from config", async () => {
    await saveConfig({
      botName: "mapthew",
      claudeModel: "claude-haiku-4-5",
      jiraBaseUrl: "",
    });

    const model = await getClaudeModel();
    expect(model).toBe("claude-haiku-4-5");
  });

  it("returns default model when not configured", async () => {
    // Fresh Redis connection with no config
    await initConfigStore("redis://localhost:6381");
    const model = await getClaudeModel();
    expect(model).toBeDefined();
  });
});
