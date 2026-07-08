import type { Config } from "../../src/config/schema";
import { EventEmitter } from "node:events";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Track all Client instances created during each test
let clientInstances: any[] = [];

// Configurable behaviors for the mock
let mockBehavior: {
  emitError?: boolean;
  forwardOutError?: Error;
} = {};

vi.mock("ssh2", () => {
  function createClient() {
    const emitter = new EventEmitter();
    const client: Record<string, any> = {};
    client.on = vi.fn((event: string, handler: (...args: any[]) => void) => {
      emitter.on(event, handler);
      return client;
    });
    client.connect = vi.fn(() => {
      if (mockBehavior.emitError) {
        setImmediate(() => emitter.emit("error", mockBehavior.emitError));
      } else {
        setImmediate(() => emitter.emit("ready"));
      }
      return client;
    });
    client.end = vi.fn();
    client.forwardOut = vi.fn(
      (_srcIP: string, _srcPort: number, _dstIP: string, _dstPort: number, cb: (err?: Error, stream?: any) => void) => {
        if (mockBehavior.forwardOutError) {
          setImmediate(() => cb(mockBehavior.forwardOutError));
        } else {
          const stream = new EventEmitter();
          setImmediate(() => cb(undefined, stream));
        }
      },
    );
    client.exec = vi.fn();
    clientInstances.push(client);
    return client;
  }
  const Client = vi.fn(createClient);
  return { Client };
});

vi.mock("node:fs", async () => {
  const actual = await vi.importActual<typeof fs>("node:fs");
  return {
    ...actual,
    readFileSync: vi.fn().mockReturnValue("mock-key-content"),
  };
});

