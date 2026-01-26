import { describe, it, expect } from "vitest";
import { extractTextFromAdf, getCommentText, type JiraComment } from "./jira.js";

describe("extractTextFromAdf", () => {
  it("returns empty string for null/undefined", () => {
    expect(extractTextFromAdf(null)).toBe("");
    expect(extractTextFromAdf(undefined)).toBe("");
  });

  it("returns plain string as-is", () => {
    expect(extractTextFromAdf("hello world")).toBe("hello world");
  });

  it("extracts text from simple ADF document", () => {
    const adf = {
      type: "doc",
      version: 1,
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "@dexter implement this" }],
        },
      ],
    };
    expect(extractTextFromAdf(adf)).toBe("@dexter implement this");
  });

  it("extracts text from multi-paragraph ADF", () => {
    const adf = {
      type: "doc",
      version: 1,
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "First line" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Second line" }],
        },
      ],
    };
    expect(extractTextFromAdf(adf)).toBe("First lineSecond line");
  });

  it("handles nested content", () => {
    const adf = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Hello " },
            { type: "mention", attrs: { text: "@dexter" } },
            { type: "text", text: " please help" },
          ],
        },
      ],
    };
    expect(extractTextFromAdf(adf)).toBe("Hello  please help");
  });
});

describe("getCommentText", () => {
  it("handles string body", () => {
    const comment: JiraComment = {
      id: "123",
      body: "@dexter do something",
      author: { displayName: "Test User" },
      created: "2024-01-01T00:00:00.000Z",
      updated: "2024-01-01T00:00:00.000Z",
    };
    expect(getCommentText(comment)).toBe("@dexter do something");
  });

  it("handles ADF body", () => {
    const comment = {
      id: "456",
      body: {
        type: "doc",
        version: 1,
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "@dexter implement feature" }],
          },
        ],
      },
      author: { displayName: "Test User" },
      created: "2024-01-01T00:00:00.000Z",
      updated: "2024-01-01T00:00:00.000Z",
    } as unknown as JiraComment;
    expect(getCommentText(comment)).toBe("@dexter implement feature");
  });
});
