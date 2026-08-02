-- Bulk catalog ingestion over HTTPS (PostgREST RPC).
--
-- The normal sync path talks to Postgres directly, but some environments only
-- have HTTPS egress. `catalog_ingest` lets a trusted script bootstrap or mirror
-- the catalog through the REST API: it upserts rows into the catalog tables
-- (never user tables) and is guarded by a shared secret stored in app_meta
-- under 'ingest_secret' — set one before use:
--
--   INSERT INTO app_meta (key, value) VALUES ('ingest_secret', '<random>')
--     ON CONFLICT (key) DO UPDATE SET value = excluded.value;
--
-- app_meta has row-level security enabled with no read policy, so the secret
-- is not readable through the API.

CREATE OR REPLACE FUNCTION public.catalog_ingest(p_secret text, p_table text, p_rows jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  cols text;
  selects text;
  updates text;
  conflict_target text;
  n integer;
BEGIN
  IF p_secret IS NULL
     OR p_secret IS DISTINCT FROM (SELECT value FROM app_meta WHERE key = 'ingest_secret') THEN
    RAISE EXCEPTION 'invalid ingest secret';
  END IF;

  IF p_table NOT IN ('internships', 'source_configs', 'sync_runs') THEN
    RAISE EXCEPTION 'table % is not ingestable', p_table;
  END IF;

  conflict_target := CASE p_table
    WHEN 'internships' THEN 'id'
    WHEN 'source_configs' THEN 'kind, token'
    WHEN 'sync_runs' THEN 'id'
  END;

  -- Every real column except generated ones (the fts tsvector maintains itself).
  SELECT
    string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position),
    string_agg('r.' || quote_ident(column_name), ', ' ORDER BY ordinal_position),
    string_agg(
      CASE
        -- Conflict-target and identity columns are never rewritten on update.
        WHEN column_name IN ('id', 'kind', 'token') THEN NULL
        ELSE format('%1$I = EXCLUDED.%1$I', column_name)
      END,
      ', ' ORDER BY ordinal_position
    )
  INTO cols, selects, updates
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = p_table AND is_generated = 'NEVER';

  IF p_table = 'sync_runs' THEN
    EXECUTE format(
      'INSERT INTO %I (%s) SELECT %s FROM jsonb_populate_recordset(NULL::%I, $1) AS r
       ON CONFLICT (%s) DO NOTHING',
      p_table, cols, selects, p_table, conflict_target
    ) USING p_rows;
  ELSE
    EXECUTE format(
      'INSERT INTO %I (%s) SELECT %s FROM jsonb_populate_recordset(NULL::%I, $1) AS r
       ON CONFLICT (%s) DO UPDATE SET %s',
      p_table, cols, selects, p_table, conflict_target, updates
    ) USING p_rows;
  END IF;

  GET DIAGNOSTICS n = ROW_COUNT;

  -- Explicit ids bypass the sequence; realign it so later inserts don't collide.
  IF p_table IN ('source_configs', 'sync_runs') THEN
    EXECUTE format(
      'SELECT setval(pg_get_serial_sequence(%L, ''id''), GREATEST((SELECT COALESCE(MAX(id), 0) FROM %I), 1))',
      p_table, p_table
    );
  END IF;

  RETURN n;
END;
$$;

GRANT EXECUTE ON FUNCTION public.catalog_ingest(text, text, jsonb) TO anon, authenticated;
