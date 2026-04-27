# Remote Control Plane Runbook

## Service Overview

The Remote Control Plane (RCP) is the cloud-hosted counterpart to the Local Control Plane. It provides:

- Multi-tenant fleet management
- Agent registration and heartbeat tracking
- Task dispatch to remote agents
- Audit synchronization across agents
- JWT and API key authentication
- Sync record management for cross-device state

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check with stats |
| POST | `/api/rcp/auth/login` | Email-based login, returns JWT |
| POST | `/api/rcp/auth/api-keys` | Create API key |
| POST | `/api/rcp/tenants` | Create tenant |
| GET | `/api/rcp/tenants` | List tenants |
| GET | `/api/rcp/tenants/:tenantId` | Get tenant |
| PATCH | `/api/rcp/tenants/:tenantId` | Update tenant |
| POST | `/api/rcp/users` | Create user |
| GET | `/api/rcp/users` | List users |
| GET | `/api/rcp/users/:userId` | Get user |
| POST | `/api/rcp/fleet/register` | Register fleet agent |
| POST | `/api/rcp/fleet/heartbeat` | Agent heartbeat |
| GET | `/api/rcp/fleet/agents` | List agents |
| GET | `/api/rcp/fleet/agents/:agentId` | Get agent |
| DELETE | `/api/rcp/fleet/agents/:agentId` | Deregister agent |
| POST | `/api/rcp/fleet/detect-stale` | Detect stale agents |
| POST | `/api/rcp/dispatch` | Dispatch task to agent |
| POST | `/api/rcp/dispatch/:dispatchId/acknowledge` | Acknowledge dispatch |
| GET | `/api/rcp/dispatch` | List dispatches |
| POST | `/api/rcp/sync` | Record sync entry |
| POST | `/api/rcp/audit-sync` | Record audit sync |
| GET | `/api/rcp/audit-sync` | List audit sync entries |
| GET | `/api/rcp/stats` | Service statistics |

## Authentication

Two methods:

1. **JWT Bearer Token**: `Authorization: Bearer <token>` — obtain via `/api/rcp/auth/login`
2. **API Key**: `Authorization: ApiKey <secret>` — create via `/api/rcp/auth/api-keys`

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3020 | Service port |
| `HOST` | 0.0.0.0 | Bind host |
| `DATABASE_URL` | http://127.0.0.1:8080 | libSQL/Turso URL |
| `DATABASE_AUTH_TOKEN` | (empty) | Turso auth token |
| `JWT_SECRET` | dev-secret-... | JWT signing secret |
| `JWT_ISSUER` | apex-rcp | JWT issuer claim |
| `JWT_AUDIENCE` | apex-services | JWT audience claim |
| `JWT_EXPIRY_SECONDS` | 3600 | Token expiry |
| `CORS_ORIGINS` | * | CORS allowed origins |
| `RATE_LIMIT_MAX` | 100 | Max requests per window |
| `RATE_LIMIT_WINDOW_MS` | 60000 | Rate limit window |
| `FLEET_HEARTBEAT_TIMEOUT_MS` | 60000 | Agent stale timeout |
| `SYNC_ENABLED` | false | Enable local sync |
| `SYNC_INTERVAL_MS` | 30000 | Sync interval |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | (empty) | OTEL endpoint |

## Deployment

### Docker Compose

```bash
cd infra/docker
docker compose up -d
```

### Kubernetes

```bash
kubectl apply -f infra/k8s/remote-control-plane.yaml
```

### Manual

```bash
./scripts/bootstrap-rcp.sh
```

## Health Check

```bash
curl http://localhost:3020/health
```

Response includes service status, version, and live statistics.

## Troubleshooting

### Agent not registering
- Check auth headers are correct
- Verify tenant exists
- Check rate limits

### JWT validation failing
- Ensure JWT_SECRET matches across services
- Check token expiry
- Verify issuer/audience claims

### Stale agents
- Call `POST /api/rcp/fleet/detect-stale` to mark agents with expired heartbeats
- Adjust `FLEET_HEARTBEAT_TIMEOUT_MS` for your network latency

## Blocking Dependencies

- **libSQL/Turso**: Requires running libSQL server for persistent storage (currently uses in-memory Maps)
- **TLS/SSL**: Production deployment requires TLS termination (reverse proxy or ingress)
- **IdP Integration**: SSO/OIDC requires external identity provider
