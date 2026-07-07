import type { Config } from "../../src/config/schema";
import type { DeployOptions } from "../../src/services/pipeline";
import { describe, expect, it } from "vitest";
import { runDeploy } from "../../src/services/pipeline";

function createConfig(): Config {
  return {
    serverDir: "/var/www",
    host: "10.0.0.1",
    port: 22,
    username: "deploy",
    password: "secret",
    project: "my-app",
    dist: "dist",
  };
}

describe("runDeploy", () => {
  it("returns immediately in dry-run mode", async () => {
    const config = createConfig();
    const options: DeployOptions = { config, dryRun: true };

    const result = await new Promise<void>((resolve) => {
      runDeploy(options).subscribe({
        next: () => resolve(),
        error: (err) => {
          throw err;
        },
      });
    });

    expect(result).toBeUndefined();
  });

  it("does not throw on observable creation (non-dry-run)", () => {
    const config = createConfig();
    const options: DeployOptions = { config };

    // Should not throw when creating the observable (though it will fail
    // at runtime without a real SSH server)
    expect(() => runDeploy(options)).not.toThrow();
  });
});
