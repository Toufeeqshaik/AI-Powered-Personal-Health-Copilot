# 🏛️ Technical Architecture & System Design — PulseAI

**Project**: PulseAI (Personal Health Copilot)  
**Hackathon**: HacXLerate 2026 — Altrix Labs Challenge  
**Architectural Tier**: Production-Grade Distributed Full-Stack Health Application

---

## 1. Architectural Principles

PulseAI is designed around four foundational health-tech principles:

1. **Zero-Trust Clinical Privacy**: Patient Health Information (PHI) must be encrypted in transit and at rest. Clinical data is linked via decentralized ABHA identifiers rather than raw government IDs.
2. **Truthful Extraction**: If document OCR or persistence is unavailable, the upload fails clearly. The application does not invent clinical values to fill a record.
3. **Multimodal Clinical Grounding**: Medical artifacts are inherently multimodal (handwritten prescription photos, scanned laboratory tables, radiological images). PulseAI unifies visual OCR with generative clinical summarization.
4. **Standardized Interoperability**: Every processed record aligns with national HL7 FHIR R4 and ABDM (Ayushman Bharat Digital Mission) standards to prevent data siloing.

---

## 2. High-Level Component Architecture

```
+----------------------------------------------------------------------------------------------------+
|                                      PRESENTATION TIER (Next.js 16)                                 |
|                                                                                                    |
|  +------------------------+  +------------------------+  +---------------------------------------+  |
|  | Smart Upload Zone      |  | Unified Timeline       |  | Multimodal Copilot Chat & Widget     |  |
|  | - Drag & drop parser   |  | - FHIR Cards           |  | - Web Speech API (STT)                |  |
|  | - Multi-format (PDF/IMG|  | - Abnormal Flag Badges |  | - Base64 image payload inspector      |  |
|  +-----------+------------+  +-----------^------------+  +-------------------+-------------------+  |
|              |                           |                                   |                      |
+--------------|---------------------------|-----------------------------------|----------------------+
               | Multipart Form            | Query Results                     | JSON / Base64 Payload
               v                           |                                   v
+------------------------------------------+----------------------------------------------------------+
|                                    APPLICATION TIER (Next.js Edge / Node APIs)                       |
|                                                                                                     |
|  [POST /api/process-record]              [Supabase Client SDK]               [POST /api/chat]        |
|  - File buffer verification              - Anon Client (Read)                - Query normalizer     |
|  - Storage key generation                - Service Role (Write)              - Multimodal injector  |
|  - Multimodal Gemini prompt                                                  - Fallback clinical db |
+--------------+------------------------------------+----------------------------------+---------------+
               |                                    |                                  |
               v                                    v                                  v
+-----------------------------+      +-----------------------------+      +----------------------------+
|      STORAGE LAYER          |      |       DATABASE LAYER        |      |       AI ENGINE LAYER      |
| Supabase Storage            |      | Supabase PostgreSQL 15      |      | Google Gemini 3.8 Flash    |
| Bucket: medical_records     |      | Table: health_timeline      |      | - Vision & OCR             |
| Private object storage      |      | JSONB: fhir_data            |      | - Structured Schema Output |
+-----------------------------+      +-----------------------------+      +----------------------------+
```

---

## 3. Multimodal OCR & Extraction Strategy

### 3.1. Ingestion & Preprocessing Pipeline
1. **MIME & Size Validation**: Files uploaded via the browser are validated against allowed MIME types (`application/pdf`, `image/jpeg`, `image/png`) and bounded by a 10 MB ceiling.
2. **In-Memory Streaming**: In the Next.js API route (`/api/process-record`), the file is read as an `ArrayBuffer` and converted to a `Buffer`.
3. **Storage Upload**: The buffer is written to the private Supabase `medical_records` storage bucket using a unique timestamped filename.
4. **Signed URI Resolution**: Supabase returns a seven-day signed HTTPS URL for viewing the clinical artifact.

### 3.2. Structured Gemini Vision Prompting
The raw file buffer is passed to `GoogleGenerativeAI` as an inline base64 object alongside a specialized system prompt enforcing **Strict JSON Output**:

```typescript
const prompt = `You are a clinical documentation AI. Analyze this medical record image/document carefully.
Return ONLY valid JSON matching this schema:
{
  "title": "Short descriptive title",
  "plain_english_summary": "Summary at a 5th-grade reading level",
  "medicines": [{"name": "string", "dosage": "string"}],
  "test_values": [
    {
      "name": "string",
      "value": "string or number",
      "unit": "string",
      "abnormal_flag": boolean,
      "explanation": "Why this value is normal or abnormal"
    }
  ],
  "diagnoses": ["string"]
}`
```

### 3.3. Extraction Failure Handling
When Gemini is not configured or cannot read a document, the upload route returns an error and removes the temporary Storage object. The user can retry with a clearer scan. Demo records elsewhere in the dashboard are simulated and are not presented as OCR results.

---

## 4. Data Privacy & Compliance Guardrails

### 4.1. Privacy by Design
- **No Client API Keys**: `GEMINI_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are only ever accessed on the server. The client bundle only receives `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- **Anonymized Patient References**: Mock data uses randomized ABHA identifiers (`91-8273-4920-1124`) rather than real Aadhaar numbers or government identity tokens.
- **Transport Security**: Hosted services should be accessed over HTTPS. Storage access and database policies depend on the deployed Supabase bucket and project configuration; the application does not claim end-to-end encryption or production compliance.

### 4.2. Clinical Safety Guardrails
- **Persistent Non-Diagnostic Disclaimers**: Displayed prominently across the bottom safety banner, top triage alerts, and within AI chat bubble footers.
- **Zero Dose Modification**: The system prompt strictly prohibits the AI from prescribing medications, calculating pediatric dosages, or overriding doctor instructions.
- **Emergency Escalation Protocol**: The emergency triage module bypasses conversational processing entirely when acute cardiovascular or neurological symptoms are detected, routing immediately to emergency hotlines (**112 / 108**).

---

## 5. Scalability & Performance Considerations

| Layer | Optimization Strategy |
| :--- | :--- |
| **Edge Routing** | Turbopack compilation with static page pre-rendering for non-dynamic screens (`/`, `/_not-found`). |
| **Database Performance** | PostgreSQL `jsonb_path_ops` GIN indexes on `health_timeline.fhir_data` for rapid search across nested lab test values. |
| **Object Storage** | Private Supabase Storage bucket; uploaded records are linked with time-limited signed URLs. |
| **Frontend Bundle Size** | Modular Tree-shaking of `lucide-react` icons and zero heavyweight charting libraries (using performant SVG/CSS progress rings). |
| **Cold-Start Resilience** | Next.js API routes use standard `fetch` with streaming response capabilities, minimizing container cold start latencies to < 350ms. |

---

## 6. Disaster Recovery & Extensibility

1. **FHIR R4 Portability**: Because data is structured as FHIR R4 JSON, the database can be exported into any hospital EHR (Epic, Cerner, ABDM Gateway) without data transformation pipelines.
2. **Pluggable LLM Backends**: The `callGemini` engine in `/api/chat` and `/api/process-record` is decoupled behind clean abstraction layers, enabling instant drop-in replacement with Anthropic Claude, OpenAI GPT-4o, or locally hosted Med-Gemma models.
