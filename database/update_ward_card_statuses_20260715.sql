begin;

create table if not exists public.ward_card_statuses (
  ward_key varchar(40) not null,
  asset_key varchar(40) not null,
  status varchar(30) not null check (status in ('Normal', 'Supply Failure', 'Ghost Flow', 'Flow Anomaly', 'Leakage')),
  updated_by varchar(50),
  updated_at timestamptz not null default now(),
  primary key (ward_key, asset_key)
);

alter table public.ward_card_statuses enable row level security;
revoke all on table public.ward_card_statuses from anon, authenticated;

insert into public.ward_card_statuses (ward_key, asset_key, status) values
  ('ae', 'bed-05', 'Normal'),
  ('ae', 'bed-06', 'Normal'),
  ('ae', 'bed-07', 'Ghost Flow'),
  ('paediatrics', 'bed-10', 'Normal'),
  ('paediatrics', 'bed-11', 'Supply Failure'),
  ('paediatrics', 'bed-12', 'Flow Anomaly'),
  ('recovery', 'bed-15', 'Normal'),
  ('recovery', 'bed-16', 'Normal'),
  ('recovery', 'tank-r1', 'Leakage'),
  ('labour', 'bed-20', 'Normal'),
  ('labour', 'bed-21', 'Supply Failure'),
  ('labour', 'bed-22', 'Normal')
on conflict (ward_key, asset_key) do nothing;

commit;
