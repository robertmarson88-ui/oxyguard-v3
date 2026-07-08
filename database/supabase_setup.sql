-- OxyGuard Supabase setup and demo data.
-- Run this in the Supabase SQL editor for project rdycpkfydfibrczdigfa.

create table if not exists public.roles (
  role_id serial primary key,
  role_name varchar(50) unique not null
);

create table if not exists public.permissions (
  permission_id serial primary key,
  permission_name varchar(100) unique not null
);

alter table public.permissions add column if not exists permission_name varchar(100);
alter table public.permissions add column if not exists permission_key varchar(100);
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'permissions'
      and column_name = 'permission_key'
  ) then
    execute 'update public.permissions set permission_name = coalesce(permission_name, permission_key) where permission_name is null';
  end if;
end $$;

create table if not exists public.role_permissions (
  role_id integer not null references public.roles(role_id),
  permission_id integer not null references public.permissions(permission_id),
  primary key (role_id, permission_id)
);

create table if not exists public.users (
  user_id varchar(10) primary key,
  username varchar(100) unique not null,
  email varchar(150) not null,
  email_verified boolean default false not null,
  password_hash varchar(255) not null,
  role_id integer not null references public.roles(role_id),
  created_at timestamptz default now() not null
);

alter table public.users drop constraint if exists users_email_key;

create table if not exists public.wards (
  ward_id varchar(50) primary key,
  ward_name varchar(100) not null,
  location varchar(100)
);

create table if not exists public.devices (
  device_id varchar(50) primary key,
  ward_id varchar(50) not null references public.wards(ward_id),
  created_at timestamptz default now() not null,
  device_name varchar(100),
  device_status varchar(30) default 'active',
  last_seen timestamptz,
  bed_id varchar(30),
  constraint devices_device_id_pattern check (device_id ~ '^[A-Z]{2}[0-9]{3}$')
);

alter table public.devices add column if not exists device_name varchar(100);
alter table public.devices add column if not exists device_status varchar(30) default 'active';
alter table public.devices add column if not exists last_seen timestamptz;
alter table public.devices add column if not exists bed_id varchar(30);

create table if not exists public.telemetry_logs (
  log_id bigserial primary key,
  device_id varchar(50) not null references public.devices(device_id),
  ward_id varchar(50) not null references public.wards(ward_id),
  flow_rate numeric(5,2) not null,
  operational_status varchar(20) not null,
  device_timestamp timestamptz not null,
  received_at timestamptz default now() not null,
  constraint telemetry_logs_flow_rate_range check (flow_rate >= 0.0 and flow_rate <= 100.0)
);

alter table public.telemetry_logs drop constraint if exists telemetry_logs_operational_status_check;
update public.telemetry_logs
set operational_status = case
  when lower(operational_status) in ('normal', 'warning', 'critical', 'hardware_fault')
    then lower(operational_status)
  when lower(operational_status) in ('fault', 'sensor_fault', 'offline')
    then 'hardware_fault'
  when lower(operational_status) in ('high', 'high_flow', 'leak', 'leak_detection')
    then 'warning'
  else 'normal'
end;
alter table public.telemetry_logs
  add constraint telemetry_logs_operational_status_check
  check (operational_status in ('normal', 'warning', 'critical', 'hardware_fault'));

create table if not exists public.alerts (
  alert_id serial primary key,
  log_id bigint references public.telemetry_logs(log_id),
  device_id varchar(50) not null references public.devices(device_id),
  alert_type varchar(50) not null,
  severity varchar(20) not null,
  is_resolved boolean default false not null,
  resolved_by varchar(10) references public.users(user_id),
  resolved_at timestamptz,
  created_at timestamptz default now() not null
);

alter table public.alerts add column if not exists log_id bigint references public.telemetry_logs(log_id);
alter table public.alerts drop constraint if exists alerts_severity_check;
alter table public.alerts
  add constraint alerts_severity_check
  check (severity in ('high', 'medium', 'low', 'critical', 'High', 'Medium', 'Low'));

