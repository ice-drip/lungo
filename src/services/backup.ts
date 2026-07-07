import { Observable } from 'rxjs';
import dayjs from 'dayjs';
import type { Config } from '../config/schema';
import { logger } from '../utils/logger';

export interface BackupEntry {
  filename: string;
  date: string;
}

export function listBackups(
  lsOutput: string,
  project: string,
): Observable<BackupEntry[]> {
  return new Observable<BackupEntry[]>((observer) => {
    const entries = lsOutput.split('\n').filter(Boolean);
    const bakFileRegex = new RegExp(`${project}\\.bak\\.([0-9]{13})`);

    const backups: BackupEntry[] = entries
      .filter((item) => item.startsWith(`${project}.bak`))
      .map((item) => {
        const matchTime = item.match(bakFileRegex);
        return {
          filename: item,
          date: matchTime
            ? dayjs(Number(matchTime[1])).format('YYYY-MM-DD HH:mm:ss')
            : '',
        };
      })
      .sort((a, b) => b.filename.localeCompare(a.filename));

    logger.info(`Found ${backups.length} backup(s)`);
    observer.next(backups);
    observer.complete();
  });
}

export function cleanupBackups(
  config: Config,
  backups: BackupEntry[],
): Observable<string> {
  return new Observable<string>((observer) => {
    const bakFileRegex = new RegExp(`${config.project}\\.bak\\.([0-9]{13})`);
    const toDelete: string[] = [];

    // Timeout-based cleanup
    if (config.timeout) {
      const cutoffTime = dayjs().subtract(config.timeout, 'day');
      for (const backup of backups) {
        const match = backup.filename.match(bakFileRegex);
        if (match && cutoffTime.isAfter(dayjs(Number(match[1])))) {
          toDelete.push(`${config.serverDir}/${backup.filename}`);
        }
      }
    }

    // Keep-count cleanup
    if (config.backup?.enabled && config.backup.keep > 0 && backups.length > config.backup.keep) {
      const overflow = backups.slice(config.backup.keep);
      for (const backup of overflow) {
        const fullPath = `${config.serverDir}/${backup.filename}`;
        if (!toDelete.includes(fullPath)) {
          toDelete.push(fullPath);
        }
      }
    }

    if (toDelete.length === 0) {
      logger.info('No backups to clean');
      observer.next('echo "no backups to clean"');
    } else {
      logger.info(`Cleaning ${toDelete.length} old backup(s)`);
      observer.next(`rm -r ${toDelete.join(' ')}`);
    }
    observer.complete();
  });
}

export function backupCurrent(
  dirContents: string[],
  config: Config,
): Observable<string> {
  return new Observable<string>((observer) => {
    if (config.backup?.enabled === false) {
      logger.info('Backup disabled, skipping');
      observer.next('echo "backup disabled"');
      observer.complete();
      return;
    }

    if (dirContents.includes(config.project)) {
      const cmd = `mv -v ${config.serverDir}/${config.project} ${config.serverDir}/${config.project}.bak.${Date.now()}`;
      logger.info(`Backing up current deployment: ${config.project}`);
      observer.next(cmd);
    } else {
      logger.info('No existing deployment to backup');
      observer.next('echo "no existing deployment"');
    }
    observer.complete();
  });
}
