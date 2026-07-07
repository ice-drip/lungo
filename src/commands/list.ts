import { defineCommand } from "citty";
import { Table } from "console-table-printer";
import { concatMap, map } from "rxjs";
import { loadConfig } from "../config/loader";
import { execCommand } from "../core/remote-exec";
import { sshConnect } from "../core/ssh";
import { listBackups } from "../services/backup";
import { logger } from "../utils/logger";

export const list = defineCommand({
  meta: {
    name: "list",
    description: "List backups on the remote server",
  },
  args: {
    env: {
      type: "string",
      description: "Environment name (required)",
      alias: ["e"],
    },
    config: {
      type: "string",
      description: "Config file path",
      alias: ["c"],
    },
  },
  async run({ args }) {
    if (!args.env) {
      logger.error("--env is required. Usage: lungo list --env production");
      process.exit(1);
    }

    const { config } = loadConfig({
      env: args.env,
      configPath: args.config,
    });

    logger.info(`Listing backups for ${args.env} on ${config.host}`);

    await new Promise<void>((resolve, reject) => {
      sshConnect(config)
        .pipe(
          concatMap(conn =>
            execCommand(conn, `ls ${config.serverDir}`).pipe(
              map(output => ({ conn, output })),
            ),
          ),
          concatMap(({ conn, output }) =>
            listBackups(output, config.project).pipe(
              map((backups) => {
                conn.end();
                return backups;
              }),
            ),
          ),
        )
        .subscribe({
          next: (backups) => {
            if (backups.length === 0) {
              logger.info("No backups found");
            }
            else {
              const table = new Table({
                columns: [
                  { name: "index", alignment: "right", color: "green" },
                  { name: "filename", color: "cyan" },
                  { name: "date", color: "green" },
                ],
              });
              table.addRows(
                backups.map((b, i) => ({
                  index: i + 1,
                  filename: b.filename,
                  date: b.date,
                })),
              );
              table.printTable();
            }
          },
          error: (err) => {
            logger.error("List failed:", err.message);
            reject(err);
          },
          complete: () => resolve(),
        });
    });
  },
});
