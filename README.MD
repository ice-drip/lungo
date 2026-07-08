# @kaffee/lungo

> SSH/SFTP deployment CLI with backup, rollback & webhook support

[![npm version](https://img.shields.io/npm/v/@kaffee/lungo.svg)](https://www.npmjs.com/package/@kaffee/lungo)
[![license](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](https://github.com/ice-drip/lungo/blob/main/LICENSE)
[![node version](https://img.shields.io/node/v/@kaffee/lungo.svg)](https://nodejs.org)

## Features

- **SSH/SFTP Deployment** — Upload dist folder to remote server via SSH
- **Automatic Backup** — Create timestamped backups before each deploy
- **Rollback** — Instantly revert to any previous backup
- **Bastion Host** — Deploy through jump/bastion servers
- **Lifecycle Hooks** — Run custom scripts before/after deployment
- **Webhook Notifications** — POST/GET notifications on deploy success/failure
- **Dry Run** — Preview deployment plan without executing
- **Interactive Init** — Generate config file with guided prompts
- **Multi-Environment** — Manage production, staging, and custom environments

## Prerequisites

- Node.js >= 24
- SSH access to target server

## Installation

```bash
# npm
npm install -D @kaffee/lungo

# yarn
yarn add -D @kaffee/lungo

# pnpm
pnpm add -D @kaffee/lungo
```

## Quick Start

```bash
# Generate config interactively
npx lungo init --env production

# Deploy to production
npx lungo deploy --env production

# List available backups
npx lungo list --env production

# Rollback to latest backup
npx lungo rollback --env production --to latest
```

## Commands

### `deploy`

Deploy your dist folder to the remote server.

```bash
lungo deploy --env <name> [options]
```

| Option | Alias | Description |
|--------|-------|-------------|
| `--env` | `-e` | Environment name (required) |
| `--config` | `-c` | Config file path (default: `lungo.config.json`) |
| `--dry-run` | `-n` | Show deployment plan without executing |
| `--verbose` | `-v` | Enable verbose output |
| `--no-backup` | | Skip backup step |
| `--no-cleanup` | | Skip old backup cleanup |

### `init`

Generate a `lungo.config.json` interactively.

```bash
lungo init [--env <name>] [--force]
```

| Option | Alias | Description |
|--------|-------|-------------|
| `--env` | `-e` | Environment name |
| `--force` | `-f` | Overwrite existing config file |

### `list`

List backups available on the remote server.

```bash
lungo list --env <name>
```

| Option | Alias | Description |
|--------|-------|-------------|
| `--env` | `-e` | Environment name (required) |
| `--config` | `-c` | Config file path |

### `rollback`

Rollback to a previous backup.

```bash
lungo rollback --env <name> --to <timestamp|latest>
```

| Option | Alias | Description |
|--------|-------|-------------|
| `--env` | `-e` | Environment name (required) |
| `--to` | | Backup timestamp or `"latest"` (required) |
| `--config` | `-c` | Config file path |
| `--dry-run` | `-n` | Show rollback plan without executing |
| `--verbose` | `-v` | Enable verbose output |

## Configuration

Create a `lungo.config.json` in your project root:

```json
{
  "production": {
    "host": "192.168.1.1",
    "port": 22,
    "username": "deploy",
    "password": "your-password",
    "serverDir": "/var/www",
    "project": "my-app",
    "dist": "dist"
  }
}
```

### Config Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `host` | `string` | — | SSH server hostname or IP (required) |
| `port` | `number` | `22` | SSH port |
| `username` | `string` | — | SSH username (required) |
| `password` | `string` | — | SSH password (optional if using key auth) |
| `privateKey` | `string` | — | Path to SSH private key |
| `passphrase` | `string` | — | Passphrase for encrypted private key |
| `serverDir` | `string` | — | Remote directory path (required) |
| `project` | `string` | — | Project name, used for backup naming (required) |
| `dist` | `string` | `"dist"` | Local directory to deploy |
| `timeout` | `number` | — | Connection timeout in ms |
| `preDeploy` | `string` | — | Command to run before deploy |
| `postDeploy` | `string` | — | Command to run after deploy |

### Bastion / Jump Host

Deploy through an intermediate server:

```json
{
  "production": {
    "host": "10.0.0.1",
    "username": "deploy",
    "serverDir": "/var/www",
    "project": "my-app",
    "forward": {
      "host": "bastion.example.com",
      "port": 22,
      "username": "admin",
      "password": "bastion-password"
    }
  }
}
```

| Forward Field | Type | Default | Description |
|---------------|------|---------|-------------|
| `host` | `string` | — | Bastion server hostname (required) |
| `port` | `number` | `22` | Bastion SSH port |
| `username` | `string` | — | Bastion SSH username (required) |
| `password` | `string` | — | Bastion SSH password |
| `privateKey` | `string` | — | Bastion SSH private key path |
| `passphrase` | `string` | — | Bastion private key passphrase |
| `forwardHost` | `string` | `"127.0.0.1"` | Target host from bastion's perspective |
| `forwardPort` | `number` | `0` | Target port from bastion's perspective |

### Webhook Notifications

Send deploy status to a webhook:

```json
{
  "production": {
    "host": "192.168.1.1",
    "notify": {
      "url": "https://hooks.example.com/deploy",
      "method": "POST",
      "headers": {
        "Authorization": "Bearer token"
      }
    }
  }
}
```

### Backup Configuration

```json
{
  "production": {
    "host": "192.168.1.1",
    "backup": {
      "enabled": true,
      "keep": 10
    }
  }
}
```

| Backup Field | Type | Default | Description |
|--------------|------|---------|-------------|
| `enabled` | `boolean` | `true` | Enable/disable backups |
| `keep` | `number` | `10` | Number of backups to retain |

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Contributors

<a href="https://github.com/Muromi-Rikka">
  <img style="border-radius:200px;" src="https://github.com/Muromi-Rikka.png?size=50">
</a>

## License

[Apache-2.0](https://choosealicense.com/licenses/apache-2.0/)
