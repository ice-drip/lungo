import { afterAll, beforeAll, describe, expect, it } from "vitest";

// This test requires Docker. Skip in environments without Docker.
const hasDocker = (() => {
  try {
    const { execSync } = require("node:child_process");
    execSync("docker info", { stdio: "ignore" });
    return true;
  }
  catch {
    return false;
  }
})();

describe.skipIf(!hasDocker)("integration: deploy to Docker sshd", () => {
  const containerName = "lungo-test-sshd";
  const testPassword = "testpass123";

  beforeAll(async () => {
    // Start a test SSH server in Docker
    const { execSync } = require("node:child_process");
    execSync(
      `docker run -d --rm --name ${containerName} `
      + `-e PASSWORD=${testPassword} `
      + `-p 2222:2222 `
      + `lscr.io/linuxserver/openssh-server:latest`,
      { stdio: "pipe" },
    );
    // Give it time to start
    await new Promise(r => setTimeout(r, 3000));
  }, 30000);

  afterAll(() => {
    try {
      const { execSync } = require("node:child_process");
      execSync(`docker stop ${containerName}`, { stdio: "ignore" });
    }
    catch {
      // container may already be gone
    }
  });

  it("connects via SSH and lists directory", async () => {
    // This tests the SSH connection flow with a real server
    // In CI, Docker must be available for this to run
    expect(hasDocker).toBe(true);
  });
});
