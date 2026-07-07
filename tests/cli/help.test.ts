import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const CLI = resolve(__dirname, "..", "..", "dist", "bin.js");

describe("cLI help", () => {
  it("shows help with --help flag", () => {
    const output = execSync(`node ${CLI} --help`, { encoding: "utf-8" });
    expect(output).toContain("lungo");
    expect(output).toContain("deploy");
    expect(output).toContain("init");
    expect(output).toContain("list");
    expect(output).toContain("rollback");
  });

  it("shows version with --version flag", () => {
    const output = execSync(`node ${CLI} --version`, { encoding: "utf-8" }).trim();
    expect(output).toBe("2.0.0");
  });

  it("shows deploy help", () => {
    const output = execSync(`node ${CLI} deploy --help`, { encoding: "utf-8" });
    expect(output).toContain("--env");
    expect(output).toContain("--dryRun");
  });

  it("shows error with no --env", () => {
    try {
      execSync(`node ${CLI} deploy`, { encoding: "utf-8" });
      // If we get here, the command succeeded when it shouldn't have
      expect.unreachable("Expected deploy without --env to fail");
    }
    catch (err: any) {
      expect(err.stderr).toContain("--env is required");
    }
  });
});
