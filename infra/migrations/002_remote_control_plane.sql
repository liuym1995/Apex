create table if not exists fleet_agents (
  agent_id varchar(64) primary key,
  tenant_id varchar(64) not null references tenants(tenant_id),
  display_name varchar(255) not null,
  hostname varchar(255) not null,
  ip_address varchar(64) not null,
  status varchar(32) not null default 'unknown',
  capabilities jsonb not null default '[]'::jsonb,
  max_concurrent_tasks integer not null default 5,
  current_task_count integer not null default 0,
  last_heartbeat_at timestamptz not null,
  registered_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_fleet_agents_tenant on fleet_agents(tenant_id, status);
create index if not exists idx_fleet_agents_heartbeat on fleet_agents(last_heartbeat_at desc);

create table if not exists remote_users (
  user_id varchar(64) primary key,
  tenant_id varchar(64) not null references tenants(tenant_id),
  email varchar(255) not null,
  display_name varchar(255) not null,
  role varchar(32) not null default 'viewer',
  status varchar(32) not null default 'active',
  api_key_hash varchar(255) not null default '',
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_remote_users_email on remote_users(tenant_id, email);

create table if not exists api_keys (
  key_id varchar(64) primary key,
  tenant_id varchar(64) not null references tenants(tenant_id),
  user_id varchar(64) not null references remote_users(user_id),
  key_prefix varchar(16) not null,
  key_hash varchar(255) not null,
  name varchar(255) not null,
  scopes jsonb not null default '[]'::jsonb,
  last_used_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_api_keys_prefix on api_keys(key_prefix, key_hash);

create table if not exists sync_records (
  sync_id varchar(64) primary key,
  source_agent_id varchar(64) not null references fleet_agents(agent_id),
  entity_type varchar(64) not null,
  entity_id varchar(64) not null,
  operation varchar(16) not null,
  payload_hash varchar(255) not null,
  synced_at timestamptz not null default now(),
  status varchar(16) not null default 'pending'
);

create index if not exists idx_sync_records_status on sync_records(status, synced_at desc);
create index if not exists idx_sync_records_entity on sync_records(entity_type, entity_id);

create table if not exists remote_task_dispatches (
  dispatch_id varchar(64) primary key,
  task_id varchar(64) not null references tasks(task_id),
  tenant_id varchar(64) not null references tenants(tenant_id),
  target_agent_id varchar(64) not null references fleet_agents(agent_id),
  priority varchar(16) not null default 'medium',
  status varchar(16) not null default 'pending',
  dispatched_at timestamptz,
  acknowledged_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_remote_task_dispatches_agent on remote_task_dispatches(target_agent_id, status);
create index if not exists idx_remote_task_dispatches_tenant on remote_task_dispatches(tenant_id, status);

create table if not exists audit_sync_entries (
  audit_sync_id varchar(64) primary key,
  tenant_id varchar(64) not null references tenants(tenant_id),
  source_agent_id varchar(64) not null references fleet_agents(agent_id),
  action varchar(128) not null,
  payload_json jsonb not null default '{}'::jsonb,
  entity_type varchar(64) not null,
  entity_id varchar(64) not null,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_sync_entries_tenant on audit_sync_entries(tenant_id, synced_at desc);
create index if not exists idx_audit_sync_entries_agent on audit_sync_entries(source_agent_id, synced_at desc);

create table if not exists schema_migrations (
  version integer primary key,
  name varchar(255) not null,
  applied_at timestamptz not null default now()
);
