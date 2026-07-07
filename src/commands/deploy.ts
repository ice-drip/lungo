import { defineCommand } from 'citty';
import { loadConfig } from '../config/loader';
import { runDeploy } from '../services/pipeline';
import { sendNotification } from '../services/notify';
import { logger, setVerbose } from '../utils/logger';

export const deploy = defineCommand({
  meta: {
    name: 'deploy',
    description: 'Deploy dist to remote server via SSH/SFTP',
  },
  args: {
    env: {
      type: 'string',
      description: 'Environment name (required)',
      alias: ['e'],
    },
    config: {
      type: 'string',
      description: 'Config file path (default: lungo.config.json)',
      alias: ['c'],
      valueHint: 'PATH',
    },
    dryRun: {
      type: 'boolean',
      description: 'Show deployment plan without executing',
      alias: ['n'],
      default: false,
    },
    verbose: {
      type: 'boolean',
      description: 'Enable verbose output',
      alias: ['v'],
      default: false,
    },
    noBackup: {
      type: 'boolean',
      description: 'Skip backup step',
      default: false,
    },
    noCleanup: {
      type: 'boolean',
      description: 'Skip old backup cleanup',
      default: false,
    },
  },
  async run({ args }) {
    if (!args.env) {
      logger.error('--env is required. Usage: lungo deploy --env production');
      process.exit(1);
    }

    if (args.verbose) {
      setVerbose(true);
    }

    logger.info(`Loading config for environment: ${args.env}`);

    const { config } = await loadConfig({
      env: args.env,
      configPath: args.config,
    });

    logger.info(`Target: ${config.host}:${config.port} -> ${config.serverDir}/${config.project}`);

    await new Promise<void>((resolve, reject) => {
      runDeploy({
        config,
        dryRun: args.dryRun,
        noBackup: args.noBackup,
        noCleanup: args.noCleanup,
      }).subscribe({
        complete: () => resolve(),
        error: (err) => {
          logger.error('Deploy failed:', err.message);
          sendNotification(config, false, err.message);
          reject(err);
        },
        next: () => {
          sendNotification(config, true, 'Deploy successful');
        },
      });
    });
  },
});
