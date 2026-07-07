import { createReadStream, rmSync } from 'fs';
import { resolve } from 'path';
import { Observable } from 'rxjs';
import type { Client } from 'ssh2';
import type { Config } from '../config/schema';
import { createZip } from './zip';
import { logger } from '../utils/logger';

interface SftpResult {
  command: string;
  del: string;
}

export function sftpUpload(
  config: Config,
  conn: Client,
  projectDir: string,
): Observable<SftpResult> {
  return new Observable<SftpResult>((observer) => {
    conn.sftp((err, sftp) => {
      if (err) {
        logger.error(`SFTP error: ${err.message}`);
        observer.error(err);
        return;
      }

      const zipFileName = `${config.project}-deploy.zip`;
      const fullFileName = `${config.serverDir}/${zipFileName}`;
      const command = `unzip -o ${fullFileName} -d ${config.serverDir}/${config.project}`;
      const zipPath = resolve(projectDir, 'lungo-deploy.zip');

      const writeStream = sftp.createWriteStream(fullFileName);

      const cleanup = () => {
        try {
          rmSync(zipPath);
        } catch {
          // ignore cleanup errors
        }
      };

      writeStream.on('close', () => {
        logger.success(`Uploaded ${zipFileName}`);
        observer.next({ command, del: `rm -r ${fullFileName}` });
        observer.complete();
        cleanup();
      });

      writeStream.on('error', (writeErr: Error) => {
        logger.error(`Upload error: ${writeErr.message}`);
        observer.error(writeErr);
        cleanup();
      });

      logger.info('Creating zip...');
      createZip(projectDir, config.dist).writeZip(zipPath);

      const readStream = createReadStream(zipPath);
      readStream.pipe(writeStream);
    });
  });
}