create table if not exists public.audit_logs (
  audit_id serial primary key,
  user_id varchar(10) not null references public.users(user_id),
  action varchar(100) not null,
  target_resource varchar(100) not null,
  ip_address inet,
  performed_at timestamptz default now() not null
);

alter table public.audit_logs add column if not exists target_resource varchar(100);
alter table public.audit_logs add column if not exists ip_address inet;
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'audit_logs'
      and column_name = 'target'
  ) then
    execute 'update public.audit_logs set target_resource = coalesce(target_resource, target) where target_resource is null';
  end if;
end $$;

create table if not exists public.patient_assignments (
  assignment_id bigserial primary key,
  anonymized_patient_id varchar(30) unique not null,
  ward_id varchar(50) not null references public.wards(ward_id),
  station varchar(30) not null,
  prescribed_flow_lpm numeric(5,2) not null,
  live_reading_lpm numeric(5,2) not null,
  flow_variance_percent numeric(6,2) not null,
  alert_status varchar(20) not null,
  alert_state varchar(20) default 'active' not null,
  is_active boolean default true not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  constraint patient_alert_status_check check (alert_status in ('normal', 'low_flow', 'high_flow'))
);

create index if not exists devices_ward_id_idx on public.devices(ward_id);
create index if not exists telemetry_logs_device_timestamp_idx on public.telemetry_logs(device_id, device_timestamp desc);
create index if not exists telemetry_logs_ward_timestamp_idx on public.telemetry_logs(ward_id, device_timestamp desc);
create index if not exists telemetry_logs_status_timestamp_idx on public.telemetry_logs(operational_status, device_timestamp desc);
create index if not exists alerts_device_id_idx on public.alerts(device_id);
create index if not exists alerts_unresolved_idx on public.alerts(is_resolved, severity);
create index if not exists audit_logs_user_performed_idx on public.audit_logs(user_id, performed_at desc);
create index if not exists patient_assignments_active_idx on public.patient_assignments(is_active, ward_id, alert_status);

insert into public.roles (role_id, role_name) values
  (1, 'Administrator'),
  (2, 'Executive / CFO'),
  (3, 'Facilities Manager'),
  (4, 'Nurse Manager'),
  (5, 'Nurse')
on conflict (role_id) do update set role_name = excluded.role_name;

insert into public.permissions (permission_id, permission_name, permission_key) values
  (1, 'resolve_alert', 'resolve_alert'),
  (2, 'view_logs', 'view_logs')
on conflict (permission_id) do update set
  permission_name = excluded.permission_name,
  permission_key = excluded.permission_key;

update public.permissions
set permission_key = coalesce(permission_key, permission_name)
where permission_key is null;

insert into public.role_permissions (role_id, permission_id) values
  (1, 1), (1, 2), (2, 2), (3, 2), (4, 1), (4, 2), (5, 2)
on conflict do nothing;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'users'
      and column_name = 'user_id'
      and data_type in ('character varying', 'text')
  ) then
    execute $users$
      insert into public.users (user_id, username, email, email_verified, password_hash, role_id, created_at) values
        ('AA001', 'martin', 'robinsonmartin187@gmail.com', true, 'demo-hash:martin-2026', 1, '2026-06-09 08:00:00+00'),
        ('AA002', 'robertm', 'marsonrobert88@gmail.com', true, 'demo-hash:robertm-2026', 1, '2026-06-09 08:00:00+00'),
        ('AA003', 'vernon', 'vernon.dacosta@gmail.com', true, 'demo-hash:vernon-2026', 1, '2026-06-09 08:00:00+00'),
        ('AA004', 'user1', 'robertmarson88@gmail.com', true, 'demo-hash:user1-2026', 1, '2026-06-09 08:00:00+00'),
        ('AA005', 'user2', 'robertmarson88@gmail.com', true, 'demo-hash:user2-2026', 1, '2026-06-09 08:00:00+00'),
        ('AA006', 'martinm', 'robinsonmartin187@gmail.com', true, 'demo-hash:martinm-2026', 1, '2026-06-09 08:00:00+00'),
        ('AA007', 'vernond', 'vernon.dacosta@gmail.com', true, 'demo-hash:vernond-2026', 1, '2026-06-09 08:00:00+00')
      on conflict (user_id) do update set
        username = excluded.username,
        email = excluded.email,
        email_verified = excluded.email_verified,
        password_hash = excluded.password_hash,
        role_id = excluded.role_id
    $users$;
  end if;
