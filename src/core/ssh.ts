import { Observable } from 'rxjs';
import { Client, type ConnectConfig } from 'ssh2';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { homedir } from 'os';
import type { Config } from '../config/schema';
import { logger } from '../utils/logger';

function buildConnectConfig(config: Config): ConnectConfig {
  const connectConfig: ConnectConfig = {
    host: config.host,
    port: config.port,
    username: config.username,
  };

  if (config.privateKey) {
    const keyPath = config.privateKey.startsWith('~')
      ? resolve(homedir(), config.privateKey.slice(2))
      : resolve(config.privateKey);
    connectConfig.privateKey = readFileSync(keyPath, 'utf-8');
    if (config.passphrase) {
      connectConfig.passphrase = config.passphrase;
    }
    logger.debug('Using SSH private key authentication');
  } else if (config.password) {
    connectConfig.password = config.password;
    logger.debug('Using SSH password authentication');
  }

  return connectConfig;
}

export function sshConnect(config: Config): Observable<Client> {
  return new Observable<Client>((observer) => {
    const conn = new Client();

    if (config.forward) {
      const forward = new Client();
      forward
        .on('ready', () => {
          logger.debug('Bastion connected, forwarding to target');
          forward.forwardOut(
            '127.0.0.1',
            8797,
            config.host,
            config.port,
            (err, stream) => {
              if (err) {
                logger.error(`Bastion forward error: ${err.message}`);
                observer.error(err);
                forward.end();
                return;
              }
              conn
                .on('ready', () => {
                  logger.success('SSH connected via bastion');
                  observer.next(conn);
                })
                .on('error', (err) => {
                  logger.error(`SSH error: ${err.message}`);
                  observer.error(err);
                })
                .on('close', () => {
                  logger.debug('SSH connection closed');
                  observer.complete();
                })
                .connect({
                  sock: stream,
                  ...buildConnectConfig(config),
                });
            },
          );
        })
        .on('error', (err) => {
          logger.error(`Bastion connection error: ${err.message}`);
          observer.error(err);
        })
        .connect({
          host: config.forward.host,
          port: config.forward.port,
          username: config.forward.username,
          password: config.forward.password,
        });
    } else {
      conn
        .on('ready', () => {
          logger.success(`SSH connected to ${config.host}:${config.port}`);
          observer.next(conn);
        })
        .on('error', (err) => {
          logger.error(`SSH connection error: ${err.message}`);
          observer.error(err);
        })
        .on('close', () => {
          logger.debug('SSH connection closed');
          observer.complete();
        })
        .connect(buildConnectConfig(config));
    }
  });
}
