# PulseAI judging demo (3–4 minutes)

Use the dashboard's clearly labeled demo records for the walkthrough. Uploading a real record requires valid Gemini and Supabase credentials; never present sample readings as results from an uploaded document.

1. **Unified profile (30 sec):** Show the overview, health score, current vitals, medication schedule, recent activity, and timeline. Point out the mock ABHA identifier.
2. **Record intelligence (60 sec):** Upload a consented, de-identified PDF/JPEG/PNG prescription or lab report. Show the extraction state and resulting timeline entry, including the plain-language summary, medicines, dates, test values, and abnormal-value explanations. If credentials are not configured, explain that extraction is disabled rather than showing fabricated output.
3. **Language support (30 sec):** Switch the UI to Hindi, Telugu, or Tamil. Upload extraction uses the selected language and asks Gemini to preserve original medicine names, values, and units while reading mixed-language or handwritten text conservatively.
4. **ABDM readiness (30 sec):** Download the FHIR JSON bundle. Open the JSON and point to its Patient/ABHA, MedicationRequest, Observation, and DiagnosticReport resources. Clarify that this is a mock ABHA and no live ABDM gateway is connected.
5. **Interactive prototype (45 sec):** Demonstrate medication dose logging, symptom triage and emergency guidance, wearable/scale sync simulation, and the printable pre-visit summary.
6. **Close (15 sec):** Explain the pipeline: browser upload → Next.js processing route → Gemini vision/OCR → Supabase Storage/PostgreSQL → unified timeline and FHIR export.

## Setup checklist

- Configure `GEMINI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`.
- Create the `medical_records` Supabase Storage bucket and `health_timeline` table using the setup SQL in `README.md`.
- Start the app with `npm run dev` and open `http://localhost:3000`.
- Use only synthetic or de-identified medical documents during a public demo.
