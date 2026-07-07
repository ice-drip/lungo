import { Observable, concatMap, map, tap } from 'rxjs';
import type { Client } from 'ssh2';
import type { Config } from '../config/schema';
import { sshConnect } from '../core/ssh';
import { execCommand } from '../core/remote-exec';
import { sftpUpload } from '../core/sftp';
import { listBackups, cleanupBackups, backupCurrent } from './backup';
import { logger } from '../utils/logger';

export interface DeployOptions {
  config: Config;
  dryRun?: boolean;
  noBackup?: boolean;
  noCleanup?: boolean;
}

export function runDeploy(options: DeployOptions): Observable<void> {
  const { config, dryRun, noBackup, noCleanup } = options;

  if (dryRun) {
    logger.info('[DRY-RUN] Would deploy to', config.host);
    logger.info('[DRY-RUN] Target directory:', config.serverDir);
    logger.info('[DRY-RUN] Project:', config.project);
    return new Observable((observer) => {
      observer.next();
      observer.complete();
    });
  }

  let client: Client | null = null;

  return sshConnect(config).pipe(
    tap((conn) => {
      client = conn;
    }),

    // 1. List directory contents
    concatMap((conn) =>
      execCommand(conn, `ls ${config.serverDir}`).pipe(
        map((output) => ({
          conn,
          dirContents: output.split('\n').filter(Boolean),
        })),
      ),
    ),

    // 2. Identify backups
    concatMap(({ conn, dirContents }) =>
      listBackups(dirContents.join('\n'), config.serverDir, config.project).pipe(
        map((backups) => ({ conn, backups, dirContents })),
      ),
    ),

    // 3. Cleanup old backups
    concatMap(({ conn, backups, dirContents }) => {
      if (noCleanup) {
        logger.info('Skipping backup cleanup');
        return [{ conn, backups, dirContents, cleanupCmd: null } as const];
      }
      return cleanupBackups(config, backups).pipe(
        map((cmd) => ({ conn, backups, dirContents, cleanupCmd: cmd })),
      );
    }),

    // 4. Execute cleanup command
    concatMap(({ conn, backups, dirContents, cleanupCmd }) => {
      if (cleanupCmd) {
        return execCommand(conn, cleanupCmd).pipe(
          map(() => ({ conn, backups, dirContents })),
        );
      }
      return [{ conn, backups, dirContents } as const];
    }),

    // 5. Backup current deployment
    concatMap(({ conn, backups, dirContents }) => {
      if (noBackup) {
        logger.info('Skipping backup');
        return [{ conn, backupCmd: 'echo "backup skipped"' } as const];
      }
      return backupCurrent(dirContents, config, backups).pipe(
        map((cmd) => ({ conn, backupCmd: cmd })),
      );
    }),

    // 6. Execute backup
    concatMap(({ conn, backupCmd }) =>
      execCommand(conn, backupCmd).pipe(map(() => ({ conn }))),
    ),

    // 7. Pre-deploy hook
    concatMap(({ conn }) => {
      if (config.preDeploy) {
        return execCommand(conn, config.preDeploy).pipe(map(() => ({ conn })));
      }
      return [{ conn } as const];
    }),

    // 8. Upload & unzip
    concatMap(({ conn }) =>
      sftpUpload(config, conn, process.cwd()).pipe(
        map(({ command, del }) => ({ conn, unzipCmd: command, delCmd: del })),
      ),
    ),

    // 9. Unzip on remote
    concatMap(({ conn, unzipCmd, delCmd }) =>
      execCommand(conn, unzipCmd).pipe(map(() => ({ conn, delCmd }))),
    ),

    // 10. Delete zip on remote
    concatMap(({ conn, delCmd }) =>
      execCommand(conn, delCmd).pipe(map(() => ({ conn }))),
    ),

    // 11. Post-deploy hook
    concatMap(({ conn }) => {
      if (config.postDeploy) {
        return execCommand(conn, config.postDeploy).pipe(map(() => ({ conn })));
      }
      return [{ conn } as const];
    }),

    // 12. Finalize
    tap(({ conn }) => {
      logger.success('Deploy complete!');
      conn.end();
    }),
    map(() => undefined),
  );
}
