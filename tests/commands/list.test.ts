import type { Config } from "../../src/config/schema";
import { Observable } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/config/loader");
vi.mock("../../src/core/ssh");
vi.mock("../../src/core/remote-exec");
vi.mock("../../src/services/backup");
vi.mock("console-table-printer", () => {
  const addRows = vi.fn();
  const printTable = vi.fn();
  class MockTable {
    addRows = addRows;
    printTable = printTable;
  }
  return { Table: MockTable, __mockAddRows: addRows, __mockPrintTable: printTable };
});

import { loadConfig } from "../../src/config/loader";
import { list } from "../../src/commands/list";
import { execCommand } from "../../src/core/remote-exec";
import { sshConnect } from "../../src/core/ssh";
import { listBackups } from "../../src/services/backup";
import { logger } from "../../src/utils/logger";

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
};

describe("list command", () => {
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
  });

  afterEach(() => {
    exitSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it("exits with error when --env is not provided", async () => {
    await expect(
      list.run({ args: { ...defaultArgs, env: undefined } }),
    ).rejects.toThrow("process.exit");

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(logger.error).toHaveBeenCalledWith(
      "--env is required. Usage: lungo list --env production",
    );
  });

  it("lists backups in a table on success", async () => {
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
          { filename: "my-app.bak.1720000000000", date: "2024-07-03 12:00:00" },
        ]);
        observer.complete();
      }),
    );

    await list.run({ args: defaultArgs });

    expect(mockLoadConfig).toHaveBeenCalledWith({
      env: "production",
      config: undefined,
    });
    expect(mockSshConnect).toHaveBeenCalledWith(config);
    expect(mockExecCommand).toHaveBeenCalledWith(mockConn, "ls /var/www");
    expect(mockListBackups).toHaveBeenCalledWith(
      "my-app\nmy-app.bak.1720000000000\n",
      "my-app",
    );
    expect(mockConn.end).toHaveBeenCalled();
  });

  it("logs 'No backups found' when backup list is empty", async () => {
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

    await list.run({ args: defaultArgs });

    expect(logger.info).toHaveBeenCalledWith("No backups found");
  });

  it("rejects when SSH connection fails", async () => {
    const config = createMockConfig();
    mockLoadConfig.mockReturnValue({
      config,
      configFile: "/project/lungo.config.json",
    });
    mockSshConnect.mockReturnValue(
      new Observable((observer) => {
        observer.error(new Error("Connection refused"));
      }),
    );

    await expect(list.run({ args: defaultArgs })).rejects.toThrow(
      "Connection refused",
    );
    expect(logger.error).toHaveBeenCalledWith(
      "List failed:",
      "Connection refused",
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

    await expect(list.run({ args: defaultArgs })).rejects.toThrow(
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
        observer.next("");
        observer.complete();
      }),
    );
    mockListBackups.mockReturnValue(
      new Observable((observer) => {
        observer.next([]);
        observer.complete();
      }),
    );

    await list.run({
      args: { env: "staging", config: "custom.config.json" },
    });

    expect(mockLoadConfig).toHaveBeenCalledWith({
      env: "staging",
      configPath: "custom.config.json",
    });
  });
});
