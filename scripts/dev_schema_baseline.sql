-- Baseline: list applied migration versions in the current environment.
select version
from supabase_migrations.schema_migrations
order by version;
