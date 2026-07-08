import type { Config } from "../../src/config/schema";
import { Observable } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deploy } from "../../src/commands/deploy";
import { loadConfig } from "../../src/config/loader";
import { sendNotification } from "../../src/services/notify";
import { runDeploy } from "../../src/services/pipeline";
import { logger, setVerbose } from "../../src/utils/logger";

vi.mock("../../src/config/loader");
vi.mock("../../src/services/pipeline");
vi.mock("../../src/services/notify");
vi.mock("../../src/utils/logger");

const mockSetVerbose = vi.mocked(setVerbose);
const mockLoadConfig = vi.mocked(loadConfig);
const mockRunDeploy = vi.mocked(runDeploy);
const mockSendNotification = vi.mocked(sendNotification);

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
  dryRun: false,
  verbose: false,
  noBackup: false,
  noCleanup: false,
};

describe("deploy command", () => {
  let exitSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process.exit");
    }) as any);
    vi.spyOn(logger, "info").mockImplementation(() => {});
    vi.spyOn(logger, "error").mockImplementation(() => {});
    vi.spyOn(logger, "success").mockImplementation(() => {});
    vi.spyOn(logger, "debug").mockImplementation(() => {});
    mockLoadConfig.mockReturnValue({
      config: createMockConfig(),
      configFile: "/project/lungo.config.json",
    });
  });

  afterEach(() => {
    exitSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it("exits with error when --env is not provided", async () => {
    await expect(
      deploy.run({ args: { ...defaultArgs, env: undefined } }),
    ).rejects.toThrow("process.exit");

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(logger.error).toHaveBeenCalledWith(
      "--env is required. Usage: lungo deploy --env production",
    );
  });

  it("loads config for the specified environment", async () => {
    mockRunDeploy.mockReturnValue(
      new Observable((observer) => {
        observer.next();
        observer.complete();
      }),
    );

    await deploy.run({ args: { ...defaultArgs, env: "staging" } });

    expect(mockLoadConfig).toHaveBeenCalledWith({
      env: "staging",
      configPath: undefined,
    });
  });

  it("uses custom config path when --config is provided", async () => {
    mockRunDeploy.mockReturnValue(
      new Observable((observer) => {
        observer.next();
        observer.complete();
      }),
    );

    await deploy.run({
      args: { ...defaultArgs, config: "custom.config.json" },
    });

    expect(mockLoadConfig).toHaveBeenCalledWith({
      env: "production",
      configPath: "custom.config.json",
    });
  });

  it("sends success notification on successful deploy", async () => {
    const config = createMockConfig();
    mockLoadConfig.mockReturnValue({
      config,
      configFile: "/project/lungo.config.json",
    });
    mockRunDeploy.mockReturnValue(
      new Observable((observer) => {
        observer.next();
        observer.complete();
      }),
    );

    await deploy.run({ args: defaultArgs });

    expect(mockSendNotification).toHaveBeenCalledWith(
      config,
      true,
      "Deploy successful",
    );
  });

  it("sends failure notification and rejects on deploy error", async () => {
    const config = createMockConfig();
    mockLoadConfig.mockReturnValue({
      config,
      configFile: "/project/lungo.config.json",
    });
    const deployError = new Error("SSH connection refused");
    mockRunDeploy.mockReturnValue(
      new Observable((observer) => {
        observer.error(deployError);
      }),
    );

    await expect(deploy.run({ args: defaultArgs })).rejects.toThrow(
      "SSH connection refused",
    );
    expect(mockSendNotification).toHaveBeenCalledWith(
      config,
      false,
      "SSH connection refused",
    );
  });

  it("passes dryRun option to runDeploy", async () => {
    mockRunDeploy.mockReturnValue(
      new Observable((observer) => {
        observer.next();
        observer.complete();
      }),
    );

    await deploy.run({ args: { ...defaultArgs, dryRun: true } });

    expect(mockRunDeploy).toHaveBeenCalledWith(
      expect.objectContaining({ dryRun: true }),
    );
  });

  it("passes noBackup option to runDeploy", async () => {
    mockRunDeploy.mockReturnValue(
      new Observable((observer) => {
        observer.next();
        observer.complete();
      }),
    );

    await deploy.run({ args: { ...defaultArgs, noBackup: true } });

    expect(mockRunDeploy).toHaveBeenCalledWith(
      expect.objectContaining({ noBackup: true }),
    );
  });

  it("passes noCleanup option to runDeploy", async () => {
    mockRunDeploy.mockReturnValue(
      new Observable((observer) => {
        observer.next();
        observer.complete();
      }),
    );

    await deploy.run({ args: { ...defaultArgs, noCleanup: true } });

    expect(mockRunDeploy).toHaveBeenCalledWith(
      expect.objectContaining({ noCleanup: true }),
    );
  });

  it("enables verbose mode when --verbose is set", async () => {
    mockRunDeploy.mockReturnValue(
      new Observable((observer) => {
        observer.next();
        observer.complete();
      }),
    );

    await deploy.run({ args: { ...defaultArgs, verbose: true } });

    expect(mockSetVerbose).toHaveBeenCalledWith(true);
  });

  it("logs target info on successful config load", async () => {
    const config = createMockConfig({
      host: "192.168.1.100",
      port: 2222,
      serverDir: "/opt/apps",
      project: "web-app",
    });
    mockLoadConfig.mockReturnValue({
      config,
      configFile: "/project/lungo.config.json",
    });
    mockRunDeploy.mockReturnValue(
      new Observable((observer) => {
        observer.next();
        observer.complete();
      }),
    );

    await deploy.run({ args: defaultArgs });

    expect(logger.info).toHaveBeenCalledWith(
      "Target: 192.168.1.100:2222 -> /opt/apps/web-app",
    );
  });

  it("calls runDeploy with the loaded config", async () => {
    const config = createMockConfig();
    mockLoadConfig.mockReturnValue({
      config,
      configFile: "/project/lungo.config.json",
    });
    mockRunDeploy.mockReturnValue(
      new Observable((observer) => {
        observer.next();
        observer.complete();
      }),
    );

    await deploy.run({ args: defaultArgs });

    expect(mockRunDeploy).toHaveBeenCalledWith({
      config,
      dryRun: false,
      noBackup: false,
      noCleanup: false,
    });
  });
});
