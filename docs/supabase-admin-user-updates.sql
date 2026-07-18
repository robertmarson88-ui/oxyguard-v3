-- OxyGuard user access update
-- Purpose: make Martin and Vernon administrator accounts and confirm MFA email targets.

with admin_role as (
  select role_id
  from public.roles
  where lower(role_name) in ('administrator', 'facilities admin')
  order by case when lower(role_name) = 'administrator' then 0 else 1 end
  limit 1
)
update public.users
set role_id = (select role_id from admin_role),
    email = case lower(username)
      when 'martin' then 'robinsonmartin187@gmail.com'
      when 'martinm' then 'robinsonmartin187@gmail.com'
      when 'vernon' then 'vernon.dacosta@gmail.com'
      when 'vernond' then 'vernon.dacosta@gmail.com'
      else email
    end,
    email_verified = true
where lower(username) in ('martin', 'martinm', 'vernon', 'vernond');

select u.username, u.email, r.role_name
from public.users u
left join public.roles r on r.role_id = u.role_id
where lower(u.username) in ('martin', 'martinm', 'vernon', 'vernond')
order by u.username;
