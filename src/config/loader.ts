import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { ConfigSchema, type Config } from './schema';

interface LoadConfigOptions {
  env: string;
  configPath?: string;
}

interface LoadConfigResult {
  config: Config;
  configFile: string;
}

export async function loadConfig(options: LoadConfigOptions): Promise<LoadConfigResult> {
  const configPath = options.configPath ?? resolve(process.cwd(), 'lungo.config.json');

  if (!existsSync(configPath)) {
    throw new Error(`Config file not found: ${configPath}. Create one with 'lungo init'.`);
  }

  let raw: string;
  try {
    raw = readFileSync(configPath, 'utf-8');
  } catch {
    throw new Error(`Cannot read config file: ${configPath}`);
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid JSON in config file: ${configPath}`);
  }

  const envConfig = parsed[options.env];
  if (!envConfig) {
    throw new Error(
      `Environment "${options.env}" not found in config file. Available: ${Object.keys(parsed).join(', ')}`,
    );
  }

  const config = ConfigSchema.parse(envConfig);

  return { config, configFile: configPath };
}

interface ResolvedAuth {
  password?: string;
  privateKey?: string;
  passphrase?: string;
}

export async function resolveAuth(config: Config): Promise<ResolvedAuth> {
  const result: ResolvedAuth = {};

  if (config.privateKey) {
    result.privateKey = config.privateKey;
    if (config.passphrase) {
      result.passphrase = config.passphrase;
    }
  } else if (config.password) {
    result.password = config.password;
  }

  return result;
}
