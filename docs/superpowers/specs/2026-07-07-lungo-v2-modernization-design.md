# Lungo v2.0.0 — Full Modernization Design

## Overview

`@kaffee/lungo` is a CLI tool for deploying static assets to remote servers via SSH/SFTP. It has been unmaintained for ~2 years. This design covers a comprehensive modernization from v1.1.1 to v2.0.0, delivered as a single major release.

### Objectives

- Upgrade the entire toolchain to current ecosystem standards
- Add security hardening (SSH key auth, credential protection)
- Improve developer experience (interactive init, verbose output, dry-run)
- Extend functionality (rollback, deploy hooks, webhook notifications)
- Establish engineering foundations (tests, CI/CD, linting)
- **Maintain full backward compatibility** with v1.x `lungo.config.json` format and CLI invocation

---

## Toolchain

| Concern | v1.x | v2.0 |
|---------|------|------|
| Build | Rollup | **rslib** |
| CLI framework | minimist | **citty** (unjs) |
| Config loading | `JSON.parse` + Set check | **c12** (unjs) + **zod** |
| Logging | chalk + `console.log` | **consola** (unjs) |
| Date | dayjs | dayjs (keep) |
| Tables | console-table-printer | console-table-printer (keep) |
| ZIP | adm-zip | adm-zip (keep) |
| SSH/SFTP | ssh2 | ssh2 (keep) |
| Testing | none | **vitest** |
| Linting | none | **ESLint** flat config + **Prettier** |
| CI/CD | none | GitHub Actions (ref: espresso) |

### Why these choices

- **rslib** over Rollup: Rsbuild-based, near-zero config for CJS + DTS output, native shebang banner support, faster builds
- **citty** over minimist: type-safe args, subcommand support, auto-generated `--help`, built by unjs
- **c12** over hand-rolled: multi-format config loading (JSON/YAML/TS), env overrides, config watching, zod integration
- **consola** over chalk+console: unified log levels (verbose/info/warn/error/debug), tag support, output formatting in one package

---

## Project Structure

```
lungo/
├── src/
│   ├── bin.ts                      # CLI entry — citty runMain()
│   ├── commands/
│   │   ├── deploy.ts               # Default command: full deploy pipeline
│   │   ├── init.ts                 # Interactive config wizard
│   │   ├── list.ts                 # List remote backups
│   │   └── rollback.ts             # Rollback to a previous backup
│   ├── core/
│   │   ├── ssh.ts                  # SSH connection (password + key + bastion)
│   │   ├── sftp.ts                 # SFTP file transfer
│   │   ├── zip.ts                  # Local zip packaging
│   │   └── remote-exec.ts          # Remote command execution via SSH
│   ├── config/
│   │   ├── schema.ts               # Zod schema + inferred Config type
│   │   └── loader.ts               # c12 config loading + validation
│   ├── services/
│   │   ├── backup.ts               # Backup listing, cleanup, rollback
│   │   ├── pipeline.ts             # Deploy pipeline orchestrator
│   │   └── notify.ts               # Post-deploy webhook notification
│   └── utils/
│       ├── logger.ts               # consola instance configuration
│       └── progress.ts             # Progress bar utility
├── tests/
│   ├── core/                       # Unit: ssh, sftp, zip, remote-exec
│   ├── config/                     # Unit: schema, loader
│   ├── services/                   # Unit: backup, pipeline, notify
│   ├── integration/                # Integration: Docker sshd container
│   └── cli/snapshots/              # CLI help/output snapshots
├── rslib.config.ts
├── tsconfig.json
├── eslint.config.mjs
├── .prettierrc
├── vitest.config.ts
└── .github/workflows/
    ├── ci.yml
    └── publish.yml
```

---

## CLI Command Design (citty)

### Command Tree

