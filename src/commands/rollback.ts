import { defineCommand } from 'citty';
import { loadConfig } from '../config/loader';
import { sshConnect } from '../core/ssh';
import { execCommand } from '../core/remote-exec';
import { listBackups } from '../services/backup';
import { logger, setVerbose } from '../utils/logger';
import { concatMap, map } from 'rxjs';

export const rollback = defineCommand({
  meta: {
    name: 'rollback',
    description: 'Rollback to a previous backup',
  },
  args: {
    env: {
      type: 'string',
      description: 'Environment name (required)',
      alias: ['e'],
    },
    config: {
      type: 'string',
      description: 'Config file path',
      alias: ['c'],
    },
    to: {
      type: 'string',
      description: 'Backup timestamp or "latest"',
      required: true,
      valueHint: 'TIMESTAMP',
    },
    dryRun: {
      type: 'boolean',
      description: 'Show rollback plan without executing',
      alias: ['n'],
      default: false,
    },
    verbose: {
      type: 'boolean',
      description: 'Enable verbose output',
      alias: ['v'],
      default: false,
    },
  },
  async run({ args }) {
    if (!args.env) {
      logger.error('--env is required. Usage: lungo rollback --env production --to latest');
      process.exit(1);
    }

    if (args.verbose) setVerbose(true);

    const { config } = await loadConfig({
      env: args.env,
      configPath: args.config,
    });

    logger.info(`Rolling back ${args.env} on ${config.host}`);

    await new Promise<void>((resolve, reject) => {
      sshConnect(config)
        .pipe(
          concatMap((conn) =>
            execCommand(conn, `ls ${config.serverDir}`).pipe(
              map((output) => ({ conn, output })),
            ),
          ),
          concatMap(({ conn, output }) =>
            listBackups(output, config.serverDir, config.project).pipe(
              map((backups) => {
                if (backups.length === 0) {
                  throw new Error('No backups found to rollback');
                }

                let target: string;
                if (args.to === 'latest') {
                  target = backups[0].filename;
                } else if (backups.some((b) => b.filename.includes(args.to!))) {
                  target = backups.find((b) => b.filename.includes(args.to!))!.filename;
                } else {
                  throw new Error(`Backup with timestamp "${args.to}" not found`);
                }

                return { conn, target };
              }),
            ),
          ),
          concatMap(({ conn, target }) => {
            const commands = [
              `rm -rf ${config.serverDir}/${config.project}`,
              `cp -r ${config.serverDir}/${target} ${config.serverDir}/${config.project}`,
            ];

            if (args.dryRun) {
              logger.info(`[DRY-RUN] Would rollback to: ${target}`);
              logger.info(`[DRY-RUN] ${commands[0]}`);
              logger.info(`[DRY-RUN] ${commands[1]}`);
              conn.end();
              return [];
            }

            logger.info(`Rolling back to: ${target}`);
            return execCommand(conn, commands.join(' && ')).pipe(
              map(() => conn),
            );
          }),
        )
        .subscribe({
          next: (conn) => {
            if (conn && typeof conn.end === 'function') conn.end();
            logger.success('Rollback complete');
          },
          error: (err) => {
            logger.error('Rollback failed:', err.message);
            reject(err);
          },
          complete: () => resolve(),
        });
    });
  },
});
