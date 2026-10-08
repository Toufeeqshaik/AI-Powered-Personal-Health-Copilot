# Deployment Runbook

## Local development

```powershell
pnpm install
Copy-Item .env.example .env.local
# Fill .env.local locally; never commit it.
pnpm dev
```

Open `http://localhost:3000`. The dashboard and chat remain usable without Gemini or Supabase because the app uses demo data and conservative offline responses.

## Required Vercel variables

Set these in **Project Settings → Environment Variables** for Preview and Production:

```text
GEMINI_API_KEY                 # Secret; server-only
GEMINI_MODEL=gemini-3.8-flash
NEXT_PUBLIC_SUPABASE_URL      # Public project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY # Public browser key; enforce RLS
SUPABASE_SERVICE_ROLE_KEY     # Secret; server-only
```

After changing a variable, redeploy the latest Git commit. Do not put secret values in `NEXT_PUBLIC_*` variables.

## Supabase readiness

Run the schema in `ABDM_SCHEMA.md`, create a private `medical_records` bucket, enable RLS on `health_timeline`, and verify the service-role key is used only by the process-record route. Use synthetic records for demos.

## Smoke checks

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/chat `
  -ContentType 'application/json' `
  -Body '{"message":"What is paracetamol used for?"}'

Invoke-RestMethod -Method Post -Uri https://ai-powered-personal-health-copilot-sigma.vercel.app/api/chat `
  -ContentType 'application/json' `
  -Body '{"message":"What is paracetamol used for?"}'
```

A useful reply from either endpoint confirms the Gemini path or offline fallback. Never include an API key in a smoke-test command, URL, screenshot, or issue.

## Rollback

Use Vercel Deployments → the last known-good deployment → **Promote to Production**. For code changes, revert the Git commit and push; Vercel will build the revert automatically.
