grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on public.users to anon;

alter default privileges in schema public
grant select, insert, update, delete on tables to authenticated;

grant execute on all functions in schema public to authenticated;

alter default privileges in schema public
grant execute on functions to authenticated;
