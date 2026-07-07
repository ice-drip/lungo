import { describe, it, expect } from 'vitest';
import dayjs from 'dayjs';
import { listBackups, cleanupBackups, backupCurrent } from '../../src/services/backup';
import type { Config } from '../../src/config/schema';

function createConfig(overrides: Partial<Config> = {}): Config {
  return {
    serverDir: '/var/www',
    host: '10.0.0.1',
    port: 22,
    username: 'deploy',
    password: 'secret',
    project: 'my-app',
    dist: 'dist',
    ...overrides,
  };
}

describe('listBackups', () => {
  it('parses backup directories from ls output', async () => {
    const output = 'my-app\nmy-app.bak.1720000000000\nmy-app.bak.1710000000000\nother\n';
    const result$ = listBackups(output, '/var/www', 'my-app');

    const backups = await new Promise<any[]>((resolve) => {
      result$.subscribe({ next: resolve });
    });

    expect(backups).toHaveLength(2);
    expect(backups[0].filename).toBe('my-app.bak.1720000000000'); // newest first
  });

  it('returns empty array when no backups exist', async () => {
    const output = 'my-app\nother-dir\n';
    const result$ = listBackups(output, '/var/www', 'my-app');

    const backups = await new Promise<any[]>((resolve) => {
      result$.subscribe({ next: resolve });
    });

    expect(backups).toHaveLength(0);
  });
});

describe('cleanupBackups', () => {
  it('returns rm command for expired backups by timeout', () => {
    const config = createConfig({ timeout: 30 });
    // Recent backup: 10 days ago (within 30-day window)
    const recentTs = Date.now() - 10 * 24 * 60 * 60 * 1000;
    // Old backup: 60 days ago (outside 30-day window)
    const oldTs = Date.now() - 60 * 24 * 60 * 60 * 1000;
    const backups = [
      { filename: `my-app.bak.${recentTs}`, date: dayjs(recentTs).format('YYYY-MM-DD HH:mm:ss') },
      { filename: `my-app.bak.${oldTs}`, date: dayjs(oldTs).format('YYYY-MM-DD HH:mm:ss') },
    ];
    const result$ = cleanupBackups(config, backups);

    result$.subscribe((cmd) => {
      expect(cmd).toContain('rm -r');
      expect(cmd).toContain(`${oldTs}`); // old one
      expect(cmd).not.toContain(`${recentTs}`); // recent one (within timeout)
    });
  });

  it('returns echo when no backups to clean', () => {
    const config = createConfig({ timeout: 30 });
    // Recent backup: 10 days ago (within 30-day window, not expired)
    const recentTs = Date.now() - 10 * 24 * 60 * 60 * 1000;
    const backups = [
      { filename: `my-app.bak.${recentTs}`, date: dayjs(recentTs).format('YYYY-MM-DD HH:mm:ss') },
    ];
    const result$ = cleanupBackups(config, backups);

    result$.subscribe((cmd) => {
      expect(cmd).toContain('echo');
    });
  });

  it('respects backup.keep count', () => {
    const config = createConfig({
      backup: { enabled: true, keep: 2 },
    });
    const backups = [
      { filename: 'my-app.bak.3', date: '2024-07-03' },
      { filename: 'my-app.bak.2', date: '2024-07-02' },
      { filename: 'my-app.bak.1', date: '2024-07-01' },
    ];
    const result$ = cleanupBackups(config, backups);

    result$.subscribe((cmd) => {
      expect(cmd).toContain('1'); // oldest, exceeding keep=2
      expect(cmd).not.toContain('3');
      expect(cmd).not.toContain('2');
    });
  });
});

describe('backupCurrent', () => {
  it('returns mv command when current project exists', () => {
    const config = createConfig();
    const backups = [
      { filename: 'my-app.bak.old', date: '2024-01-01' },
    ];
    // backups include "my-app" meaning the current deployment exists
    const dirContents = ['my-app', 'my-app.bak.old'];

    const result$ = backupCurrent(dirContents, config, backups);

    result$.subscribe((cmd) => {
      expect(cmd).toContain('mv -v');
      expect(cmd).toContain('my-app');
      expect(cmd).toContain('my-app.bak.');
    });
  });

  it('returns echo when no current deployment exists', () => {
    const config = createConfig();
    const backups: any[] = [];
    const dirContents = ['other'];

    const result$ = backupCurrent(dirContents, config, backups);

    result$.subscribe((cmd) => {
      expect(cmd).toContain('echo');
    });
  });
});
