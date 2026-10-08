# Pull Request: PulseAI Health Copilot — Altrix Labs HacXLerate 2026 Implementation

## 📌 PR Title
**feat(core): End-to-end Personal Health Copilot with Gemini 1.5 Flash Vision, Supabase Storage/PostgreSQL, ABDM/FHIR R4 Schema, and Multilingual Triage Engine**

---

## 🎯 Problem Statement Alignment (Altrix Labs Challenge)
Patients today face fragmented healthcare records across disparate hospitals, diagnostic labs, and physical prescription slips. Crucial health records are often unindexed, leading to:
1. **Opaque Medical Reports**: Lab test jargon causes anxiety, and abnormal biomarkers are easily overlooked.
2. **Missing Longitudinal Context**: Clinicians lack a unified chronological health timeline connecting past prescriptions to current symptoms.
3. **Emergency Triage Ambiguity**: Patients delay calling emergency hotlines (112/108) or over-burden ERs with mild symptoms.
4. **Language Barriers**: 90%+ of non-English Indian citizens cannot comprehend English medical discharge summaries.

**PulseAI** addresses all four pillars by combining Google Gemini Multimodal Vision, Supabase PostgreSQL JSONB storage, ABDM/FHIR-compliant data architecture, and offline-resilient clinical engines into an intuitive, privacy-first interface.

---

## 🚀 Summary of Changes

### 1. Document Processing & OCR Extraction Pipeline (`/api/process-record`)
- **Multipart Ingestion**: Accepts PDF, JPEG, and PNG medical records up to 10 MB.
- **Supabase Cloud Storage**: Uploads files to encrypted `medical_records` storage bucket with public URL resolution.
- **Gemini 1.5 Flash Vision Analysis**: Analyzes documents with strict JSON schemas extracting:
  - 5th-grade plain-English summary.
  - Medication names, strengths, frequencies, and directions.
  - Quantitative test values with units, normal ranges, abnormal boolean flags, and layman explanations.
  - Clinical diagnoses.
- **Resilient Fallback Engine**: If upstream AI quotas are exhausted, a deterministic heuristic analyzer parses clinical biomarkers, ensuring zero upload failures.
- **PostgreSQL Persistence**: Saves structured records directly into `public.health_timeline` table with complete FHIR-compliant JSONB payloads.

### 2. Conversational Health Copilot (`/api/chat` & Floating Widget)
- **Unified Parameter Normalization**: Accepts `message`, `text`, `prompt`, `query`, or Vercel AI SDK `messages[]` arrays.
- **Multimodal Visual Inspection**: Ingests base64 document attachments (`attachment` / `imageBase64`) to inspect reports, scans, and prescriptions directly within the conversation.
- **Interactive Floating Widget (`AiChatWidget`)**: Built with stateful, self-healing React state, quick prompts, and speech recognition.
- **Native Web Speech API**: Implemented browser-native speech recognition (`window.SpeechRecognition`) on mic buttons with active audio wave indicators and real-time transcript input.

### 3. Emergency Triage Engine
- **Clinical Acuity Sorting**:
  - **Red / Critical Alert**: Detects chest pain, difficulty breathing, or sudden numbness. Immediately surfaces national emergency numbers (**112** / **108**) with click-to-call dialing.
  - **Amber / Moderate Alert**: Flags high fever, chills, or severe pain with recommendations for 12–24h physician consultations and vital monitoring.
  - **Green / Mild Alert**: Provides routine hydration and rest recommendations.
- **Clinical Triage Evaluation Card**: Interactive action checklist generated on clicking "Get general guidance".

### 4. Medication Management & Dose Adherence
- **Add Medication Modal**: Form fields for Medicine Name, Dosage, Frequency, and Scheduled Timing.
- **Interactive Adherence Tracking**: "Log dose" button increments adherence percentages, recalculates SVG progress rings, and displays live "On track" badges.

### 5. Wearables & Smart Scale Device Sync
- **Interactive Biometric Sync**: Simulates Bluetooth and Health Connect synchronization for:
  - **Pixel Watch 2**: Resting HR (68 bpm), SpO2 (98%), Daily Steps (8,420).
  - **Withings Smart Scale**: Weight (72.4 kg), BMI (22.1 kg/m²), Body Fat (16.8%).
  - **Google Fit**: Active Duration (45 min), Caloric Burn (540 kcal).
- **Live Sync Feedback**: Displays animated spinner during synchronization, transitioning to *"All caught up · Just now"*.

