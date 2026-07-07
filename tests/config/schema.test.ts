import { describe, it, expect } from 'vitest';
import { ConfigSchema } from '../../src/config/schema';

const validMinimalConfig = {
  serverDir: '/var/www/html',
  host: '192.168.1.1',
  username: 'deploy',
  password: 'secret',
  project: 'my-app',
};

describe('ConfigSchema', () => {
  it('parses a valid minimal v1.x config with defaults applied', () => {
    const result = ConfigSchema.parse(validMinimalConfig);
    expect(result.port).toBe(22);
    expect(result.dist).toBe('dist');
  });

  it('parses a full config with all v2.0 fields', () => {
    const result = ConfigSchema.parse({
      ...validMinimalConfig,
      port: 2222,
      dist: 'build',
      timeout: 30,
      forward: {
        host: '10.0.0.1',
        port: 22,
        username: 'jump',
        password: 'jump-pass',
      },
      privateKey: '~/.ssh/id_rsa',
      passphrase: 'key-pass',
      preDeploy: 'npm run build',
      postDeploy: 'systemctl restart nginx',
      notify: {
        url: 'https://hooks.example.com/deploy',
        method: 'POST',
        headers: { Authorization: 'Bearer token' },
      },
      backup: {
        enabled: true,
        keep: 5,
      },
    });
    expect(result.backup?.keep).toBe(5);
    expect(result.notify?.method).toBe('POST');
    expect(result.forward?.port).toBe(22);
  });

  it('rejects config missing required serverDir', () => {
    const withoutServerDir = { ...validMinimalConfig };
    delete withoutServerDir.serverDir;
    expect(() => ConfigSchema.parse(withoutServerDir)).toThrow();
  });

  it('rejects config missing required host', () => {
    const withoutHost = { ...validMinimalConfig };
    delete withoutHost.host;
    expect(() => ConfigSchema.parse(withoutHost)).toThrow();
  });

  it('rejects invalid port type', () => {
    expect(() =>
      ConfigSchema.parse({ ...validMinimalConfig, port: 'not-a-number' }),
    ).toThrow();
  });

  it('rejects invalid notify method', () => {
    expect(() =>
      ConfigSchema.parse({
        ...validMinimalConfig,
        notify: { url: 'https://example.com', method: 'PUT' },
      }),
    ).toThrow();
  });
});
