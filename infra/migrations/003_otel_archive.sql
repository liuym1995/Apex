create table if not exists otel_export_batches (
  batch_id varchar(64) primary key,
  service_name varchar(255) not null,
  span_count integer not null default 0,
  resource_attributes jsonb not null default '{}'::jsonb,
  exported_at timestamptz not null default now(),
  endpoint varchar(512) not null,
  status varchar(16) not null default 'pending',
  response_status_code integer,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_otel_export_batches_status on otel_export_batches(status, exported_at desc);
create index if not exists idx_otel_export_batches_service on otel_export_batches(service_name, exported_at desc);

create table if not exists otel_spans_archive (
  span_id varchar(32) primary key,
  trace_id varchar(32) not null,
  service_name varchar(255) not null,
  name varchar(512) not null,
  kind integer not null,
  start_time timestamptz not null,
  end_time timestamptz not null,
  attributes jsonb not null default '{}'::jsonb,
  status_code integer not null default 0,
  status_message text,
  parent_span_id varchar(32),
  resource_attributes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_otel_spans_trace on otel_spans_archive(trace_id);
create index if not exists idx_otel_spans_service_time on otel_spans_archive(service_name, start_time desc);
create index if not exists idx_otel_spans_parent on otel_spans_archive(parent_span_id);
