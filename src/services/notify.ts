import type { Config } from '../config/schema';
import { logger } from '../utils/logger';

export async function sendNotification(
  config: Config,
  success: boolean,
  message: string,
): Promise<void> {
  if (!config.notify?.url) return;

  const { url, method = 'POST', headers = {} } = config.notify;

  const body = JSON.stringify({
    project: config.project,
    host: config.host,
    success,
    message,
    timestamp: new Date().toISOString(),
  });

  try {
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: method === 'GET' ? undefined : body,
    });

    if (!response.ok) {
      logger.warn(`Notification failed: ${response.status} ${response.statusText}`);
    } else {
      logger.debug('Notification sent');
    }
  } catch (err) {
    logger.warn('Notification delivery failed:', (err as Error).message);
  }
}
