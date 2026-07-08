import type { Config } from "../../src/config/schema";
import { Observable } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { rollback } from "../../src/commands/rollback";
import { loadConfig } from "../../src/config/loader";
import { execCommand } from "../../src/core/remote-exec";
import { sshConnect } from "../../src/core/ssh";
import { listBackups } from "../../src/services/backup";
import { logger } from "../../src/utils/logger";

vi.mock("../../src/config/loader");
vi.mock("../../src/core/ssh");
vi.mock("../../src/core/remote-exec");
vi.mock("../../src/services/backup");

const mockLoadConfig = vi.mocked(loadConfig);
const mockSshConnect = vi.mocked(sshConnect);
const mockExecCommand = vi.mocked(execCommand);
const mockListBackups = vi.mocked(listBackups);

const mockConn = { end: vi.fn() };

function createMockConfig(overrides: Partial<Config> = {}): Config {
  return {
    serverDir: "/var/www",
    host: "10.0.0.1",
    port: 22,
    username: "deploy",
    password: "secret",
    project: "my-app",
    dist: "dist",
    ...overrides,
  };
}

const defaultArgs = {
  env: "production",
  config: undefined as string | undefined,
  to: "latest",
  dryRun: false,
  verbose: false,
};

describe("rollback command", () => {
  let exitSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockConn.end.mockReset();
    exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process.exit");
    }) as any);
    vi.spyOn(logger, "info").mockImplementation(() => {});
    vi.spyOn(logger, "error").mockImplementation(() => {});
    vi.spyOn(logger, "success").mockImplementation(() => {});
    vi.spyOn(logger, "debug").mockImplementation(() => {});
  });

  afterEach(() => {
    exitSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it("exits with error when --env is not provided", async () => {
    await expect(
      rollback.run({ args: { ...defaultArgs, env: undefined } }),
    ).rejects.toThrow("process.exit");

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(logger.error).toHaveBeenCalledWith(
      "--env is required. Usage: lungo rollback --env production --to latest",
    );
  });

  it("rolls back to latest backup successfully", async () => {
    const config = createMockConfig();
    mockLoadConfig.mockReturnValue({
      config,
      configFile: "/project/lungo.config.json",
    });
    mockSshConnect.mockReturnValue(
      new Observable((observer) => {
        observer.next(mockConn as any);
        observer.complete();
      }),
    );
    mockExecCommand.mockReturnValue(
      new Observable((observer) => {
        observer.next("my-app\nmy-app.bak.1720000000000\nmy-app.bak.1710000000000\n");
        observer.complete();
      }),
    );
    mockListBackups.mockReturnValue(
      new Observable((observer) => {
        observer.next([
          { filename: "my-app.bak.1720000000000", date: "2024-07-03" },
          { filename: "my-app.bak.1710000000000", date: "2024-03-10" },
        ]);
        observer.complete();
      }),
    );

    await rollback.run({ args: { ...defaultArgs, to: "latest" } });

    expect(logger.success).toHaveBeenCalledWith("Rollback complete");
    expect(mockConn.end).toHaveBeenCalled();
  });

  it("rolls back to a specific backup by timestamp", async () => {
    const config = createMockConfig();
    mockLoadConfig.mockReturnValue({
      config,
      configFile: "/project/lungo.config.json",
    });
    mockSshConnect.mockReturnValue(
      new Observable((observer) => {
        observer.next(mockConn as any);
        observer.complete();
      }),
    );
    mockExecCommand.mockReturnValue(
      new Observable((observer) => {
        observer.next("my-app\nmy-app.bak.1720000000000\nmy-app.bak.1710000000000\n");
        observer.complete();
      }),
    );
    mockListBackups.mockReturnValue(
      new Observable((observer) => {
        observer.next([
          { filename: "my-app.bak.1720000000000", date: "2024-07-03" },
          { filename: "my-app.bak.1710000000000", date: "2024-03-10" },
        ]);
        observer.complete();
      }),
    );

    await rollback.run({ args: { ...defaultArgs, to: "1710000000000" } });

    expect(logger.success).toHaveBeenCalledWith("Rollback complete");
  });

  it("shows dry-run plan without executing rollback", async () => {
    const config = createMockConfig();
    mockLoadConfig.mockReturnValue({
      config,
      configFile: "/project/lungo.config.json",
    });
    mockSshConnect.mockReturnValue(
      new Observable((observer) => {
        observer.next(mockConn as any);
        observer.complete();
      }),
    );
    mockExecCommand.mockReturnValue(
      new Observable((observer) => {
        observer.next("my-app\nmy-app.bak.1720000000000\n");
        observer.complete();
      }),
    );
    mockListBackups.mockReturnValue(
      new Observable((observer) => {
        observer.next([
          { filename: "my-app.bak.1720000000000", date: "2024-07-03" },
        ]);
        observer.complete();
      }),
    );

    await rollback.run({ args: { ...defaultArgs, to: "latest", dryRun: true } });

    expect(logger.info).toHaveBeenCalledWith(
      "[DRY-RUN] Would rollback to: my-app.bak.1720000000000",
    );
    expect(mockConn.end).toHaveBeenCalled();
  });

  it("rejects when no backups are found", async () => {
    const config = createMockConfig();
    mockLoadConfig.mockReturnValue({
      config,
      configFile: "/project/lungo.config.json",
    });
    mockSshConnect.mockReturnValue(
      new Observable((observer) => {
        observer.next(mockConn as any);
        observer.complete();
      }),
    );
    mockExecCommand.mockReturnValue(
      new Observable((observer) => {
        observer.next("my-app\n");
        observer.complete();
      }),
    );
    mockListBackups.mockReturnValue(
      new Observable((observer) => {
        observer.next([]);
        observer.complete();
      }),
    );

    await expect(
      rollback.run({ args: defaultArgs }),
    ).rejects.toThrow("No backups found to rollback");
    expect(logger.error).toHaveBeenCalledWith(
      "Rollback failed:",
      "No backups found to rollback",
    );
  });

  it("rejects when specified backup timestamp is not found", async () => {
    const config = createMockConfig();
    mockLoadConfig.mockReturnValue({
      config,
      configFile: "/project/lungo.config.json",
    });
    mockSshConnect.mockReturnValue(
      new Observable((observer) => {
        observer.next(mockConn as any);
        observer.complete();
      }),
    );
    mockExecCommand.mockReturnValue(
      new Observable((observer) => {
        observer.next("my-app\nmy-app.bak.1720000000000\n");
        observer.complete();
      }),
    );
    mockListBackups.mockReturnValue(
      new Observable((observer) => {
        observer.next([
          { filename: "my-app.bak.1720000000000", date: "2024-07-03" },
        ]);
        observer.complete();
      }),
    );

    await expect(
      rollback.run({ args: { ...defaultArgs, to: "9999999999999" } }),
    ).rejects.toThrow("Backup with timestamp \"9999999999999\" not found");
  });

  it("rejects when SSH connection fails", async () => {
    const config = createMockConfig();
    mockLoadConfig.mockReturnValue({
      config,
      configFile: "/project/lungo.config.json",
    });
    mockSshConnect.mockReturnValue(
      new Observable((observer) => {
        observer.error(new Error("SSH timeout"));
      }),
    );

    await expect(rollback.run({ args: defaultArgs })).rejects.toThrow(
      "SSH timeout",
    );
    expect(logger.error).toHaveBeenCalledWith(
      "Rollback failed:",
      "SSH timeout",
    );
  });

  it("rejects when remote exec fails", async () => {
    const config = createMockConfig();
    mockLoadConfig.mockReturnValue({
      config,
      configFile: "/project/lungo.config.json",
    });
    mockSshConnect.mockReturnValue(
      new Observable((observer) => {
        observer.next(mockConn as any);
        observer.complete();
      }),
    );
    mockExecCommand.mockReturnValue(
      new Observable((observer) => {
        observer.error(new Error("Permission denied"));
      }),
    );

    await expect(rollback.run({ args: defaultArgs })).rejects.toThrow(
      "Permission denied",
    );
  });

  it("uses custom config path", async () => {
    const config = createMockConfig();
    mockLoadConfig.mockReturnValue({
      config,
      configFile: "/custom/path.json",
    });
    mockSshConnect.mockReturnValue(
      new Observable((observer) => {
        observer.next(mockConn as any);
        observer.complete();
      }),
    );
    mockExecCommand.mockReturnValue(
      new Observable((observer) => {
        observer.next("my-app\nmy-app.bak.1720000000000\n");
        observer.complete();
      }),
    );
    mockListBackups.mockReturnValue(
      new Observable((observer) => {
        observer.next([
          { filename: "my-app.bak.1720000000000", date: "2024-07-03" },
        ]);
        observer.complete();
      }),
    );

    await rollback.run({
      args: {
        env: "staging",
        config: "custom.config.json",
        to: "latest",
        dryRun: false,
        verbose: false,
      },
    });

    expect(mockLoadConfig).toHaveBeenCalledWith({
      env: "staging",
      configPath: "custom.config.json",
    });
  });

  it("enables verbose mode when --verbose is set", async () => {
    const config = createMockConfig();
    mockLoadConfig.mockReturnValue({
      config,
      configFile: "/project/lungo.config.json",
    });
    mockSshConnect.mockReturnValue(
      new Observable((observer) => {
        observer.next(mockConn as any);
        observer.complete();
      }),
    );
    mockExecCommand.mockReturnValue(
      new Observable((observer) => {
        observer.next("my-app\nmy-app.bak.1720000000000\n");
        observer.complete();
      }),
    );
    mockListBackups.mockReturnValue(
      new Observable((observer) => {
        observer.next([
          { filename: "my-app.bak.1720000000000", date: "2024-07-03" },
        ]);
        observer.complete();
      }),
    );
    const setVerboseSpy = vi.spyOn(
      await import("../../src/utils/logger"),
      "setVerbose",
    );

    await rollback.run({
      args: { ...defaultArgs, verbose: true },
    });

    expect(setVerboseSpy).toHaveBeenCalledWith(true);
  });
});
