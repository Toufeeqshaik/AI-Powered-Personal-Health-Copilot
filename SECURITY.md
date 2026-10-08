# Security and Privacy Guide

## Current audit (2026-10-08)

- No `.env.local`, `.env.local.txt`, or other environment file is tracked by Git.
- A tracked-file and repository-history scan found no live Gemini, Supabase service-role, or private-key material. The only matches are example placeholders in documentation.
- `GEMINI_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are read only by server routes. The browser receives only the Supabase URL and anon key, which is designed to be public and must be constrained with Row Level Security (RLS).
- Vercel environment values are stored as encrypted project secrets. GitHub Actions uses a repository secret; no key is stored in source.
- The supplied Gemini key was pasted into a chat session. Rotate it in Google AI Studio after the deployment is confirmed, then update Vercel and local `.env.local` again.

## Controls now in the repository

- `.env.example` documents safe variable names without real values.
- `.gitignore` blocks `.env*` files while explicitly allowing the placeholder `.env.example`.
- Server-only Supabase administration is isolated in `lib/supabaseServer.js`; client code imports only `lib/supabaseClient.js`.
- Public API routes have best-effort per-instance rate limits and request-size/field-length limits.
- Uploads accept only PDF, JPEG, and PNG files up to 4 MB. Storage errors do not return upstream database messages to the browser.
- Vercel/Next.js sends `nosniff`, `SAMEORIGIN`, strict referrer, permissions, and HTTPS transport headers.
- Gemini and Supabase failures degrade to a conservative offline response instead of exposing credentials or stack traces.
- `pnpm audit --audit-level high` is clean after locking patched transitive versions; the GitHub workflow repeats this check on pushes and pull requests.

## Deployment checklist

1. Configure `GEMINI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel Environment Variables. Keep the first two server-only.
2. Keep `medical_records` private and use time-limited signed URLs.
3. Enable RLS on `health_timeline` and any future user tables. Do not rely on the anon key as authorization.
4. Set a Vercel spend limit/usage alert and a Gemini API quota/budget alert.
5. Review Vercel access, GitHub collaborators, and Supabase project members before a public demo.
6. Remove real patient records after judging; use synthetic/demo data only.

## If a key is exposed

1. Revoke/rotate the key immediately in Google AI Studio, Supabase, or GitHub.
2. Replace it in local `.env.local`, Vercel Production/Preview, and GitHub Actions secrets.
3. Redeploy, then inspect provider usage logs for unexpected requests.
4. Search the repository and Git history for the old key prefix and remove any accidental commit from all branches.
5. Record the incident and affected time window; never paste the replacement key into an issue, pull request, screenshot, or chat.

## Production gaps to address before real patient data

Authentication and authorization, per-user record ownership, consent and revocation, audit logs, encryption/key management, retention/deletion workflows, signed upload URLs, robust distributed rate limiting, dependency scanning, and legal/clinical review are still required for a production healthcare service.
