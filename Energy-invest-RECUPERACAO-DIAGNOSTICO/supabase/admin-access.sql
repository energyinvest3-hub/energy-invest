-- Admin account authorization.
-- Register this e-mail through the normal /cadastro flow once; the database trigger promotes it to ADMIN.
create table if not exists private.admin_email_allowlist (
  email text primary key,
  created_at timestamptz not null default now()
);
insert into private.admin_email_allowlist(email)
values('systemsolar@gmail.com')
on conflict(email) do nothing;
revoke all on private.admin_email_allowlist from public,anon,authenticated;
