# TriMetric MCP Server

Local MCP server for safe development automation in this repository.

## Included Tools

- `quality_check`: runs `pnpm lint`
- `build_check`: runs `pnpm build`
- `dev_boot`: runs `docker compose up -d` for approved services
- `backend_migrate`: runs backend migrations with explicit confirmation
- `changed_files_review`: summarizes current git changes with risk hints
- `env_sanity_check`: checks required env values and common misconfigurations
- `dependency_audit`: runs `pnpm audit --recursive --prod --audit-level high`
- `impacted_quality_check`: runs lint/build only on workspaces touched by current git changes
- `secret_scan`: scans repository files for likely hardcoded secrets/key material

## Guardrails

- Command allowlist only (no arbitrary shell execution)
- Scope lock to repository root
- Timeout per tool
- Manual confirmation required for `backend_migrate`
- Secret scan ignores binary/build directories and caps output to reduce noise
- Invocation logging in `.mcp/invocations.log`
- Readonly/write mode split via `MCP_MODE`

## Run

```bash
pnpm --filter @trimetric/mcp-server start
```

Defaults to readonly mode:

```bash
MCP_MODE=readonly pnpm --filter @trimetric/mcp-server start
```

Enable write tools (`dev_boot`, `backend_migrate`):

```bash
MCP_MODE=write pnpm --filter @trimetric/mcp-server start
```

## Example MCP client config

Use the command and args below in your MCP client:

- command: `pnpm`
- args: `["--filter", "@trimetric/mcp-server", "start"]`
- env (recommended):
  - `MCP_MODE=readonly` (or `write` when you intentionally need side effects)
