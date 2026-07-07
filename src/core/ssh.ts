import type { ConnectConfig } from "ssh2";
import type { Config } from "../config/schema";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { Observable } from "rxjs";
import { Client } from "ssh2";
import { logger } from "../utils/logger";

function buildConnectConfig(config: Config): ConnectConfig {
  const connectConfig: ConnectConfig = {
    host: config.host,
    port: config.port,
    username: config.username,
  };

  if (config.privateKey) {
    const keyPath = config.privateKey.startsWith("~")
      ? resolve(homedir(), config.privateKey.slice(2))
      : resolve(config.privateKey);
    connectConfig.privateKey = readFileSync(keyPath, "utf-8");
    if (config.passphrase) {
      connectConfig.passphrase = config.passphrase;
    }
    logger.debug("Using SSH private key authentication");
  }
  else if (config.password) {
    connectConfig.password = config.password;
    logger.debug("Using SSH password authentication");
  }

  return connectConfig;
}

export function sshConnect(config: Config): Observable<Client> {
  return new Observable<Client>((observer) => {
    const conn = new Client();
    let forward: Client | undefined;

    if (config.forward) {
      const fwdConfig = config.forward;
      forward = new Client();
      forward
        .on("ready", () => {
          logger.debug("Bastion connected, forwarding to target");
          forward!.forwardOut(
            fwdConfig.forwardHost,
            fwdConfig.forwardPort,
            config.host,
            config.port,
            (err, stream) => {
              if (err) {
                logger.error(`Bastion forward error: ${err.message}`);
                observer.error(err);
                forward!.end();
                return;
              }
              conn
                .on("ready", () => {
                  logger.success("SSH connected via bastion");
                  observer.next(conn);
                })
                .on("error", (err) => {
                  logger.error(`SSH error: ${err.message}`);
                  observer.error(err);
                })
                .on("close", () => {
                  logger.debug("SSH connection closed");
                  observer.complete();
                })
                .connect({
                  sock: stream,
                  ...buildConnectConfig(config),
                });
            },
          );
        })
        .on("error", (err) => {
          logger.error(`Bastion connection error: ${err.message}`);
          observer.error(err);
        })
        .connect(buildForwardConnectConfig(fwdConfig));
    }
    else {
      conn
        .on("ready", () => {
          logger.success(`SSH connected to ${config.host}:${config.port}`);
          observer.next(conn);
        })
        .on("error", (err) => {
          logger.error(`SSH connection error: ${err.message}`);
          observer.error(err);
        })
        .on("close", () => {
          logger.debug("SSH connection closed");
          observer.complete();
        })
        .connect(buildConnectConfig(config));
    }

    return () => {
      conn.end();
      if (forward)
        forward.end();
    };
  });
}

function buildForwardConnectConfig(forward: NonNullable<Config["forward"]>): ConnectConfig {
  const connectConfig: ConnectConfig = {
    host: forward.host,
    port: forward.port,
    username: forward.username,
  };

  if (forward.privateKey) {
    const keyPath = forward.privateKey.startsWith("~")
      ? resolve(homedir(), forward.privateKey.slice(2))
      : resolve(forward.privateKey);
    connectConfig.privateKey = readFileSync(keyPath, "utf-8");
    if (forward.passphrase) {
      connectConfig.passphrase = forward.passphrase;
    }
    logger.debug("Using SSH private key authentication for bastion");
  }
  else if (forward.password) {
    connectConfig.password = forward.password;
    logger.debug("Using SSH password authentication for bastion");
  }

  return connectConfig;
}
