import type { Config } from "../../src/config/schema";
import type { DeployOptions } from "../../src/services/pipeline";
import { Subject, of, throwError } from "rxjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { runDeploy } from "../../src/services/pipeline";

// ── Mocks ──────────────────────────────────────────────────────────

vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
}));

vi.mock("../../src/core/ssh", () => ({
  sshConnect: vi.fn(),
}));

vi.mock("../../src/core/remote-exec", () => ({
  execCommand: vi.fn(),
}));

vi.mock("../../src/core/sftp", () => ({
  sftpUpload: vi.fn(),
}));

vi.mock("../../src/services/backup", () => ({
  backupCurrent: vi.fn(),
  cleanupBackups: vi.fn(),
  listBackups: vi.fn(),
}));

// ── Imports (after mocks) ──────────────────────────────────────────

import { execSync } from "node:child_process";
import { sshConnect } from "../../src/core/ssh";
import { execCommand } from "../../src/core/remote-exec";
import { sftpUpload } from "../../src/core/sftp";
import { backupCurrent, cleanupBackups, listBackups } from "../../src/services/backup";

// ── Helpers ────────────────────────────────────────────────────────

function createConfig(overrides: Partial<Config> = {}): Config {
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

const mockConn = { end: vi.fn() } as any;

/** Set up all mocks for a full successful pipeline run. */
function setupFullPipelineMocks() {
  vi.mocked(sshConnect).mockReturnValue(of(mockConn));

  // Step 2: ls output
  vi.mocked(execCommand).mockImplementation((_conn: any, cmd: string) => {
    if (cmd.startsWith("ls "))
      return of("my-app\nindex.html\n");
    return of("");
  });

  // Step 2b: listBackups
  vi.mocked(listBackups).mockReturnValue(of([]));

  // Step 3: cleanupBackups
  vi.mocked(cleanupBackups).mockReturnValue(of("echo \"no backups to clean\""));

  // Step 5: backupCurrent
  vi.mocked(backupCurrent).mockReturnValue(of("echo \"backup done\""));

  // Step 7: sftpUpload
  vi.mocked(sftpUpload).mockReturnValue(of({
    command: "unzip -o /var/www/my-app-deploy.zip -d /var/www/my-app",
    del: "rm -r /var/www/my-app-deploy.zip",
  }));
}

// ── Tests ──────────────────────────────────────────────────────────

describe("runDeploy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupFullPipelineMocks();
  });

  // ── dry-run ──

  describe("dry-run mode", () => {
    it("returns immediately without calling any dependencies", async () => {
      const config = createConfig();
      const options: DeployOptions = { config, dryRun: true };

      await new Promise<void>((resolve) => {
        runDeploy(options).subscribe({
          next: () => resolve(),
          error: (err) => { throw err; },
        });
      });

      expect(sshConnect).not.toHaveBeenCalled();
      expect(execCommand).not.toHaveBeenCalled();
      expect(sftpUpload).not.toHaveBeenCalled();
      expect(execSync).not.toHaveBeenCalled();
    });

    it("completes the observable in dry-run mode", async () => {
      const config = createConfig();
      let completed = false;

      await new Promise<void>((resolve) => {
        runDeploy({ config, dryRun: true }).subscribe({
          next: () => {},
          complete: () => {
            completed = true;
            resolve();
          },
        });
      });

      expect(completed).toBe(true);
    });
  });

  // ── preDeploy hook ──

  describe("preDeploy hook", () => {
    it("runs execSync with preDeploy command when set", () => {
      const config = createConfig({ preDeploy: "npm run build" });

      runDeploy({ config });

      expect(execSync).toHaveBeenCalledWith("npm run build", {
        cwd: process.cwd(),
        stdio: "inherit",
      });
    });

    it("does not call execSync when preDeploy is not set", () => {
      const config = createConfig();

      runDeploy({ config });

      expect(execSync).not.toHaveBeenCalled();
    });
  });

  // ── Full pipeline ──

  describe("full pipeline", () => {
    it("completes the full deploy pipeline successfully", async () => {
      const config = createConfig();
      let completed = false;

      await new Promise<void>((resolve, reject) => {
        runDeploy({ config }).subscribe({
          next: () => {},
          complete: () => {
            completed = true;
            resolve();
          },
          error: reject,
        });
      });

      expect(completed).toBe(true);
    });

    it("calls sshConnect with the config", async () => {
      const config = createConfig();

      await new Promise<void>((resolve, reject) => {
        runDeploy({ config }).subscribe({
          complete: resolve,
          error: reject,
        });
      });

      expect(sshConnect).toHaveBeenCalledWith(config);
    });

    it("lists directory contents via execCommand", async () => {
      const config = createConfig();

      await new Promise<void>((resolve, reject) => {
        runDeploy({ config }).subscribe({
          complete: resolve,
          error: reject,
        });
      });

      expect(execCommand).toHaveBeenCalledWith(mockConn, "ls /var/www");
    });

    it("calls listBackups with ls output and project name", async () => {
      const config = createConfig();

      await new Promise<void>((resolve, reject) => {
        runDeploy({ config }).subscribe({
          complete: resolve,
          error: reject,
        });
      });

      // Pipeline does output.split("\n").filter(Boolean).join("\n"), stripping trailing newline
      expect(listBackups).toHaveBeenCalledWith("my-app\nindex.html", "my-app");
    });

    it("calls cleanupBackups with config and backups", async () => {
      const config = createConfig();
      const fakeBackups = [{ filename: "my-app.bak.1234567890123", date: "2024-01-01" }];
      vi.mocked(listBackups).mockReturnValue(of(fakeBackups));

      await new Promise<void>((resolve, reject) => {
        runDeploy({ config }).subscribe({
          complete: resolve,
          error: reject,
        });
      });

      expect(cleanupBackups).toHaveBeenCalledWith(config, fakeBackups);
    });

    it("executes the cleanup command via execCommand", async () => {
      const config = createConfig();
      vi.mocked(cleanupBackups).mockReturnValue(of("rm -r /var/www/old-backup"));

      await new Promise<void>((resolve, reject) => {
        runDeploy({ config }).subscribe({
          complete: resolve,
          error: reject,
        });
      });

      expect(execCommand).toHaveBeenCalledWith(mockConn, "rm -r /var/www/old-backup");
    });

    it("calls backupCurrent and executes the backup command", async () => {
      const config = createConfig();
      const dirContents = ["my-app", "index.html"];

      // Override execCommand to return dirContents for the ls command
      vi.mocked(execCommand).mockImplementation((_conn: any, cmd: string) => {
        if (cmd.startsWith("ls "))
          return of(dirContents.join("\n"));
        // cleanup and backup exec
        return of("");
      });

      await new Promise<void>((resolve, reject) => {
        runDeploy({ config }).subscribe({
          complete: resolve,
          error: reject,
        });
      });

      expect(backupCurrent).toHaveBeenCalledWith(dirContents, config);
    });

    it("calls sftpUpload with config, conn, and cwd", async () => {
      const config = createConfig();

      await new Promise<void>((resolve, reject) => {
        runDeploy({ config }).subscribe({
          complete: resolve,
          error: reject,
        });
      });

      expect(sftpUpload).toHaveBeenCalledWith(config, mockConn, process.cwd());
    });

    it("executes the unzip and delete commands from sftpUpload", async () => {
      const config = createConfig();
      vi.mocked(sftpUpload).mockReturnValue(of({
        command: "unzip -o /var/www/my-app-deploy.zip -d /var/www/my-app",
        del: "rm -r /var/www/my-app-deploy.zip",
      }));

      await new Promise<void>((resolve, reject) => {
        runDeploy({ config }).subscribe({
          complete: resolve,
          error: reject,
        });
      });

      // execCommand should have been called with the unzip command and the rm command
      const execCalls = vi.mocked(execCommand).mock.calls;
      const unzipCall = execCalls.find(c => c[1] === "unzip -o /var/www/my-app-deploy.zip -d /var/www/my-app");
      const rmCall = execCalls.find(c => c[1] === "rm -r /var/www/my-app-deploy.zip");
      expect(unzipCall).toBeDefined();
      expect(rmCall).toBeDefined();
    });

    it("calls conn.end() after deploy completes", async () => {
      const config = createConfig();

      await new Promise<void>((resolve, reject) => {
        runDeploy({ config }).subscribe({
          complete: resolve,
          error: reject,
        });
      });

      expect(mockConn.end).toHaveBeenCalled();
    });
  });

  // ── postDeploy hook ──

  describe("postDeploy hook", () => {
    it("executes postDeploy command on the remote server", async () => {
      const config = createConfig({ postDeploy: "pm2 restart app" });

      await new Promise<void>((resolve, reject) => {
        runDeploy({ config }).subscribe({
          complete: resolve,
          error: reject,
        });
      });

      const execCalls = vi.mocked(execCommand).mock.calls;
      const postDeployCall = execCalls.find(c => c[1] === "pm2 restart app");
      expect(postDeployCall).toBeDefined();
    });

    it("skips postDeploy when not configured", async () => {
      const config = createConfig();

      await new Promise<void>((resolve, reject) => {
        runDeploy({ config }).subscribe({
          complete: resolve,
          error: reject,
        });
      });

      // Only ls, cleanup, backup, unzip, rm — no extra command
      const execCalls = vi.mocked(execCommand).mock.calls;
      expect(execCalls.every(c => c[1] !== "pm2 restart app")).toBe(true);
    });
  });

  // ── noBackup flag ──

  describe("noBackup flag", () => {
    it("skips backupCurrent when noBackup is true", async () => {
      const config = createConfig();

      await new Promise<void>((resolve, reject) => {
        runDeploy({ config, noBackup: true }).subscribe({
          complete: resolve,
          error: reject,
        });
      });

      expect(backupCurrent).not.toHaveBeenCalled();
    });

    it("still executes a command (echo) when backup is skipped", async () => {
      const config = createConfig();

      await new Promise<void>((resolve, reject) => {
        runDeploy({ config, noBackup: true }).subscribe({
          complete: resolve,
          error: reject,
        });
      });

      const execCalls = vi.mocked(execCommand).mock.calls;
      const skipCall = execCalls.find(c => c[1] === 'echo "backup skipped"');
      expect(skipCall).toBeDefined();
    });
  });

  // ── noCleanup flag ──

  describe("noCleanup flag", () => {
    it("skips cleanupBackups when noCleanup is true", async () => {
      const config = createConfig();

      await new Promise<void>((resolve, reject) => {
        runDeploy({ config, noCleanup: true }).subscribe({
          complete: resolve,
          error: reject,
        });
      });

      expect(cleanupBackups).not.toHaveBeenCalled();
    });

    it("still completes the pipeline when cleanup is skipped", async () => {
      const config = createConfig();
      let completed = false;

      await new Promise<void>((resolve, reject) => {
        runDeploy({ config, noCleanup: true }).subscribe({
          complete: () => {
            completed = true;
            resolve();
          },
          error: reject,
        });
      });

      expect(completed).toBe(true);
    });
  });

  // ── Both noBackup and noCleanup ──

  describe("noBackup + noCleanup", () => {
    it("skips both backup and cleanup, still completes", async () => {
      const config = createConfig();
      let completed = false;

      await new Promise<void>((resolve, reject) => {
        runDeploy({ config, noBackup: true, noCleanup: true }).subscribe({
          complete: () => {
            completed = true;
            resolve();
          },
          error: reject,
        });
      });

      expect(completed).toBe(true);
      expect(backupCurrent).not.toHaveBeenCalled();
      expect(cleanupBackups).not.toHaveBeenCalled();
    });
  });

  // ── Error propagation ──

  describe("error propagation", () => {
    it("propagates sshConnect errors", async () => {
      vi.mocked(sshConnect).mockReturnValue(throwError(() => new Error("SSH failed")));

      const config = createConfig();

      await new Promise<void>((resolve) => {
        runDeploy({ config }).subscribe({
          error: (err) => {
            expect(err.message).toBe("SSH failed");
            resolve();
          },
        });
      });
    });

    it("propagates sftpUpload errors", async () => {
      vi.mocked(sftpUpload).mockReturnValue(throwError(() => new Error("Upload failed")));

      const config = createConfig();

      await new Promise<void>((resolve) => {
        runDeploy({ config }).subscribe({
          error: (err) => {
            expect(err.message).toBe("Upload failed");
            resolve();
          },
        });
      });
    });

    it("propagates execCommand errors during ls", async () => {
      vi.mocked(execCommand).mockImplementation((_conn: any, cmd: string) => {
        if (cmd.startsWith("ls "))
          return throwError(() => new Error("ls failed"));
        return of("");
      });

      const config = createConfig();

      await new Promise<void>((resolve) => {
        runDeploy({ config }).subscribe({
          error: (err) => {
            expect(err.message).toBe("ls failed");
            resolve();
          },
        });
      });
    });
  });

  // ── Cleanup with actual delete command ──

  describe("cleanup execution", () => {
    it("executes cleanup command when cleanupBackups returns a non-echo command", async () => {
      const config = createConfig();
      vi.mocked(cleanupBackups).mockReturnValue(of("rm -r /var/www/old1 /var/www/old2"));

      await new Promise<void>((resolve, reject) => {
        runDeploy({ config }).subscribe({
          complete: resolve,
          error: reject,
        });
      });

      const execCalls = vi.mocked(execCommand).mock.calls;
      const cleanupExec = execCalls.find(c => c[1] === "rm -r /var/www/old1 /var/www/old2");
      expect(cleanupExec).toBeDefined();
    });
  });
});
