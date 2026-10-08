# 🩺 PulseAI — Personal Health Copilot
### HacXLerate 2026 — Altrix Labs HealthTech Challenge

[![Next.js 16](https://img.shields.io/badge/Next.js-16.4.0-black?logo=next.js)](https://nextjs.org/)
[![Turbopack](https://img.shields.io/badge/Bundler-Turbopack-blueviolet)](https://turbo.build/)
[![Google Gemini](https://img.shields.io/badge/AI-Gemini%203.8%20Flash-4285F4?logo=google)](https://ai.google.dev/)
[![Supabase](https://img.shields.io/badge/Database-Supabase%20PostgreSQL-3ECF8E?logo=supabase)](https://supabase.com/)
[![ABDM FHIR R4](https://img.shields.io/badge/Standard-ABDM%20FHIR%20R4-orange)](https://abdm.gov.in/)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript-blue?logo=typescript)](https://www.typescriptlang.org/)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FToufeeqshaik%2FAI-Powered-Personal-Health-Copilot)

---

## 🌟 Vision & Overview
**PulseAI** is an AI-powered Personal Health Copilot engineered to bridge the communication gap between complex medical documentation and patient understanding. Built for the Ayushman Bharat Digital Mission (ABDM) ecosystem, PulseAI ingests diagnostic lab tests, clinical discharge summaries, and handwritten prescriptions, converting them into structured, FHIR R4-compliant longitudinal health records.

With continuous wearable synchronization, intelligent multimodal visual report inspection, clinical acuity triage (112/108 escalation), and real-time multilingual localization, PulseAI empowers patients to own their health journey with confidence and clinical safety.

---

## 🏆 HacXLerate 2026 Scope Coverage

| Criteria | Implementation Highlights | Status |
| :--- | :--- | :---: |
| **Medical record upload and extraction** | PDF/JPEG/PNG upload, Gemini vision extraction for summary, medicines, test values, diagnoses and dates; prompts support scans and mixed-language/handwritten text. Requires Gemini and Supabase configuration. | Implemented; credentials required |
| **Plain-language summaries** | AI-generated patient-friendly explanation with abnormal-value flags and explanations. | Implemented; Gemini required |
| **Unified profile and timeline** | Supabase `health_timeline` records are rendered alongside demo records and ABHA-linked information. | Implemented; Supabase required for persistence |
| **Regional language support** | English, Hindi, Telugu and Tamil UI; extraction asks Gemini for the selected language. | Implemented; Gemini required for translated extraction |
| **ABDM/FHIR export** | Client-side JSON Bundle includes Patient/ABHA, MedicationRequest, Observation and DiagnosticReport resources. | Implemented |
| **Interactive demo modules** | Emergency triage, medication adherence, wearable/scale simulation, chat and printable summary. | Implemented as prototype simulations |

---

## 🏛️ System Architecture

```
                                  +------------------------------------+
                                  |         PATIENT / CLIENT           |
                                  |   Web Browser / Mobile PWA View    |
                                  +-----------------+------------------+
                                                    |
                         +--------------------------+--------------------------+
                         |                          |                          |
                         v                          v                          v
                [Drag & Drop Upload]        [Copilot Chat Dock]       [Emergency Triage & Sync]
                         |                          |                          |
                         +--------------------------+--------------------------+
                                                    | HTTPS Requests
                                                    v
+-----------------------------------------------------------------------------------------------+
|                                  NEXT.JS 16 API BACKEND ROUTER                                |
|                                                                                               |
|  POST /api/process-record            POST /api/chat                    POST /api/translate     |
|  - Multipart form parser             - Query & message normalizer      - Clinical dictionary  |
|  - Storage key generator             - Multimodal attachment parser    - Gemini translation   |
|  - Validated OCR extraction          - Truthful failure responses                            |
+-------------------+-------------------------------+-----------------------------+-------------+
                    |                               |                             |
          +---------+---------+                     |                             |
          |                   |                     |                             |
          v                   v                     v                             v
+------------------+ +------------------+ +--------------------+       +-----------------------+
| Supabase Storage | | PostgreSQL DB    | | Google Gemini      |       | Client Localization   |
| medical_records  | | health_timeline  | | Gemini 3.8 Flash    |       | Engine (lib/i18n.ts)  |
| (Private Bucket)| | (JSONB Records)  | | (Multimodal OCR)   |       | en, hi, te, ta        |
+------------------+ +------------------+ +--------------------+       +-----------------------+
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for the architecture diagram and [DEMO_SCRIPT.md](DEMO_SCRIPT.md) for a short judging walkthrough. This is a challenge prototype: device readings are simulated, ABHA is a mock identifier, and the app is not connected to an ABDM gateway or a clinical system.

---

## 📡 API Specification Table

### 1. `POST /api/process-record`
Processes medical documents via multimodal vision and saves records to Supabase.

- **Content-Type**: `multipart/form-data`
- **Request Body**:
  - `file`: `File` (Binary PDF, JPEG, PNG, max 4 MB)
  - `mockAbhaId`: `string` (Optional, defaults to `'91-8273-4920-1124'`)
- **Response** (`200 OK`):
  ```json
  {
    "success": true,
    "record": {
      "id": "c8a419f1-332e-4cb8-89c5-19e04812a510",
      "mock_abha_id": "91-8273-4920-1124",
      "document_url": "Time-limited signed link to a private Storage object",
      "document_type": "Laboratory Blood Test Report",
      "ai_summary_english": "Your blood count and kidney markers are healthy. Fasting glucose is slightly elevated at 108 mg/dL.",
      "fhir_data": {
        "title": "Complete Metabolic Panel",
        "plain_english_summary": "...",
        "medicines": [{ "name": "Metformin", "dosage": "500 mg" }],
        "test_values": [
          { "name": "Fasting Glucose", "value": "108", "unit": "mg/dL", "abnormal_flag": true, "explanation": "Mildly elevated" }
        ],
        "diagnoses": ["Impaired Fasting Glucose"]
      },
      "created_at": "2026-10-08T10:15:30.000Z"
    }
  }
  ```

---

### 2. `POST /api/chat`
Conversational health assistant supporting text queries, message history, and base64 medical image inspections.

- **Content-Type**: `application/json`
- **Request Body**:
  ```json
  {
    "message": "Explain what an elevated fasting glucose of 108 mg/dL means.",
    "attachment": "data:image/jpeg;base64,...",
    "fileName": "blood_report.pdf",
    "history": [
      { "role": "user", "text": "Hi PulseAI" },
      { "role": "assistant", "text": "Hello! How can I help you navigate your health today?" }
    ]
  }
  ```
- **Response** (`200 OK`):
  ```json
  {
    "reply": "Fasting glucose of 108 mg/dL falls into the impaired fasting glucose (prediabetes) range (100–125 mg/dL)...",
    "text": "...",
    "role": "assistant"
  }
  ```

---

### 3. `POST /api/translate`
Clinical translation endpoint for localized discharge summaries and instructions.

- **Content-Type**: `application/json`
- **Request Body**:
  ```json
  {
    "text": "Blood pressure is normal. Follow up in 4 weeks.",
    "targetLanguage": "hi"
  }
  ```
- **Response** (`200 OK`):
  ```json
  {
    "originalText": "Blood pressure is normal. Follow up in 4 weeks.",
    "translatedText": "रक्तचाप सामान्य है। 4 सप्ताह में डॉक्टर से पुनः मिलें।",
    "targetLanguage": "hi"
  }
  ```

---

## 🛠️ Step-by-Step Local Reproduction Steps

### Prerequisites
- Node.js `v20.9+`
- npm `v9+` or `pnpm`
- Git

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/Toufeeqshaik/AI-Powered-Personal-Health-Copilot.git
cd AI-Powered-Personal-Health-Copilot
npm install
```

### 2. Configure Environment Variables
Create `.env.local` in the root directory:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
GEMINI_API_KEY=your-gemini-api-key
```

### 3. Setup Supabase Database & Storage
In your Supabase SQL Editor, execute:
```sql
-- 1. Create Health Timeline Table
CREATE TABLE IF NOT EXISTS public.health_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mock_abha_id TEXT NOT NULL DEFAULT '91-8273-4920-1124',
  document_url TEXT NOT NULL,
  document_type TEXT NOT NULL,
  ai_summary_english TEXT,
  fhir_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create Storage Bucket for medical records
INSERT INTO storage.buckets (id, name, public)
VALUES ('medical_records', 'medical_records', false)
ON CONFLICT (id) DO UPDATE SET public = false;
```

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Verify Production Build
```bash
npm run build
npm run start
```

### 6. Deploy on Vercel

Import the GitHub repository in Vercel, keep the project root at `.`, select the Next.js preset, and use `npm run build`. Choose Node.js 20.9 or newer. The dashboard demo and offline chat responses run without external credentials. Add these values in the Vercel project's **Environment Variables** to enable AI extraction, online chat, translations, and persistent medical records:

Upload limits are 4 MB for record extraction and 3 MB for chat attachments. This keeps requests below Vercel Functions' 4.5 MB request/response payload ceiling; larger uploads need a direct-to-storage upload flow.

```env
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-3.8-flash
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Keep `SUPABASE_SERVICE_ROLE_KEY` and `GEMINI_API_KEY` server-side; do not rename them with a `NEXT_PUBLIC_` prefix. Configure the private `medical_records` bucket and `health_timeline` table before using uploads. Without Supabase, the page remains usable with demo data, but uploaded documents cannot be persisted. Without Gemini, uploads are saved for manual review and chat uses a conservative offline response.

---

## 🛡️ Medical Safety & Ethics Disclaimer
PulseAI provides general health education and pre-visit organizational tools. **PulseAI does not provide medical diagnoses, alter prescriptions, or replace certified clinical judgment.** In case of emergencies, users are instructed to dial national emergency services (**112 / 108**) immediately.

