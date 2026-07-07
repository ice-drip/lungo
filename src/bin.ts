#!/usr/bin/env node
import { defineCommand, runMain } from 'citty';
import { deploy } from './commands/deploy';
import { init } from './commands/init';
import { list } from './commands/list';
import { rollback } from './commands/rollback';

const main = defineCommand({
  meta: {
    name: 'lungo',
    version: '2.0.0',
    description: 'SSH-based deployment tool',
  },
  args: {
    env: {
      type: 'string',
      description: 'Environment name',
      alias: ['e'],
    },
    config: {
      type: 'string',
      description: 'Config file path',
      alias: ['c'],
    },
    verbose: {
      type: 'boolean',
      description: 'Verbose output',
      alias: ['v'],
      default: false,
    },
  },
  subCommands: {
    deploy,
    init,
    list,
    rollback,
  },
  // When no subcommand matches, fall through to deploy (backward compatible)
  async run({ args }) {
    if (args.env) {
      // Backward compatibility: lungo --env production -> deploy
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await deploy.run!({ args } as any);
    }
  },
});

runMain(main).catch((err) => {
  console.error(err);
  process.exit(1);
});
