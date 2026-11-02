-- Keep full-text search, stop storing it twice.
--
-- `internships.fts` was a STORED generated tsvector. It took ~196 MB on disk,
-- more than the descriptions it is built from, and its GIN index another
-- ~96 MB. Together they pushed the database past the Free Plan's 500 MB
-- quota, Supabase switched it to read-only, and every Auth token refresh then
-- failed, which hung the middleware and took the site down.
--
-- The column is replaced by a function with the same expression and an
-- expression index on it. Because Postgres resolves `i.fts` to `fts(i)` when
-- no column of that name exists, every existing query (`i.fts @@ ...`) keeps
-- working unchanged and still uses the index. Only the index is stored now.
--
-- After applying, reclaim the freed space with: VACUUM FULL internships;

CREATE OR REPLACE FUNCTION public.fts(public.internships)
RETURNS tsvector
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT
    pg_catalog.setweight(pg_catalog.to_tsvector('english'::regconfig, coalesce($1.title, '')), 'A') ||
    pg_catalog.setweight(pg_catalog.to_tsvector('english'::regconfig, coalesce($1.company, '')), 'B') ||
    pg_catalog.setweight(pg_catalog.to_tsvector('english'::regconfig, coalesce($1.skills_json, '') || ' ' || coalesce($1.field, '')), 'B') ||
    pg_catalog.setweight(pg_catalog.to_tsvector('english'::regconfig, coalesce($1.locations_json, '')), 'C') ||
    pg_catalog.setweight(pg_catalog.to_tsvector('english'::regconfig, left(coalesce($1.description, ''), 100000)), 'D')
$$;

DROP INDEX IF EXISTS idx_int_fts;
ALTER TABLE internships DROP COLUMN IF EXISTS fts;
CREATE INDEX IF NOT EXISTS idx_int_fts ON internships USING GIN (public.fts(internships));