```
lungo
│
├── deploy [--env <env>]        # Default command — full deployment
│   ├── --env, -e <string>           Environment name (required)
│   ├── --config, -c <path>          Config file path (default: lungo.config.json)
│   ├── --dry-run, -n                Show plan without executing
│   ├── --verbose, -v                Verbose output
│   ├── --no-backup                  Skip backup step
│   └── --no-cleanup                 Skip old backup cleanup
│
├── init                         # Interactive config generation wizard
│   ├── --env, -e <string>           Target environment name
│   └── --force, -f                  Overwrite existing config
│
├── list [--env <env>]           # List backups on remote server
│   ├── --env, -e <string>
│   └── --config, -c <path>
│
├── rollback [--env <env>]       # Rollback to a specific backup
│   ├── --env, -e <string>
│   ├── --to <timestamp>             Backup timestamp or "latest"
│   ├── --config, -c <path>
│   ├── --dry-run, -n
│   └── --verbose, -v
│
├── --version, -v                # Print version
└── --help, -h                   # Print help
```

### Backward Compatibility

- `lungo --env production` without a subcommand defaults to `deploy`
- `lungo.config.json` is read as before; c12 also accepts `.yaml`, `.ts`, `.toml`, etc.
- All new config fields are optional

---

## Configuration Schema (zod)

```typescript
const ConfigSchema = z.object({
  // --- Required (v1.x parity) ---
  serverDir: z.string(),
  host: z.string(),
  port: z.number().default(22),
  username: z.string(),
  password: z.string().optional(),
  project: z.string(),
  dist: z.string().default('dist'),

  // --- v1.x optional fields ---
  timeout: z.number().optional(),
  forward: z.object({
    host: z.string(),
    port: z.number().default(22),
    username: z.string(),
    password: z.string(),
  }).optional(),

  // --- v2.0 new fields (all optional) ---
  privateKey: z.string().optional(),       // Path to SSH private key
  passphrase: z.string().optional(),       // Private key passphrase
  preDeploy: z.string().optional(),        // Local script before deploy
  postDeploy: z.string().optional(),       // Remote command after deploy
  notify: z.object({
    url: z.string(),
    method: z.enum(['POST', 'GET']).default('POST'),
    headers: z.record(z.string()).optional(),
  }).optional(),
  backup: z.object({
    enabled: z.boolean().default(true),
    keep: z.number().default(10),          // Max backup count (complements timeout)
  }).optional(),
});

type Config = z.infer<typeof ConfigSchema>;
```

### Key design decisions

- `password` changed from required to optional — allows key-based auth
- `port` defaults to 22 — v1.x configs that omitted `port` still work
- `dist` defaults to `'dist'` — v1.x configs that omitted `dist` still work
- `backup.keep` (count-based) complements `timeout` (age-based) cleanup
- `privateKey` + `passphrase` enable key-based SSH auth

---

## Deploy Pipeline Flow

```
CLI (citty)
  │
  ▼
Config Loader (c12 + zod)
  │ Read & validate lungo.config.json
  ▼
Deploy Pipeline (pipeline.ts)
  │
  ├─ 1. SSH Connect (core/ssh.ts)
  │      password | privateKey | bastion forward | --ask-pass
  │
  ├─ 2. List Backups (services/backup.ts)
  │      ls *.bak.* on remote, sort by timestamp
  │
  ├─ 3. Cleanup Old Backups (services/backup.ts)
  │      rm backups exceeding timeout or keep count
  │
  ├─ 4. Backup Current (services/backup.ts)
  │      mv project → project.bak.<timestamp>
  │
  ├─ 5. Pre-deploy Hook
  │      config.preDeploy: local shell command
  │
  ├─ 6. Package (core/zip.ts)
  │      Walk dist/ → adm-zip buffer
  │
  ├─ 7. Upload (core/sftp.ts)
  │      SFTP stream zip to remote server
  │
  ├─ 8. Unzip (core/remote-exec.ts)
  │      unzip → rm zip on remote
  │
  ├─ 9. Post-deploy Hook
  │      config.postDeploy: remote shell command via exec$
  │
  └─ 10. Notify (services/notify.ts)
         Webhook POST/GET with deploy result
```

### Error handling

- Each step fails-fast: error terminates the pipeline immediately
- Previously executed steps (backup, upload) are NOT rolled back — data safety over automation
- Error message identifies exactly which step failed with context
- Dry-run mode logs every step as `[DRY-RUN]` without touching remote

---

## Security

### SSH Authentication Priority

