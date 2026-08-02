-- Corrects 0004: the product name landed on InternIndex, not InternBase.
--
-- 0004 is kept rather than rewritten because it has already been applied to the
-- remote database, and deleting an applied migration desynchronises the local
-- files from `supabase_migrations.schema_migrations`. This rolls it forward.

ALTER TABLE public.applications ALTER COLUMN origin SET DEFAULT 'internindex';

UPDATE public.applications
   SET origin = 'internindex'
 WHERE origin IN ('internbase', 'internfinder');

COMMENT ON COLUMN public.applications.origin IS
  'internindex | manual | referral | career-fair | recruiter | other';
