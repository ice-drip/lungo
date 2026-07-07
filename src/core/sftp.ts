import type { Client, SFTPWrapper } from "ssh2";
import type { Config } from "../config/schema";
import { createReadStream, rmSync } from "node:fs";
import { resolve } from "node:path";
import { Observable } from "rxjs";
import { logger } from "../utils/logger";
import { createZip } from "./zip";

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
    let sftp: SFTPWrapper | undefined;
    const zipPath = resolve(projectDir, "lungo-deploy.zip");

    const cleanup = (): void => {
      try {
        rmSync(zipPath);
      }
      catch {
        // ignore cleanup errors
      }
    };

    conn.sftp((err, _sftp) => {
      if (err) {
        logger.error(`SFTP error: ${err.message}`);
        observer.error(err);
        return;
      }
      sftp = _sftp;

      const zipFileName = `${config.project}-deploy.zip`;
      const fullFileName = `${config.serverDir}/${zipFileName}`;
      const command = `unzip -o ${fullFileName} -d ${config.serverDir}/${config.project}`;

      const writeStream = sftp.createWriteStream(fullFileName);

      writeStream.on("close", () => {
        logger.success(`Uploaded ${zipFileName}`);
        observer.next({ command, del: `rm -r ${fullFileName}` });
        observer.complete();
        cleanup();
      });

      writeStream.on("error", (writeErr: Error) => {
        logger.error(`Upload error: ${writeErr.message}`);
        observer.error(writeErr);
        cleanup();
      });

      logger.info("Creating zip...");
      createZip(projectDir, config.dist).writeZip(zipPath);

      const readStream = createReadStream(zipPath);
      readStream.on("error", (readErr: Error) => {
        logger.error(`Read error: ${readErr.message}`);
        observer.error(readErr);
        cleanup();
      });
      readStream.pipe(writeStream);
    });

    return () => {
      if (sftp)
        sftp.end();
      cleanup();
    };
  });
}
