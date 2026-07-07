import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { resolve } from 'path';
import { EventEmitter } from 'events';
import { sftpUpload } from '../../src/core/sftp';
import type { Config } from '../../src/config/schema';

vi.mock('ssh2');

const TEST_DIR = resolve(__dirname, '__fixtures__', 'sftp-test');

function createConfig(): Config {
  return {
    serverDir: '/var/www',
    host: '10.0.0.1',
    port: 22,
    username: 'deploy',
    password: 'secret',
    project: 'my-app',
    dist: 'dist',
  };
}

describe('sftpUpload', () => {
  beforeAll(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
    mkdirSync(resolve(TEST_DIR, 'dist'), { recursive: true });
    writeFileSync(resolve(TEST_DIR, 'dist', 'index.html'), '<html></html>');
  });

  afterAll(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
  });

  it('emits command and del on successful upload', async () => {
    const config = createConfig();

    const mockWriteStream = new EventEmitter() as any;
    mockWriteStream.destroy = vi.fn();
    mockWriteStream.end = vi.fn();

    const mockSftp = {
      createWriteStream: vi.fn().mockReturnValue(mockWriteStream),
      end: vi.fn(),
    };

    const mockClient = {
      sftp: vi.fn((cb) => {
        setImmediate(() => cb(null, mockSftp));
      }),
    } as any;

    const result$ = sftpUpload(config, mockClient, TEST_DIR);

    const promise = new Promise((resolve, reject) => {
      result$.subscribe({
        next: (result) => {
          expect(result.command).toContain('unzip');
          expect(result.del).toContain('rm -r');
          resolve(result);
        },
        error: reject,
      });
    });

    // Simulate write completion
    setImmediate(() => mockWriteStream.emit('close'));

    await promise;
  });

  it('errors when sftp fails', async () => {
    const config = createConfig();
    const mockClient = {
      sftp: vi.fn((cb) => cb(new Error('SFTP error'), null)),
    } as any;

    await new Promise<void>((resolve) => {
      sftpUpload(config, mockClient, TEST_DIR).subscribe({
        error: (err) => {
          expect(err.message).toBe('SFTP error');
          resolve();
        },
      });
    });
  });
});
