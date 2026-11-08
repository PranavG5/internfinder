# Working on InternIndex

## Deploying

Deploy every change to production right away. Don't leave work sitting on a
feature branch.

- Vercel deploys production from `main`. Once a change is committed and checks
  pass (`npm run typecheck`, `npm test`), push it to `main`, then confirm the
  production deployment reaches READY.
- A change that adds a file under `supabase/migrations/` is not live until the
  migration is applied to the production Supabase project too. Apply it in the
  same go.
