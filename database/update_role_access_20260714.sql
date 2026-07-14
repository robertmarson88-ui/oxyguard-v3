-- OxyGuard role access validation update
-- Apply in Supabase SQL Editor for project rdycpkfydfibrczdigfa.

begin;

insert into public.roles (role_id, role_name) values
  (1, 'Administrator'),
  (2, 'Executive'),
  (3, 'Facilities Manager'),
  (4, 'Nurse Manager'),
  (5, 'Nurse')
on conflict (role_id) do update
set role_name = excluded.role_name;

insert into public.permissions (permission_id, permission_name, permission_key) values
  (1, 'resolve_alert', 'resolve_alert'),
  (2, 'view_logs', 'view_logs')
on conflict (permission_id) do update
set
  permission_name = excluded.permission_name,
  permission_key = excluded.permission_key;

delete from public.role_permissions
where role_id in (1, 2, 3, 4, 5);

insert into public.role_permissions (role_id, permission_id) values
  (1, 1),
  (1, 2),
  (2, 2),
  (3, 2),
  (4, 2),
  (5, 2)
on conflict do nothing;

update public.users
set role_id = 1
where username = 'robertm';

update public.users
set role_id = 2
where username in ('vernon', 'vernond');

update public.users
set role_id = 4
where username = 'martin';

commit;

select
  u.user_id,
  u.username,
  u.email,
  r.role_name
from public.users u
join public.roles r on r.role_id = u.role_id
where u.username in ('robertm', 'vernon', 'vernond')
   or u.username = 'martin'
order by u.username;
