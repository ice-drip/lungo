import { createConsola } from "consola";

export const logger = createConsola({
  defaults: {
    tag: "lungo",
  },
});

export function setVerbose(enabled: boolean): void {
  logger.level = enabled ? 5 : 3; // 5 = debug/trace, 3 = info
}
