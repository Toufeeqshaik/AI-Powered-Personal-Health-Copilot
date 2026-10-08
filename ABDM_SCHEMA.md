# 📜 ABDM & FHIR R4 Schema Specification — PulseAI

This document provides the formal data dictionary and mapping specifications for **PulseAI**, compliant with the **Ayushman Bharat Digital Mission (ABDM)** and **HL7 FHIR R4 (NRCES India)** standards.

---

## 1. Core Profile Architecture Overview

PulseAI packages patient clinical events as an ABDM `Bundle` containing:
1. `Patient` Resource (linked with 14-digit ABHA ID)
2. `DiagnosticReport` / `Observation` Resources (lab reports, blood pressure, vitals)
3. `MedicationRequest` / `MedicationStatement` Resources (active prescriptions and adherence)
4. `Condition` Resource (identified diagnoses and clinical impressions)

```
Bundle (type: "document", profile: "https://nrces.in/ndhm/fhir/r4/StructureDefinition/ClinicalArtifactBundle")
  ├── Entry 1: Composition (Clinical Summary Document)
  ├── Entry 2: Patient (ABHA: 91-8273-4920-1124)
  ├── Entry 3: DiagnosticReport (Laboratory or Radiology)
  │     └── Result References -> Observation (Hemoglobin, Glucose, Vitamin D)
  ├── Entry 4: MedicationStatement (Metformin, Atorvastatin)
  └── Entry 5: Condition (Essential Hypertension, Impaired Fasting Glucose)
```

---

## 2. FHIR Resource Mappings

### 2.1. `Patient` Resource (with Verified ABHA ID)
Conforms to: `https://nrces.in/ndhm/fhir/r4/StructureDefinition/Patient`

```json
{
  "resourceType": "Patient",
  "id": "pulseai-pat-91827349201124",
  "meta": {
    "versionId": "1",
    "lastUpdated": "2026-10-08T10:00:00Z",
    "profile": [
      "https://nrces.in/ndhm/fhir/r4/StructureDefinition/Patient"
    ]
  },
  "identifier": [
    {
      "type": {
        "coding": [
          {
            "system": "http://terminology.hl7.org/CodeSystem/v2-0203",
            "code": "MR",
            "display": "Medical Record Number"
          }
        ]
      },
      "system": "https://healthid.ndhm.gov.in",
      "value": "91-8273-4920-1124"
    }
  ],
  "name": [
    {
      "text": "Alex Morgan",
      "family": "Morgan",
      "given": ["Alex"]
    }
  ],
  "telecom": [
    {
      "system": "phone",
      "value": "+91-9876543210",
      "use": "mobile"
    },
    {
      "system": "email",
      "value": "alex.morgan@email.com",
      "use": "home"
    }
  ],
  "gender": "female",
  "birthDate": "1992-05-14"
}
```

---

### 2.2. `DiagnosticReport` & `Observation` Resources
Conforms to: `https://nrces.in/ndhm/fhir/r4/StructureDefinition/DiagnosticReportLab` and `https://nrces.in/ndhm/fhir/r4/StructureDefinition/Observation`

#### `DiagnosticReport`
```json
{
  "resourceType": "DiagnosticReport",
  "id": "pulseai-rep-7721",
  "meta": {
    "profile": [
      "https://nrces.in/ndhm/fhir/r4/StructureDefinition/DiagnosticReportLab"
    ]
  },
  "status": "final",
  "category": [
    {
      "coding": [
        {
          "system": "http://terminology.hl7.org/CodeSystem/v2-0074",
          "code": "LAB",
          "display": "Laboratory"
        }
      ]
    }
  ],
  "code": {
    "coding": [
      {
        "system": "http://loinc.org",
        "code": "24323-8",
        "display": "Comprehensive metabolic 2000 panel - Serum or Plasma"
      }
    ],
    "text": "Complete Metabolic Panel"
  },
  "subject": {
    "reference": "Patient/pulseai-pat-91827349201124",
    "display": "Alex Morgan"
  },
  "effectiveDateTime": "2025-04-12T08:30:00Z",
  "issued": "2025-04-12T14:00:00Z",
  "result": [
    {
      "reference": "Observation/pulseai-obs-glucose",
      "display": "Fasting Blood Glucose"
    },
    {
      "reference": "Observation/pulseai-obs-hemoglobin",
      "display": "Hemoglobin"
    }
  ],
  "conclusion": "Your kidney markers and electrolytes look healthy. Fasting glucose is slightly elevated at 108 mg/dL (prediabetic threshold)."
}
```

