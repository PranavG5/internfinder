-- Rebrand: InternFinder -> InternBase.
--
-- `applications.origin` records where a tracked application came from, and the
-- in-app value carried the old product name. Only that one literal changes;
-- 'manual', 'referral', 'career-fair', 'recruiter' and 'other' are unaffected.

ALTER TABLE public.applications ALTER COLUMN origin SET DEFAULT 'internbase';

UPDATE public.applications SET origin = 'internbase' WHERE origin = 'internfinder';

COMMENT ON COLUMN public.applications.origin IS
  'internbase | manual | referral | career-fair | recruiter | other';
