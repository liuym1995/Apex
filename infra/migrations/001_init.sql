create table if not exists tenants (
  tenant_id varchar(64) primary key,
  name varchar(255) not null,
  status varchar(32) not null,
  plan varchar(64),
  created_at timestamptz not null default now()
);

create table if not exists users (
  user_id varchar(64) primary key,
  tenant_id varchar(64) not null references tenants(tenant_id),
  email varchar(255) not null,
  display_name varchar(255) not null,
  status varchar(32) not null,
  created_at timestamptz not null default now()
);

create table if not exists tasks (
  task_id varchar(64) primary key,
  tenant_id varchar(64) not null references tenants(tenant_id),
  task_type varchar(32) not null,
  department varchar(32) not null,
  intent text not null,
  priority varchar(16),
  risk_level varchar(16) not null,
  status varchar(32) not null,
  initiator_user_id varchar(64) references users(user_id),
  owner_user_id varchar(64) references users(user_id),
  playbook_version varchar(64),
  task_json jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists task_runs (
  task_run_id varchar(64) primary key,
  task_id varchar(64) not null references tasks(task_id),
  run_no integer not null,
  status varchar(32) not null,
  stop_mode varchar(32),
  started_at timestamptz,
  completed_at timestamptz,
  heartbeat_at timestamptz,
  run_json jsonb not null,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_task_runs_unique_run_no on task_runs(task_id, run_no);
create index if not exists idx_task_runs_status on task_runs(status, started_at desc);

create table if not exists task_artifacts (
  artifact_id varchar(64) primary key,
  task_id varchar(64) not null references tasks(task_id),
  name varchar(255) not null,
  kind varchar(64) not null,
  status varchar(32) not null,
  uri text,
  content text,
  created_at timestamptz not null default now()
);

create index if not exists idx_task_artifacts_task_id on task_artifacts(task_id, created_at desc);

create table if not exists task_checkpoints (
  checkpoint_id varchar(64) primary key,
  task_id varchar(64) not null references tasks(task_id),
  stage varchar(128) not null,
  summary text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_task_checkpoints_task_id on task_checkpoints(task_id, created_at desc);

create table if not exists task_checklist_results (
  task_id varchar(64) primary key references tasks(task_id),
  status varchar(32) not null,
  passed_items jsonb not null default '[]'::jsonb,
  failed_items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists task_reconciliation_results (
  task_id varchar(64) primary key references tasks(task_id),
  status varchar(32) not null,
  matched_states jsonb not null default '[]'::jsonb,
  missing_states jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists task_verification_results (
  task_id varchar(64) primary key references tasks(task_id),
  verdict varchar(32) not null,
  summary text not null,
  missing_items jsonb not null default '[]'::jsonb,
  quality_issues jsonb not null default '[]'::jsonb,
  policy_issues jsonb not null default '[]'::jsonb,
  evidence jsonb not null default '[]'::jsonb,
  recommended_fix jsonb not null default '[]'::jsonb,
  rerun_scope varchar(32) not null,
  created_at timestamptz not null default now()
);

create table if not exists task_done_gate_results (
  task_id varchar(64) primary key references tasks(task_id),
  status varchar(32) not null,
  reasons jsonb not null default '[]'::jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists memory_items (
  memory_id varchar(64) primary key,
  tenant_id varchar(64) references tenants(tenant_id),
  task_id varchar(64) references tasks(task_id),
  kind varchar(32) not null,
  title varchar(255) not null,
  content text not null,
  tags jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_memory_items_kind on memory_items(kind, created_at desc);
create index if not exists idx_memory_items_task_id on memory_items(task_id, created_at desc);

create table if not exists schedules (
  schedule_id varchar(64) primary key,
  tenant_id varchar(64) references tenants(tenant_id),
  cadence varchar(128) not null,
  task_template_json jsonb not null,
  enabled boolean not null default true,
  last_triggered_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists skill_candidates (
  candidate_id varchar(64) primary key,
  task_id varchar(64) not null references tasks(task_id),
  title varchar(255) not null,
  summary text not null,
  evidence jsonb not null default '[]'::jsonb,
  status varchar(32) not null,
  created_at timestamptz not null default now()
);

create table if not exists tool_invocations (
  invocation_id varchar(64) primary key,
  task_id varchar(64) not null references tasks(task_id),
  tool_name varchar(128) not null,
  status varchar(32) not null,
  input_json jsonb not null default '{}'::jsonb,
  output_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_tool_invocations_task_id on tool_invocations(task_id, created_at desc);

create table if not exists worker_runs (
  worker_run_id varchar(64) primary key,
  task_id varchar(64) not null references tasks(task_id),
  worker_kind varchar(64) not null,
  worker_name varchar(255) not null,
  status varchar(32) not null,
  summary text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_worker_runs_task_id on worker_runs(task_id, created_at desc);

create table if not exists audit_entries (
  audit_id varchar(64) primary key,
  tenant_id varchar(64) references tenants(tenant_id),
  task_id varchar(64) references tasks(task_id),
  action varchar(128) not null,
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_entries_task_id on audit_entries(task_id, created_at desc);
