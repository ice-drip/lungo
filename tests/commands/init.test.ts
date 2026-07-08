import { existsSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

vi.mock("node:readline", () => {
  let answers: string[] = [];
  let callIndex = 0;

  return {
    __setAnswers(a: string[]) {
      answers = a;
      callIndex = 0;
    },
    createInterface: vi.fn(() => ({
      question: vi.fn((_prompt: string, cb: (answer: string) => void) => {
        cb(answers[callIndex++] ?? "");
      }),
      close: vi.fn(),
    })),
  };
});

import * as fs from "node:fs";
import * as readline from "node:readline";
import { init } from "../../src/commands/init";
import { logger } from "../../src/utils/logger";

const mockExistsSync = vi.mocked(existsSync);
const mockWriteFileSync = vi.mocked(fs.writeFileSync);
const mockReadFileSync = vi.mocked(fs.readFileSync);

function setAnswers(answers: string[]) {
  (readline as any).__setAnswers(answers);
}

describe("init command", () => {
  let processExitSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    processExitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as any);
    vi.spyOn(logger, "info").mockImplementation(() => {});
    vi.spyOn(logger, "success").mockImplementation(() => {});
    setAnswers([]);
  });

  afterEach(() => {
    processExitSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it("skips creation when config exists and --force is not set", async () => {
    mockExistsSync.mockReturnValue(true);

    await init.run({
      args: { env: "production", force: false },
    });

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining("Config already exists"),
    );
    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });

  it("creates config with provided env name", async () => {
    mockExistsSync.mockReturnValue(false);
    setAnswers([
      "example.com", // SSH Host
      "22", // SSH Port
      "deploy", // SSH Username
      "", // SSH Password (empty)
      "/var/www", // Remote server directory
      "my-app", // Project name
      "dist", // Local dist directory
      "", // SSH private key path (empty)
      "", // Backup retention days (empty)
    ]);

    await init.run({
      args: { env: "production", force: false },
    });

    expect(mockWriteFileSync).toHaveBeenCalledTimes(1);
    const [, content] = mockWriteFileSync.mock.calls[0];
    const written = JSON.parse(content as string);
    expect(written.production).toEqual({
      host: "example.com",
      port: 22,
      username: "deploy",
      serverDir: "/var/www",
      project: "my-app",
      dist: "dist",
    });
  });

  it("prompts for env name when --env is not provided", async () => {
    mockExistsSync.mockReturnValue(false);
    setAnswers([
      "staging", // Environment name (from prompt)
      "staging.example.com", // SSH Host
      "22", // SSH Port
      "admin", // SSH Username
      "pass123", // SSH Password
      "/opt/app", // Remote server directory
      "web-app", // Project name
      "build", // Local dist directory
      "/home/deploy/.ssh/id_rsa", // SSH private key path
      "30", // Backup retention days
    ]);

    await init.run({
      args: { env: undefined, force: false },
    });

    const [, content] = mockWriteFileSync.mock.calls[0];
    const written = JSON.parse(content as string);
    expect(written.staging).toBeDefined();
    expect(written.staging.host).toBe("staging.example.com");
  });

  it("includes password when provided", async () => {
    mockExistsSync.mockReturnValue(false);
    setAnswers([
      "example.com",
      "22",
      "root",
      "s3cret",
      "/var/www",
      "my-app",
      "dist",
      "",
      "",
    ]);

    await init.run({
      args: { env: "production", force: false },
    });

    const [, content] = mockWriteFileSync.mock.calls[0];
    const written = JSON.parse(content as string);
    expect(written.production.password).toBe("s3cret");
  });

  it("includes privateKey when provided", async () => {
    mockExistsSync.mockReturnValue(false);
    setAnswers([
      "example.com",
      "22",
      "root",
      "",
      "/var/www",
      "my-app",
      "dist",
      "/home/user/.ssh/id_rsa",
      "",
    ]);

    await init.run({
      args: { env: "production", force: false },
    });

    const [, content] = mockWriteFileSync.mock.calls[0];
    const written = JSON.parse(content as string);
    expect(written.production.privateKey).toBe("/home/user/.ssh/id_rsa");
  });

  it("includes timeout when provided", async () => {
    mockExistsSync.mockReturnValue(false);
    setAnswers([
      "example.com",
      "22",
      "root",
      "",
      "/var/www",
      "my-app",
      "dist",
      "",
      "14",
    ]);

    await init.run({
      args: { env: "production", force: false },
    });

    const [, content] = mockWriteFileSync.mock.calls[0];
    const written = JSON.parse(content as string);
    expect(written.production.timeout).toBe(14);
  });

  it("uses default values for empty optional fields", async () => {
    mockExistsSync.mockReturnValue(false);
    setAnswers([
      "", // SSH Host -> localhost
      "", // SSH Port -> 22
      "", // SSH Username -> root
      "", // SSH Password
      "", // Remote server directory -> /var/www
      "", // Project name -> envName
      "", // Local dist directory -> dist
      "", // SSH private key path
      "", // Backup retention days
    ]);

    await init.run({
      args: { env: "staging", force: false },
    });

    const [, content] = mockWriteFileSync.mock.calls[0];
    const written = JSON.parse(content as string);
    expect(written.staging).toEqual({
      host: "localhost",
      port: 22,
      username: "root",
      serverDir: "/var/www",
      project: "staging",
      dist: "dist",
    });
  });

  it("overwrites existing config when --force is set", async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(
      JSON.stringify({ production: { host: "old.example.com" } }),
    );
    setAnswers([
      "new.example.com",
      "2222",
      "admin",
      "",
      "/opt/new",
      "new-app",
      "build",
      "",
      "",
    ]);

    await init.run({
      args: { env: "production", force: true },
    });

    expect(mockWriteFileSync).toHaveBeenCalledTimes(1);
    const [, content] = mockWriteFileSync.mock.calls[0];
    const written = JSON.parse(content as string);
    expect(written.production.host).toBe("new.example.com");
    expect(written.production.port).toBe(2222);
  });

  it("merges new environment with existing config", async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(
      JSON.stringify({ production: { host: "prod.example.com" } }),
    );
    setAnswers([
      "staging.example.com",
      "22",
      "admin",
      "",
      "/var/www",
      "staging-app",
      "dist",
      "",
      "",
    ]);

    await init.run({
      args: { env: "staging", force: true },
    });

    const [, content] = mockWriteFileSync.mock.calls[0];
    const written = JSON.parse(content as string);
    expect(written.production).toEqual({ host: "prod.example.com" });
    expect(written.staging).toBeDefined();
    expect(written.staging.host).toBe("staging.example.com");
  });

  it("handles corrupt existing config gracefully", async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockImplementation(() => {
      throw new Error("File read error");
    });
    setAnswers([
      "example.com",
      "22",
      "root",
      "",
      "/var/www",
      "my-app",
      "dist",
      "",
      "",
    ]);

    await init.run({
      args: { env: "production", force: true },
    });

    expect(mockWriteFileSync).toHaveBeenCalledTimes(1);
    const [, content] = mockWriteFileSync.mock.calls[0];
    const written = JSON.parse(content as string);
    expect(written.production).toBeDefined();
  });
});
