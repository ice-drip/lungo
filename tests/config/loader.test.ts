import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { resolve } from 'path';
import { loadConfig } from '../../src/config/loader';

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

  it('throws when env key is missing from config', () => {
    writeConfig('lungo.config.json', {
      staging: { serverDir: '/var/www', host: '10.0.0.1', username: 'u', password: 'p', project: 'x' },
    });

    expect(() =>
      loadConfig({
        env: 'production',
        configPath: resolve(TEST_DIR, 'loader-test', 'lungo.config.json'),
      }),
    ).toThrow(/production/);
  });

  it('throws when config file does not exist', () => {
    expect(() =>
      loadConfig({
        env: 'production',
        configPath: resolve(TEST_DIR, 'loader-test', 'nonexistent.json'),
      }),
    ).toThrow(/not found/);
  });
});