end $$;

insert into public.wards (ward_id, ward_name, location) values
  ('X001', 'Labour', '7a East Wing'),
  ('X002', 'A&E', '12c North Wing'),
  ('X003', 'Maternity', '3a South Wing'),
  ('X004', 'Nurse Station', '11b West Wing'),
  ('X005', 'Paediatric Ward', '11c West Wing')
on conflict (ward_id) do update set
  ward_name = excluded.ward_name,
  location = excluded.location;

insert into public.devices (device_id, ward_id, created_at, device_name, device_status, last_seen, bed_id) values
  ('TK001', 'X001', '2026-06-09 08:00:00+00', 'Labour Flow Sensor 1', 'active', now(), null),
  ('TK002', 'X001', '2026-06-09 08:00:00+00', 'Labour Flow Sensor 2', 'active', now(), null),
  ('TK003', 'X001', '2026-06-09 08:00:00+00', 'Labour Flow Sensor 3', 'active', now(), null),
  ('TK004', 'X003', '2026-06-09 08:00:00+00', 'Maternity Flow Sensor 1', 'active', now(), null),
  ('TK005', 'X003', '2026-06-09 08:00:00+00', 'Maternity Flow Sensor 2', 'maintenance', now() - interval '7 minutes', null),
  ('TK006', 'X003', '2026-06-09 08:00:00+00', 'Maternity Flow Sensor 3', 'active', now(), null),
  ('TK007', 'X002', '2026-06-09 08:00:00+00', 'A&E Flow Sensor 1', 'active', now(), null),
  ('TK008', 'X002', '2026-06-09 08:00:00+00', 'A&E Flow Sensor 2', 'active', now(), null)
on conflict (device_id) do update set
  ward_id = excluded.ward_id,
  device_name = excluded.device_name,
  device_status = excluded.device_status,
  last_seen = excluded.last_seen,
  bed_id = excluded.bed_id;

with demo_events(device_id, ward_id, flow_rate, operational_status, device_timestamp) as (
  values
    ('TK001', 'X001', 4.80::numeric, 'normal', now() - interval '12 minutes'),
    ('TK004', 'X003', 31.20::numeric, 'warning', now() - interval '10 minutes'),
    ('TK005', 'X003', 0.00::numeric, 'hardware_fault', now() - interval '8 minutes'),
    ('TK007', 'X002', 34.60::numeric, 'critical', now() - interval '6 minutes'),
    ('TK008', 'X002', 15.40::numeric, 'warning', now() - interval '4 minutes')
)
insert into public.telemetry_logs (device_id, ward_id, flow_rate, operational_status, device_timestamp, received_at)
select device_id, ward_id, flow_rate, operational_status, device_timestamp, device_timestamp
from demo_events
where not exists (select 1 from public.telemetry_logs);

