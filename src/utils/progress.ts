import { logger } from './logger';

export interface ProgressBar {
  tick: (message?: string) => void;
  stop: () => void;
}

export function createProgressBar(total: number): ProgressBar {
  let current = 0;
  const startTime = Date.now();

  function render(message?: string): void {
    const percent = Math.round((current / total) * 100);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    logger.info(`[${percent}%] [${elapsed}s] ${message ?? ''}`);
  }

  return {
    tick(message) {
      current++;
      render(message);
    },
    stop() {
      render('Done');
    },
  };
}
