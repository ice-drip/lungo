import { Observable } from 'rxjs';
import type { Client } from 'ssh2';
import { logger } from '../utils/logger';

export function execCommand(client: Client, command: string): Observable<string> {
  return new Observable<string>((observer) => {
    logger.debug(`Executing: ${command}`);
    let stream: import('ssh2').ClientChannel | undefined;

    client.exec(command, (err, _stream) => {
      if (err) {
        logger.error(`Exec error: ${err.message}`);
        observer.error(err);
        return;
      }
      stream = _stream;
      let data = '';
      stream.on('data', (chunk: Buffer | string) => {
        data += chunk.toString();
      });
      stream.on('close', () => {
        observer.next(data);
        observer.complete();
        stream?.destroy();
      });
      stream.on('error', (streamErr: Error) => {
        observer.error(streamErr);
      });
    });

    return () => {
      stream?.destroy();
    };
  });
}
