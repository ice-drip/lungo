import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import { createInterface } from "node:readline";
import { defineCommand } from "citty";
import { logger } from "../utils/logger";

function prompt(query: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout } as any);
  return new Promise((res) => {
    rl.question(`${query}: `, (answer) => {
      rl.close();
      res(answer.trim());
    });
  });
}

export const init = defineCommand({
  meta: {
    name: "init",
    description: "Generate a lungo.config.json interactively",
  },
  args: {
    env: {
      type: "string",
      description: "Environment name (e.g., production, staging)",
      alias: ["e"],
    },
    force: {
      type: "boolean",
      description: "Overwrite existing config file",
      alias: ["f"],
      default: false,
    },
  },
  async run({ args }) {
    const envName = args.env || (await prompt("Environment name (e.g., production)"));
    const configPath = resolvePath(process.cwd(), "lungo.config.json");

    if (existsSync(configPath) && !args.force) {
      logger.info(`Config already exists at ${configPath}`);
      logger.info("Use --force to overwrite, or manually edit the file.");
      return;
    }

    logger.info(`Creating config for environment: ${envName}`);
    logger.info("Press Enter to skip optional fields.\n");

    const host = await prompt("SSH Host");
    const port = await prompt("SSH Port (default: 22)");
    const username = await prompt("SSH Username");
    const password = await prompt("SSH Password (leave empty for key auth)");
    const serverDir = await prompt("Remote server directory (e.g., /var/www)");
    const project = await prompt("Project name");
    const dist = await prompt("Local dist directory (default: dist)");
    const privateKey = await prompt("SSH private key path (optional)");
    const timeout = await prompt("Backup retention days (optional)");

    const config: Record<string, unknown> = {
      [envName]: {
        host: host || "localhost",
        port: port ? Number(port) : 22,
        username: username || "root",
        serverDir: serverDir || "/var/www",
        project: project || envName,
        dist: dist || "dist",
      },
    };

    const envConfig = config[envName] as Record<string, unknown>;
    if (password)
      envConfig.password = password;
    if (privateKey)
      envConfig.privateKey = privateKey;
    if (timeout)
      envConfig.timeout = Number(timeout);

    // Preserve existing environments if appending
    let existing: Record<string, unknown> = {};
    if (existsSync(configPath)) {
      try {
        existing = JSON.parse(readFileSync(configPath, "utf-8"));
      }
      catch {
        // ignore
      }
    }

    const merged = { ...existing, ...config };
    writeFileSync(configPath, `${JSON.stringify(merged, null, 2)}\n`);
    logger.success(`Config written to ${configPath}`);
  },
});