#### `Observation` (Quantitative Biomarker with Abnormal Flag)
```json
{
  "resourceType": "Observation",
  "id": "pulseai-obs-glucose",
  "meta": {
    "profile": [
      "https://nrces.in/ndhm/fhir/r4/StructureDefinition/Observation"
    ]
  },
  "status": "final",
  "code": {
    "coding": [
      {
        "system": "http://loinc.org",
        "code": "1558-6",
        "display": "Fasting glucose [Mass/volume] in Serum or Plasma"
      }
    ],
    "text": "Fasting Blood Glucose"
  },
  "subject": {
    "reference": "Patient/pulseai-pat-91827349201124"
  },
  "valueQuantity": {
    "value": 108,
    "unit": "mg/dL",
    "system": "http://unitsofmeasure.org",
    "code": "mg/dL"
  },
  "interpretation": [
    {
      "coding": [
        {
          "system": "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation",
          "code": "H",
          "display": "High"
        }
      ],
      "text": "Elevated (Impaired Fasting Glucose / Prediabetes)"
    }
  ],
  "referenceRange": [
    {
      "low": {
        "value": 70,
        "unit": "mg/dL"
      },
      "high": {
        "value": 99,
        "unit": "mg/dL"
      },
      "type": {
        "text": "Normal Fasting Adult"
      }
    }
  ]
}
```

---

### 2.3. `MedicationRequest` & `MedicationStatement` Resources
Conforms to: `https://nrces.in/ndhm/fhir/r4/StructureDefinition/MedicationRequest`

```json
{
  "resourceType": "MedicationRequest",
  "id": "pulseai-med-metformin",
  "meta": {
    "profile": [
      "https://nrces.in/ndhm/fhir/r4/StructureDefinition/MedicationRequest"
    ]
  },
  "status": "active",
  "intent": "order",
  "medicationCodeableConcept": {
    "coding": [
      {
        "system": "http://snomed.info/sct",
        "code": "372567009",
        "display": "Metformin hydrochloride (substance)"
      }
    ],
    "text": "Metformin 500 mg"
  },
  "subject": {
    "reference": "Patient/pulseai-pat-91827349201124"
  },
  "authoredOn": "2025-04-05",
  "requester": {
    "display": "Dr. Sarah Khan, MBBS, MD"
  },
  "dosageInstruction": [
    {
      "text": "500 mg orally twice daily with meals",
      "timing": {
        "repeat": {
          "frequency": 2,
          "period": 1,
          "periodUnit": "d"
        }
      },
      "route": {
        "coding": [
          {
            "system": "http://snomed.info/sct",
            "code": "260548002",
            "display": "Oral"
          }
        ]
      },
      "doseAndRate": [
        {
          "doseQuantity": {
            "value": 500,
            "unit": "mg",
            "system": "http://unitsofmeasure.org",
            "code": "mg"
          }
        }
      ]
    }
  ]
}
```

---

## 3. PostgreSQL JSONB Storage Schema (`health_timeline`)

Inside Supabase PostgreSQL, medical extractions are stored directly in `public.health_timeline`:

```sql
CREATE TABLE public.health_timeline (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mock_abha_id        TEXT NOT NULL DEFAULT '91-8273-4920-1124',
  document_url        TEXT NOT NULL,
  document_type       TEXT NOT NULL,
  ai_summary_english  TEXT,
  fhir_data           JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ DEFAULT now()
);
```

### JSONB Structure of `fhir_data`
```json
{
  "title": "Complete Metabolic Panel",
  "plain_english_summary": "Your kidney markers and electrolytes look healthy. Fasting glucose is slightly elevated at 108 mg/dL.",
  "medicines": [
    { "name": "Metformin", "dosage": "500 mg twice daily" },
    { "name": "Atorvastatin", "dosage": "20 mg once daily at bedtime" }
  ],
  "test_values": [
    {
      "name": "Fasting Glucose",
      "value": 108,
      "unit": "mg/dL",
      "abnormal_flag": true,
      "explanation": "Mildly elevated (Prediabetes threshold 100-125 mg/dL)"
    },
    {
      "name": "Serum Creatinine",
      "value": 0.9,
      "unit": "mg/dL",
      "abnormal_flag": false,
      "explanation": "Within normal healthy range"
    }
  ],
  "diagnoses": [
    "Impaired Fasting Glucose",
    "Essential Hypertension (Controlled)"
  ]
}
```