// Import AFTER mocks are set up
import { sshConnect } from "../../src/core/ssh";

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
  beforeEach(() => {
    clientInstances = [];
    mockBehavior = {};
    vi.clearAllMocks();
    vi.mocked(fs.readFileSync).mockReturnValue("mock-key-content");
  });

  describe("buildConnectConfig (password auth)", () => {
    it("passes host, port, username, password to connect()", async () => {
      const config = createConfig({ password: "mypass" });

      await new Promise<void>((resolve) => {
        sshConnect(config).subscribe({
          next: () => resolve(),
          error: (err) => { throw err; },
        });
      });

      const connectArgs = clientInstances[0].connect.mock.calls[0][0];
      expect(connectArgs.host).toBe("10.0.0.1");
      expect(connectArgs.port).toBe(22);
      expect(connectArgs.username).toBe("deploy");
      expect(connectArgs.password).toBe("mypass");
      expect(connectArgs.privateKey).toBeUndefined();
    });

    it("omits password when neither password nor privateKey is set", async () => {
      const config = createConfig({
        password: undefined as unknown as string,
        privateKey: undefined,
      });

      await new Promise<void>((resolve) => {
        sshConnect(config).subscribe({
          next: () => resolve(),
          error: (err) => { throw err; },
        });
      });

      const connectArgs = clientInstances[0].connect.mock.calls[0][0];
      expect(connectArgs.password).toBeUndefined();
      expect(connectArgs.privateKey).toBeUndefined();
    });
  });

  describe("buildConnectConfig (privateKey auth)", () => {
    it("reads private key from absolute path and sets privateKey", async () => {
      const config = createConfig({
        password: undefined as unknown as string,
        privateKey: "/home/user/.ssh/id_rsa",
      });

      await new Promise<void>((resolve) => {
        sshConnect(config).subscribe({
          next: () => resolve(),
          error: (err) => { throw err; },
        });
      });

      const readFileSyncMock = vi.mocked(fs.readFileSync);
      expect(readFileSyncMock).toHaveBeenCalledWith(
        path.resolve("/home/user/.ssh/id_rsa"),
        "utf-8",
      );

      const connectArgs = clientInstances[0].connect.mock.calls[0][0];
      expect(connectArgs.privateKey).toBe("mock-key-content");
      expect(connectArgs.password).toBeUndefined();
    });

    it("expands ~ to homedir for privateKey path", async () => {
      const config = createConfig({
        password: undefined as unknown as string,
        privateKey: "~/.ssh/id_rsa",
      });

      await new Promise<void>((resolve) => {
        sshConnect(config).subscribe({
          next: () => resolve(),
          error: (err) => { throw err; },
        });
      });

      const readFileSyncMock = vi.mocked(fs.readFileSync);
      const expectedPath = path.resolve(os.homedir(), ".ssh/id_rsa");
      expect(readFileSyncMock).toHaveBeenCalledWith(expectedPath, "utf-8");

      const connectArgs = clientInstances[0].connect.mock.calls[0][0];
      expect(connectArgs.privateKey).toBe("mock-key-content");
    });

    it("sets passphrase when privateKey and passphrase are provided", async () => {
      const config = createConfig({
        password: undefined as unknown as string,
        privateKey: "/home/user/.ssh/id_rsa",
        passphrase: "keypass",
      });

      await new Promise<void>((resolve) => {
        sshConnect(config).subscribe({
          next: () => resolve(),
          error: (err) => { throw err; },
        });
      });

      const connectArgs = clientInstances[0].connect.mock.calls[0][0];
      expect(connectArgs.privateKey).toBe("mock-key-content");
      expect(connectArgs.passphrase).toBe("keypass");
    });

    it("does not set passphrase when only privateKey is provided", async () => {
      const config = createConfig({
        password: undefined as unknown as string,
        privateKey: "/home/user/.ssh/id_rsa",
      });

      await new Promise<void>((resolve) => {
        sshConnect(config).subscribe({
          next: () => resolve(),
          error: (err) => { throw err; },
        });
      });

      const connectArgs = clientInstances[0].connect.mock.calls[0][0];
      expect(connectArgs.passphrase).toBeUndefined();
    });
  });

  describe("buildConnectConfig (priority)", () => {
    it("prefers privateKey over password when both are provided", async () => {
      const config = createConfig({
        password: "mypassword",
        privateKey: "/home/user/.ssh/id_rsa",
      });

      await new Promise<void>((resolve) => {
        sshConnect(config).subscribe({
          next: () => resolve(),
          error: (err) => { throw err; },
        });
      });

      const connectArgs = clientInstances[0].connect.mock.calls[0][0];
      expect(connectArgs.privateKey).toBe("mock-key-content");
      expect(connectArgs.password).toBeUndefined();
    });
  });

  describe("forward/bastion connection", () => {
    it("connects via bastion when forward config is set", async () => {
      const config = createConfig({
        password: undefined as unknown as string,
        privateKey: "/home/user/.ssh/id_rsa",
        forward: {
          host: "bastion.example.com",
          port: 2222,
          username: "bastion-user",
          password: "bastion-pass",
          forwardHost: "127.0.0.1",
          forwardPort: 0,
        },
      });

      await new Promise<void>((resolve) => {
        sshConnect(config).subscribe({
          next: () => resolve(),
          error: (err) => { throw err; },
        });
      });

      // Two Client instances: [0] = conn (target), [1] = forward (bastion)
      // because sshConnect creates `conn` first, then `forward`
      expect(clientInstances).toHaveLength(2);

      // Bastion (forward) client — index [1]
      const bastionConnectArgs = clientInstances[1].connect.mock.calls[0][0];
      expect(bastionConnectArgs.host).toBe("bastion.example.com");
      expect(bastionConnectArgs.port).toBe(2222);
      expect(bastionConnectArgs.username).toBe("bastion-user");
      expect(bastionConnectArgs.password).toBe("bastion-pass");

      // forwardOut was called on the bastion client with correct params
      const forwardOutArgs = clientInstances[1].forwardOut.mock.calls[0];
      expect(forwardOutArgs[0]).toBe("127.0.0.1");
      expect(forwardOutArgs[1]).toBe(0);
      expect(forwardOutArgs[2]).toBe("10.0.0.1");
      expect(forwardOutArgs[3]).toBe(22);

      // Target client — index [0] — connects with sock from forwardOut stream
      const targetConnectArgs = clientInstances[0].connect.mock.calls[0][0];
      expect(targetConnectArgs.sock).toBeDefined();
      expect(targetConnectArgs.privateKey).toBe("mock-key-content");
    });

    it("builds forward connect config with privateKey auth for bastion", async () => {
      vi.mocked(fs.readFileSync).mockReturnValue("mock-bastion-key");

      const config = createConfig({
        password: "target-pass",
        forward: {
          host: "bastion.example.com",
          port: 22,
          username: "bastion-user",
          privateKey: "~/.ssh/bastion_key",
          passphrase: "bp",
          forwardHost: "127.0.0.1",
          forwardPort: 0,
        },
      });

      await new Promise<void>((resolve) => {
        sshConnect(config).subscribe({
          next: () => resolve(),
          error: (err) => { throw err; },
        });
      });

      // Bastion (forward) client — index [1]
      const bastionConnectArgs = clientInstances[1].connect.mock.calls[0][0];
      expect(bastionConnectArgs.privateKey).toBe("mock-bastion-key");
      expect(bastionConnectArgs.passphrase).toBe("bp");
      expect(bastionConnectArgs.password).toBeUndefined();

      // Key was read from expanded path
      const expectedPath = path.resolve(os.homedir(), ".ssh/bastion_key");
      expect(vi.mocked(fs.readFileSync)).toHaveBeenCalledWith(expectedPath, "utf-8");
    });

    it("propagates forwardOut error to the observable", async () => {
      mockBehavior.forwardOutError = new Error("forward failed");

      const config = createConfig({
        password: undefined as unknown as string,
        privateKey: "/key",
        forward: {
          host: "bastion.example.com",
          port: 22,
          username: "user",
          password: "pass",
          forwardHost: "127.0.0.1",
          forwardPort: 0,
        },
      });

      await new Promise<void>((resolve) => {
        sshConnect(config).subscribe({
          next: () => { throw new Error("should not succeed"); },
          error: (err) => {
            expect(err.message).toBe("forward failed");
            resolve();
          },
        });
      });
    });
  });

  describe("observable lifecycle", () => {
    it("emits client on ready", async () => {
      const config = createConfig();

      const result = await new Promise<any>((resolve, reject) => {
        sshConnect(config).subscribe({
          next: resolve,
          error: reject,
        });
      });

      expect(result).toBeDefined();
    });

    it("emits error when connection fails", async () => {
      mockBehavior.emitError = new Error("Connection refused");

      const config = createConfig();

      await new Promise<void>((resolve) => {
        sshConnect(config).subscribe({
          next: () => { throw new Error("should not emit next"); },
          error: (err) => {
            expect(err.message).toBe("Connection refused");
            resolve();
          },
        });
      });
    });

    it("calls end on client when unsubscribed (direct path)", async () => {
      const config = createConfig();

      const sub = sshConnect(config).subscribe({
        next: () => {},
        error: () => {},
      });

      sub.unsubscribe();

      expect(clientInstances[0].end).toHaveBeenCalled();
    });

    it("calls end on both clients when unsubscribed (forward path)", async () => {
      const config = createConfig({
        password: undefined as unknown as string,
        privateKey: "/key",
        forward: {
          host: "bastion.example.com",
          port: 22,
          username: "user",
          password: "pass",
          forwardHost: "127.0.0.1",
          forwardPort: 0,
        },
      });

      const sub = sshConnect(config).subscribe({
        next: () => {},
        error: () => {},
      });

      // Unsubscribe immediately — triggers cleanup which calls end() on both
      sub.unsubscribe();

      // [0] = conn, [1] = forward
      expect(clientInstances[0].end).toHaveBeenCalled();
      expect(clientInstances[1].end).toHaveBeenCalled();
    });
  });
});
