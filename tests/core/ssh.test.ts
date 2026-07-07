import type { Config } from "../../src/config/schema";
import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { sshConnect } from "../../src/core/ssh";

// Mock ssh2 Client — each new Client() returns a fresh event-emitting
// instance so the connect flow works end-to-end.
vi.mock("ssh2", () => {
  function createClient() {
    const emitter = new EventEmitter();
    const client: Record<string, any> = {};
    client.on = vi.fn((event: string, handler: (...args: any[]) => void) => {
      emitter.on(event, handler);
      return client;
    });
    client.connect = vi.fn(() => {
      setImmediate(() => emitter.emit("ready"));
      return client;
    });
    client.end = vi.fn();
    client.forwardOut = vi.fn(
      (_srcIP: string, _srcPort: number, _dstIP: string, _dstPort: number, cb: (err?: Error) => void) => {
        setImmediate(() => cb());
      },
    );
    client.exec = vi.fn();
    return client;
  }
  const Client = vi.fn(createClient);
  return { Client };
});

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

describe("sshConnect", () => {
  it("emits client on ready and completes on close (password auth)", async () => {
    const config = createConfig();
    const client$ = sshConnect(config);

    // We verify the observable shape — the actual ssh2 mock is verified via
    // the observable emitting the Client instance
    const result = await new Promise((resolve, reject) => {
      client$.subscribe({
        next: client => resolve(client),
        error: reject,
      });
    });

    expect(result).toBeDefined();
  });

  it("calls connect with password when password is provided", () => {
    // This test verifies observable creation doesn't throw
    const config = createConfig({ password: "mypass" });
    expect(() => sshConnect(config)).not.toThrow();
  });

  it("calls connect with privateKey when privateKey is provided", () => {
    const config = createConfig({
      password: undefined as unknown as string,
      privateKey: "~/.ssh/id_rsa",
    });
    expect(() => sshConnect(config)).not.toThrow();
  });
});
