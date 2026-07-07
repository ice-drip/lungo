import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { resolve } from 'path';
import { loadConfig, resolveAuth } from '../../src/config/loader';
import type { Config } from '../../src/config/schema';

const TEST_DIR = resolve(__dirname, '__fixtures__');

function writeConfig(filename: string, content: object) {
  const dir = resolve(TEST_DIR, 'loader-test');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, filename), JSON.stringify(content));
}

describe('loadConfig', () => {
  beforeEach(() => {
    const dir = resolve(TEST_DIR, 'loader-test');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  });

  afterEach(() => {
    const dir = resolve(TEST_DIR, 'loader-test');
    if (existsSync(dir)) rmSync(dir, { recursive: true });
  });

  it('loads and validates a valid config file', async () => {
    writeConfig('lungo.config.json', {
      production: {
        serverDir: '/var/www',
        host: '10.0.0.1',
        port: 22,
        username: 'deploy',
        password: 'secret',
        project: 'my-app',
      },
    });

    const { config } = await loadConfig({
      env: 'production',
      configPath: resolve(TEST_DIR, 'loader-test', 'lungo.config.json'),
    });

    expect(config.serverDir).toBe('/var/www');
    expect(config.host).toBe('10.0.0.1');
    expect(config.port).toBe(22);
    expect(config.dist).toBe('dist'); // default
  });

  it('throws when env key is missing from config', async () => {
    writeConfig('lungo.config.json', {
      staging: { serverDir: '/var/www', host: '10.0.0.1', username: 'u', password: 'p', project: 'x' },
    });

    await expect(
      loadConfig({
        env: 'production',
        configPath: resolve(TEST_DIR, 'loader-test', 'lungo.config.json'),
      }),
    ).rejects.toThrow(/production/);
  });

  it('throws when config file does not exist', async () => {
    await expect(
      loadConfig({
        env: 'production',
        configPath: resolve(TEST_DIR, 'loader-test', 'nonexistent.json'),
      }),
    ).rejects.toThrow(/not found/);
  });
});

describe('resolveAuth', () => {
  it('returns password when config has password', async () => {
    const config: Config = {
      serverDir: '/var/www',
      host: '10.0.0.1',
      port: 22,
      username: 'deploy',
      password: 'secret',
      project: 'my-app',
      dist: 'dist',
    };
    const auth = await resolveAuth(config);
    expect(auth.password).toBe('secret');
  });

  it('returns privateKey when config has privateKey', async () => {
    const config: Config = {
      serverDir: '/var/www',
      host: '10.0.0.1',
      port: 22,
      username: 'deploy',
      privateKey: '~/.ssh/id_rsa',
      project: 'my-app',
      dist: 'dist',
    };
    const auth = await resolveAuth(config);
    expect(auth.privateKey).toBe('~/.ssh/id_rsa');
  });

  it('returns empty object when neither password nor key provided', async () => {
    const config: Config = {
      serverDir: '/var/www',
      host: '10.0.0.1',
      port: 22,
      username: 'deploy',
      project: 'my-app',
      dist: 'dist',
    };
    const auth = await resolveAuth(config);
    expect(auth.password).toBeUndefined();
    expect(auth.privateKey).toBeUndefined();
  });
});
