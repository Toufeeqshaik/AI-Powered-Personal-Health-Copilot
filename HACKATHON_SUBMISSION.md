# PulseAI — HacXLerate 2026 Submission Brief

## One-line pitch

PulseAI turns prescriptions, lab reports, and wearable readings into a simple, multilingual health timeline with explainable AI guidance and ABDM/FHIR-ready export.

## Problem

Important health information is scattered across paper reports, medication routines, and disconnected devices. Patients often receive results without a plain-language explanation and clinicians spend time reconstructing the story.

## Demonstrable solution

- Upload PDF, JPEG, or PNG records and extract medicines, doses, dates, values, and abnormal flags.
- Explain reports at a patient-friendly reading level, with an offline response when Gemini or the network is unavailable.
- Keep records, vitals, medications, and synced-device events in one Unified Health Timeline.
- Switch the interface between English, Hindi, Telugu, and Tamil.
- Simulate a Withings scale and Pixel Watch flow for a reliable live demo.
- Export an ABDM-aligned FHIR Bundle containing Patient, MedicationRequest, DiagnosticReport, and Observation resources.
- Triage urgent symptoms with a clear Red Alert (112/108) or Amber outpatient-care recommendation.

## Scope mapping

| Challenge requirement | PulseAI implementation |
| --- | --- |
| Medical record intelligence and OCR | Gemini multimodal extraction route with conservative manual-review fallback |
| Plain-language AI summary | Gemini prompt plus deterministic offline health guidance |
| Unified health profile | Overview cards, medication adherence, devices, and timeline |
| Regional languages | Full UI dictionary and translation fallback for Hindi, Telugu, and Tamil |
| ABDM/ABHA readiness | Mock ABHA identifier, FHIR export, schema in [`ABDM_SCHEMA.md`](./ABDM_SCHEMA.md) |

## Suggested 3-minute demo

1. Open Overview and show the animated 84 health score, current vitals, medication adherence, and recent activity.
2. Open Device Sync, connect the demo scale, and show the new weight/BMI reading in Current Vitals and the timeline.
3. Upload a sample report and show the extracted plain-English summary plus abnormal-value banner.
4. Change the language to Hindi, Telugu, or Tamil and show the full-page translation.
5. Ask “What is paracetamol used for?” to demonstrate Gemini or the offline fallback.
6. Open Emergency Triage, select chest pain, and show the Red Alert and 112/108 guidance.
7. Download the FHIR Bundle and mention the ABHA ID is a clearly marked demo identifier.

## Responsible-use boundary

PulseAI is a hackathon prototype for education and record organization. It is not a diagnostic device, does not replace a clinician, and must not be used for an emergency decision without contacting local emergency services. Production deployment requires authenticated users, verified consent, RLS tests, audit logging, clinical review, and a formal privacy/compliance assessment.

## Technical references

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — data flow and service boundaries
- [`SECURITY.md`](./SECURITY.md) — secret handling and deployment controls
- [`DEPLOYMENT_RUNBOOK.md`](./DEPLOYMENT_RUNBOOK.md) — local, GitHub, and Vercel setup
- [`COST_ESTIMATE_INR.md`](./COST_ESTIMATE_INR.md) — transparent monthly scenarios
- [`DEMO_SCRIPT.md`](./DEMO_SCRIPT.md) — detailed presenter script