with alert_rows as (
  select log_id, device_id, 'high_consumption'::varchar as alert_type, 'critical'::varchar as severity, device_timestamp
  from public.telemetry_logs where device_id = 'TK007'
  union all
  select log_id, device_id, 'sensor_fault', 'high', device_timestamp
  from public.telemetry_logs where device_id = 'TK005'
  union all
  select log_id, device_id, 'leak_detection', 'medium', device_timestamp
  from public.telemetry_logs where device_id = 'TK008'
  union all
  select log_id, device_id, 'ghost_flow', 'medium', device_timestamp
  from public.telemetry_logs where device_id = 'TK004'
  union all
  select log_id, device_id, 'device_offline', 'high', device_timestamp
  from public.telemetry_logs where device_id = 'TK005'
)
insert into public.alerts (log_id, device_id, alert_type, severity, is_resolved, created_at)
select log_id, device_id, alert_type, severity, false, device_timestamp
from alert_rows
where not exists (
  select 1 from public.alerts a
  where a.device_id = alert_rows.device_id and a.alert_type = alert_rows.alert_type and a.is_resolved = false
);

with patient_source as (
  select
    series as n,
    ('PX-' || lpad(series::text, 3, '0')) as anonymized_patient_id,
    (array['X001', 'X002', 'X003', 'X004', 'X005'])[1 + ((series - 1) % 5)] as ward_id,
    ('Bed ' || lpad(series::text, 2, '0')) as station,
    (2 + ((series - 1) % 6))::numeric(5,2) as prescribed_flow_lpm
  from generate_series(1, 35) as series
),
patient_readings as (
  select
    *,
    case
      when n % 11 = 0 then prescribed_flow_lpm * 1.35
      when n % 7 = 0 then prescribed_flow_lpm - 0.5
      when n % 3 = 0 then prescribed_flow_lpm * 1.18
      else prescribed_flow_lpm
    end::numeric(5,2) as live_reading_lpm
  from patient_source
),
patient_status as (
  select
    *,
    round(((live_reading_lpm - prescribed_flow_lpm) / prescribed_flow_lpm) * 100, 2) as flow_variance_percent,
    case
      when live_reading_lpm < prescribed_flow_lpm then 'low_flow'
      when live_reading_lpm >= prescribed_flow_lpm * 1.29 and live_reading_lpm <= prescribed_flow_lpm * 1.40 then 'high_flow'
      else 'normal'
    end as alert_status
  from patient_readings
)
insert into public.patient_assignments (
  anonymized_patient_id,
  ward_id,
  station,
  prescribed_flow_lpm,
  live_reading_lpm,
  flow_variance_percent,
  alert_status,
  alert_state,
  is_active,
  updated_at
)
select
  anonymized_patient_id,
  ward_id,
  station,
  prescribed_flow_lpm,
  live_reading_lpm,
  flow_variance_percent,
  alert_status,
  'active',
  true,
  now()
from patient_status
on conflict (anonymized_patient_id) do update set
  ward_id = excluded.ward_id,
  station = excluded.station,
  prescribed_flow_lpm = excluded.prescribed_flow_lpm,
  live_reading_lpm = excluded.live_reading_lpm,
  flow_variance_percent = excluded.flow_variance_percent,
  alert_status = excluded.alert_status,
  alert_state = excluded.alert_state,
  is_active = excluded.is_active,
  updated_at = now();

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'audit_logs'
      and column_name = 'user_id'
      and data_type in ('character varying', 'text')
  ) then
    execute $audit$
      insert into public.audit_logs (user_id, action, target_resource, ip_address, performed_at)
      select 'AA002', 'supabase_demo_seeded', 'OxyGuard Supabase demo data', null, now()
      where not exists (
        select 1 from public.audit_logs
        where action = 'supabase_demo_seeded'
      )
    $audit$;
  end if;
end $$;

alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.users enable row level security;
alter table public.wards enable row level security;
alter table public.devices enable row level security;
alter table public.telemetry_logs enable row level security;
alter table public.alerts enable row level security;
alter table public.audit_logs enable row level security;
alter table public.patient_assignments enable row level security;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

select
  (select count(*) from public.wards) as wards,
  (select count(*) from public.devices) as devices,
  (select count(*) from public.telemetry_logs) as telemetry_logs,
  (select count(*) from public.alerts where is_resolved = false) as active_alerts,
  (select count(*) from public.patient_assignments where is_active = true) as active_patients;