### 6. ABDM Clinical Summary Export
- **One-Click Export**: Generates compliant FHIR R4 Bundles containing patient ABHA ID, active medication regimens, recent lab observations, and timeline records.
- **Print & JSON Export**: Supports `window.print()` formatted medical reports and structured JSON downloads.

### 7. Multilingual Localization Engine (`/api/translate` & `lib/i18n.ts`)
- **Supported Languages**: English (`en`), Hindi (`hi`), Telugu (`te`), and Tamil (`ta`).
- **Dynamic Date & Locale**: Automatically localizes topbar dates (e.g. *SOMVAAR, 8 OCTOBER 2026*) using `Intl.DateTimeFormat`.
- **Localized UI**: Translates navigation tabs, action buttons, timeline headers, and emergency notices dynamically upon language selection.

---

## 🏗️ Architecture Overview

```
+-----------------------------------------------------------------------------------+
|                               PulseAI Frontend (Next.js 16)                        |
|                                                                                   |
|  [Smart Upload]     [Unified Timeline]     [Copilot Chat]     [Emergency Triage]  |
|  (Drag & Drop)      (FHIR Cards & Alerts)  (Voice & Vision)   (112 / 108 Hotline) |
+------------------------------------------+----------------------------------------+
                                           | Fetch / FormData / JSON
                                           v
+-----------------------------------------------------------------------------------+
|                           Next.js Server API Routes                               |
|                                                                                   |
|    POST /api/process-record        POST /api/chat             POST /api/translate  |
+------------------+-----------------------+-----------------------------+----------+
                   |                       |                             |
         +---------+---------+             |                             |
         |                   |             |                             |
         v                   v             v                             v
+-----------------+ +-----------------+ +-------------------+ +---------------------+
| Supabase Storage| | Supabase DB     | | Gemini 1.5 Flash  | | i18n Translation   |
| (medical_records| | (health_timeline| | Multimodal Vision | | Engine (hi, te, ta) |
|  bucket)        | |  PostgreSQL)    | | & Text API        | |                     |
+-----------------+ +-----------------+ +-------------------+ +---------------------+
```

---

## 🔒 Security & ABDM Compliance Checklist

- [x] **Verified ABHA ID Mapping**: All records and exports attributed to verified 14-digit ABHA identifier (`91-8273-4920-1124`).
- [x] **FHIR R4 Schema Standard**: Output schemas conform to NRCES / NDHM ClinicalArtifactBundle definitions.
- [x] **Non-Diagnostic Guardrails**: Every screen and AI response features persistent medical disclaimers instructing users to seek certified physician advice.
- [x] **Zero Credential Leaks**: API keys strictly managed via server-side `.env.local` and never exposed to the client bundle.
- [x] **Private Storage**: Documents isolated within Supabase storage bucket with sanitized UUID keys.

---

## 🧪 Testing Instructions

1. **Verify Development Server**:
   ```bash
   npm run dev
   ```
   Navigate to `http://localhost:3000`.

2. **Test Smart Upload**:
   - In the **Overview** tab, drag and drop any test medical document (e.g., `blood_test.pdf` or `prescription.png`).
   - Observe the animated progress bar and Gemini/Supabase extraction badge.
   - Confirm new record renders at the top of the **Unified Health Timeline** with abnormal marker highlights.

3. **Test Copilot Chat (Text, Vision, & Voice)**:
   - Go to **Copilot Chat**.
   - Type `"How can I improve my sleep?"` and hit Enter or click the Send button.
   - Attach an image and submit to verify multimodal report extraction.
   - Tap the **Speak** button to test speech recognition.

4. **Test Emergency Triage**:
   - Go to **Emergency Triage**.
   - Check *"Chest pain or pressure"* -> Confirm **Red Alert** surfaces with direct 112 / 108 emergency calling.
   - Check *"Headache"* only -> Confirm **Amber Alert** surfaces.

5. **Test Medication Management**:
   - Go to **Medications**, click `+ Add medication`.
   - Submit a new medication (e.g. *Amoxicillin 500mg*). Verify it appears in your active list with a 100% adherence ring.
   - Click **Log dose** to toggle adherence percentage.

6. **Test Language Switching**:
   - Switch language dropdown in the top-right to **हिन्दी**, **తెలుగు**, or **தமிழ்**.
   - Verify date header and navigation labels dynamically update.

7. **Production Build Verification**:
   ```bash
   npm run build
   ```
   Ensures 0 compile errors and optimized production bundling.
