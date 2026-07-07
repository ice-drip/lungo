import { describe, it, expect, vi, afterEach } from 'vitest';
import { sendNotification } from '../../src/services/notify';
import type { Config } from '../../src/config/schema';

const originalFetch = globalThis.fetch;

describe('sendNotification', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends POST notification when config has notify', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    globalThis.fetch = mockFetch as any;

    const config: Config = {
      serverDir: '/var/www',
      host: '10.0.0.1',
      port: 22,
      username: 'deploy',
      project: 'my-app',
      dist: 'dist',
      notify: { url: 'https://hooks.example.com', method: 'POST' },
    };

    await sendNotification(config, true, 'Deploy successful');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://hooks.example.com',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('does nothing when config has no notify', async () => {
    const mockFetch = vi.fn();
    globalThis.fetch = mockFetch as any;

    const config: Config = {
      serverDir: '/var/www',
      host: '10.0.0.1',
      port: 22,
      username: 'deploy',
      project: 'my-app',
      dist: 'dist',
    };

    await sendNotification(config, true, 'Deploy successful');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('handles fetch failure gracefully', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
    globalThis.fetch = mockFetch as any;

    const config: Config = {
      serverDir: '/var/www',
      host: '10.0.0.1',
      port: 22,
      username: 'deploy',
      project: 'my-app',
      dist: 'dist',
      notify: { url: 'https://hooks.example.com', method: 'POST' },
    };

    // Should not throw
    await expect(
      sendNotification(config, true, 'Deploy successful'),
    ).resolves.toBeUndefined();
  });
});
