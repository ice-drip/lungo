import type { Client } from "ssh2";
import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { execCommand } from "../../src/core/remote-exec";

vi.mock("ssh2");

describe("execCommand", () => {
  it("returns stdout from command execution", async () => {
    const mockClient = {
      exec: vi.fn((cmd, cb) => {
        const stream = new EventEmitter() as any;
        stream.destroy = vi.fn();
        setImmediate(() => {
          stream.emit("data", "file1\nfile2");
          stream.emit("close");
        });
        cb(null, stream);
      }),
    } as unknown as Client;

    const result = await new Promise<string>((resolve, reject) => {
      execCommand(mockClient, "ls /var/www").subscribe({
        next: resolve,
        error: reject,
      });
    });

    expect(result).toBe("file1\nfile2");
  });

  it("throws on exec error", async () => {
    const mockClient = {
      exec: vi.fn((cmd, cb) => {
        cb(new Error("Command failed"), undefined as any);
      }),
    } as unknown as Client;

    await new Promise<void>((resolve) => {
      execCommand(mockClient, "bad-command").subscribe({
        error: (err) => {
          expect(err.message).toBe("Command failed");
          resolve();
        },
      });
    });
  });
});
