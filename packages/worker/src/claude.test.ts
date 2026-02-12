import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { BoundedBuffer, getMaxBufferBytes } from "./claude.js";

describe("BoundedBuffer", () => {
  it("stores text within the limit", () => {
    const buf = new BoundedBuffer(100);
    buf.append("hello");
    expect(buf.toString()).toBe("hello");
    expect(buf.truncated).toBe(false);
  });

  it("accumulates multiple appends", () => {
    const buf = new BoundedBuffer(100);
    buf.append("foo");
    buf.append("bar");
    expect(buf.toString()).toBe("foobar");
    expect(buf.truncated).toBe(false);
  });

  it("truncates older content when limit is exceeded", () => {
    const buf = new BoundedBuffer(5);
    buf.append("abcde"); // exactly at limit
    expect(buf.toString()).toBe("abcde");
    expect(buf.truncated).toBe(false);

    buf.append("fg"); // exceeds limit → keep last 5
    expect(buf.toString()).toBe("cdefg");
    expect(buf.truncated).toBe(true);
  });

  it("keeps only the tail when a single large chunk is appended", () => {
    const buf = new BoundedBuffer(3);
    buf.append("abcdef");
    expect(buf.toString()).toBe("def");
    expect(buf.truncated).toBe(true);
  });

  it("stays truncated once the flag is set", () => {
    const buf = new BoundedBuffer(4);
    buf.append("12345"); // triggers truncation
    expect(buf.truncated).toBe(true);

    // Even after appending small text that fits, truncated stays true
    const buf2 = new BoundedBuffer(4);
    buf2.append("12345");
    buf2.append("a");
    expect(buf2.truncated).toBe(true);
  });

  it("handles empty appends", () => {
    const buf = new BoundedBuffer(10);
    buf.append("");
    buf.append("hi");
    buf.append("");
    expect(buf.toString()).toBe("hi");
    expect(buf.truncated).toBe(false);
  });
});

describe("getMaxBufferBytes", () => {
  const originalEnv = process.env.MAX_OUTPUT_BUFFER_BYTES;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.MAX_OUTPUT_BUFFER_BYTES;
    } else {
      process.env.MAX_OUTPUT_BUFFER_BYTES = originalEnv;
    }
  });

  it("returns default (10 MB) when env is not set", () => {
    delete process.env.MAX_OUTPUT_BUFFER_BYTES;
    expect(getMaxBufferBytes()).toBe(10 * 1024 * 1024);
  });

  it("reads value from environment variable", () => {
    process.env.MAX_OUTPUT_BUFFER_BYTES = "5242880";
    expect(getMaxBufferBytes()).toBe(5242880);
  });

  it("falls back to default for non-numeric values", () => {
    process.env.MAX_OUTPUT_BUFFER_BYTES = "not-a-number";
    expect(getMaxBufferBytes()).toBe(10 * 1024 * 1024);
  });

  it("falls back to default for zero", () => {
    process.env.MAX_OUTPUT_BUFFER_BYTES = "0";
    expect(getMaxBufferBytes()).toBe(10 * 1024 * 1024);
  });

  it("falls back to default for negative values", () => {
    process.env.MAX_OUTPUT_BUFFER_BYTES = "-100";
    expect(getMaxBufferBytes()).toBe(10 * 1024 * 1024);
  });
});
