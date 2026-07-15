begin;

do $$
declare
  nurse_role_id integer;
  supervisor_role_id integer;
begin
  select role_id into nurse_role_id
  from public.roles
  where lower(role_name) = 'nurse'
  limit 1;

  if nurse_role_id is null then
    select coalesce(max(role_id), 0) + 1 into nurse_role_id from public.roles;
    insert into public.roles (role_id, role_name) values (nurse_role_id, 'Nurse');
  end if;

  select role_id into supervisor_role_id
  from public.roles
  where lower(role_name) in ('nurse supervisor', 'nurse manager')
  order by case when lower(role_name) = 'nurse supervisor' then 0 else 1 end
  limit 1;

  if supervisor_role_id is not null then
    insert into public.role_permissions (role_id, permission_id)
    select nurse_role_id, permission_id
    from public.role_permissions
    where role_id = supervisor_role_id
    on conflict do nothing;
  end if;

  insert into public.users
    (user_id, username, email, email_verified, password_hash, role_id, created_at)
  values
    ('AA012', 'nurse', 'ward.nurse@monamercy.local', true, 'demo-plain:nurse1', nurse_role_id, now())
  on conflict (username) do update
  set role_id = excluded.role_id,
      password_hash = excluded.password_hash;
end $$;

commit;
