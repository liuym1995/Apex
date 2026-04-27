# libSQL/Turso Boundary Runbook

## Overview

The libSQL/Turso boundary provides a remote-compatible persistence layer that can replace or complement the local SQLite storage. It supports:

- Remote libSQL server (self-hosted or Turso cloud)
- Embedded replica mode for local-first with cloud sync
- In-memory adapter for development and testing
- Migration management with version tracking

## Architecture

```
Local Service → PersistenceAdapter → libSQL Server (remote)
                                  → SQLite (local, embedded replica)
                                  → InMemoryAdapter (dev/test)
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | in-memory | libSQL server URL |
| `DATABASE_AUTH_TOKEN` | (empty) | Authentication token |
| `DATABASE_SYNC_URL` | (empty) | Embedded replica sync URL |
| `DATABASE_SYNC_INTERVAL_MS` | 5000 | Replica sync interval |
| `DATABASE_LOCAL_PATH` | .apex/remote-control-plane.sqlite | Local replica path |
| `DATABASE_CONNECTION_POOL_SIZE` | 5 | Connection pool size |
| `DATABASE_CONNECT_TIMEOUT_MS` | 10000 | Connection timeout |
| `DATABASE_READ_ONLY` | false | Read-only replica mode |

## Migrations

Migrations are stored in `infra/migrations/`:

- `001_init.sql` — Core tables (tenants, users, tasks, etc.)
- `002_remote_control_plane.sql` — RCP tables (fleet_agents, remote_users, api_keys, sync_records, etc.)
- `003_otel_archive.sql` — OTEL archive tables

### Apply Migrations

```bash
./scripts/bootstrap-libsql.sh
```

### Manual Migration

```bash
curl -X POST http://localhost:8080 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"requests": [{"type": "execute", "stmt": {"sql": "CREATE TABLE ..."}}]}'
```

## Deployment

### Docker

```bash
cd infra/docker
docker compose up libsql -d
```

### Turso Cloud

```bash
turso db create apex
turso db show apex --url
turso db tokens create apex
```

### Kubernetes

```bash
kubectl apply -f infra/k8s/remote-control-plane.yaml
```

## PersistenceAdapter Interface

```typescript
interface PersistenceAdapter {
  execute(query: LibSQLQuery): Promise<LibSQLResult>;
  batch(steps: LibSQLBatchStep[]): Promise<LibSQLResult[]>;
  transaction<T>(fn: (adapter: PersistenceAdapter) => Promise<T>): Promise<T>;
  healthCheck(): Promise<LibSQLHealthCheck>;
  close(): void;
}
```

## Switching from SQLite to libSQL

The `InMemoryPersistenceAdapter` implements the same `PersistenceAdapter` interface. When `@libsql/client` is available as a dependency, a `LibSQLPersistenceAdapter` can be created that delegates to the real libSQL client while maintaining the same interface.

Current status: adapter skeleton and contracts are landed. Real `@libsql/client` integration requires the npm package.

## Blocking Dependencies

- **@libsql/client npm package**: Required for real libSQL server connections
- **Turso account or self-hosted libSQL server**: Required for remote persistence
- **TLS certificates**: Required for production connections to Turso cloud
