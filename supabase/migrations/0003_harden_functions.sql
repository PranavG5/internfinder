-- handle_new_user is only ever invoked by the auth trigger; it must not be
-- callable through the REST API.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- catalog_ingest stays callable by anon on purpose (HTTPS bootstrap path) and
-- is guarded by the shared secret in app_meta; signed-in users gain nothing
-- extra from it, so drop their grant to keep the surface minimal.
REVOKE EXECUTE ON FUNCTION public.catalog_ingest(text, text, jsonb) FROM PUBLIC, authenticated;