1. `config.privateKey` — path to SSH private key file
2. `config.password` — plaintext password in config file (legacy)
3. Interactive prompt — if neither is provided, prompt with hidden echo

### Credential Protection

- Config file permission check: on Unix, warn if other-readable
- consola automatically sanitizes `password` and `passphrase` fields in log output (shown as `***`)
- Recommend `.gitignore` or `lungo.config.local.json` for credential-containing files

---

## Build Configuration (rslib)

```typescript
// rslib.config.ts
import { defineConfig } from '@rslib/core';

export default defineConfig({
  source: {
    entry: { index: 'src/bin.ts' },
  },
  lib: [
    {
      format: 'cjs',
      syntax: 'es2021',
      output: {
        distPath: './dist',
        banner: { js: '#!/usr/bin/env node' },
      },
    },
  ],
  output: {
    cleanDistPath: true,
  },
});
```

- CJS output with shebang for direct CLI invocation
- Single entry point (`src/bin.ts`)
- `cleanDistPath` replaces the custom `rmdirSync` plugin from the Rollup config

---

## Testing (vitest)

### Unit tests (`tests/core/`, `tests/config/`, `tests/services/`)

- Mock `ssh2` Client and SFTP streams
- Mock `adm-zip` for zip operations
- Test zod schema: valid configs, invalid configs, partial configs with defaults, backward-compatible old config shapes
- Test c12 loader: defaults merging, environment overrides
- Test backup logic: file list parsing, timeout calculation, keep-count enforcement
- Test pipeline: step ordering, error propagation, dry-run gating

### Integration tests (`tests/integration/`)

- Docker-based sshd container
- Full deploy → verify → backup → rollback cycle

### CLI snapshot tests (`tests/cli/`)

- `--help` output stability
- Error messages for missing config, missing env, validation failures

### Coverage

- Target: 80% lines, 75% branches, 80% functions, 80% statements
- Provider: v8 (`@vitest/coverage-v8`)

---

## CI/CD (GitHub Actions)

### `ci.yml` — on push & PR

```yaml
name: CI
on: [push, pull_request]
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - checkout@v4, pnpm/action-setup@v4, setup-node@v4 (node 22)
      - pnpm install --frozen-lockfile
      - pnpm lint
      - pnpm typecheck

  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node: [18, 20, 22]
    steps:
      - checkout@v4, pnpm/action-setup@v4, setup-node@v4 (matrix.node)
      - pnpm install --frozen-lockfile
      - pnpm test --coverage

  build:
    runs-on: ubuntu-latest
    steps:
      - checkout@v4, pnpm/action-setup@v4, setup-node@v4 (node 22)
      - pnpm install --frozen-lockfile
      - pnpm build
```

### `publish.yml` — on tag `v*` (ref: espresso)

```yaml
name: Publish to npm
on:
  push:
    tags: ['v*']
jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    steps:
      - checkout@v4
      - pnpm/action-setup@v4
      - setup-node@v4 (node 22, registry: npmjs.org)
      - pnpm install --frozen-lockfile
      - pnpm build
      - pnpm test
      - npm publish --provenance --access public
```

- Tag pattern `v2.0.0` triggers publish
- `--provenance` for npm supply-chain attestation
- `id-token: write` for tokenless auth with provenance
- Tests run before publish as a safety gate

---

## Migration Path for v1.x Users

| Change | Impact | User Action |
|--------|--------|-------------|
| All config fields preserved | None | No action required |
| `password` → optional | None | Old configs with password work as-is |
| New fields: `privateKey`, `backup`, `notify`, etc. | Opt-in | Add to config to enable new features |
| CLI: `lungo --env prod` | None | Works identically |
| CLI: `lungo deploy --env prod` | None | Equivalent, more explicit |
| package.json `bin` path unchanged | None | No change |

---

## Out of Scope

- ESM output (CJS only for CLI shebang compatibility; ESM migration deferred to future major version)
- Windows native SSH (rely on ssh2)
- Multi-file parallel upload (zip-and-unzip approach is sufficient for static site deployments)
- Configuration encryption (users should use file permissions and `.gitignore`)
- Plugin system
