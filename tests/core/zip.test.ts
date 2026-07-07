import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createZip } from "../../src/core/zip";

const TEST_DIR = resolve(__dirname, "__fixtures__", "zip-test");

describe("createZip", () => {
  beforeAll(() => {
    if (existsSync(TEST_DIR))
      rmSync(TEST_DIR, { recursive: true });
    mkdirSync(resolve(TEST_DIR, "dist", "nested"), { recursive: true });
    writeFileSync(resolve(TEST_DIR, "dist", "index.html"), "<html></html>");
    writeFileSync(resolve(TEST_DIR, "dist", "nested", "style.css"), "body {}");
  });

  afterAll(() => {
    if (existsSync(TEST_DIR))
      rmSync(TEST_DIR, { recursive: true });
  });

  it("creates zip with files from dist directory", () => {
    const zip = createZip(TEST_DIR, "dist");
    const entries = zip.getEntries();
    expect(entries.length).toBe(2);
  });

  it("creates a non-empty zip buffer", () => {
    const zip = createZip(TEST_DIR, "dist");
    const buffer = zip.toBuffer();
    expect(buffer.length).toBeGreaterThan(0);
  });

  it("throws on non-existent directory", () => {
    expect(() => createZip(TEST_DIR, "nonexistent")).toThrow();
  });
});
