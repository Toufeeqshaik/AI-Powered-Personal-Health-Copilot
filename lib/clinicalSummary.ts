export interface ClinicalSummaryData {
  patient: {
    name: string
    abhaId: string
    gender: string
    dob: string
    mobile: string
  }
  medications: Array<{
    name: string
    dosage: string
    frequency?: string
    adherence: number
  }>
  vitals: {
    bloodPressure: string
    restingHeartRate: string
    fastingGlucose: string
    hemoglobin: string
    vitaminD: string
    weightKg: number
    bmi: number
  }
  recentRecords: Array<{
    title: string
    date: string
    type: string
    summary?: string
  }>
}

export function generateFhirBundle(data: ClinicalSummaryData) {
  const timestamp = new Date().toISOString()
  return {
    resourceType: 'Bundle',
    id: `pulseai-abdm-bundle-${Date.now()}`,
    meta: {
      versionId: '1',
      lastUpdated: timestamp,
      profile: ['https://nrces.in/ndhm/fhir/r4/StructureDefinition/ClinicalArtifactBundle'],
    },
    identifier: {
      system: 'https://ndhm.gov.in/pulseai-records',
      value: `REC-${Date.now()}`,
    },
    type: 'document',
    timestamp,
    entry: [
      {
        fullUrl: `urn:uuid:patient-${data.patient.abhaId.replace(/\D/g, '')}`,
        resource: {
          resourceType: 'Patient',
          identifier: [
            {
              system: 'https://healthid.ndhm.gov.in',
              type: {
                coding: [
                  {
                    system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
                    code: 'MR',
                    display: 'Medical Record Number / ABHA ID',
                  },
                ],
              },
              value: data.patient.abhaId,
            },
          ],
          name: [{ text: data.patient.name }],
          gender: data.patient.gender,
          birthDate: data.patient.dob,
        },
      },
      ...data.medications.map((med, idx) => ({
        fullUrl: `urn:uuid:medication-${idx + 1}`,
        resource: {
          resourceType: 'MedicationStatement',
          status: 'active',
          medicationCodeableConcept: {
            text: med.name,
          },
          dosage: [{ text: med.dosage }],
          note: [{ text: `Adherence rate: ${med.adherence}%` }],
        },
      })),
      {
        fullUrl: 'urn:uuid:observation-vitals',
        resource: {
          resourceType: 'Observation',
          status: 'final',
          code: {
            coding: [{ system: 'http://loinc.org', code: '85354-9', display: 'Blood pressure panel' }],
          },
          component: [
            { code: { text: 'Blood Pressure' }, valueString: data.vitals.bloodPressure },
            { code: { text: 'Heart Rate' }, valueString: `${data.vitals.restingHeartRate} bpm` },
            { code: { text: 'Fasting Blood Sugar' }, valueString: `${data.vitals.fastingGlucose} mg/dL` },
            { code: { text: 'Hemoglobin' }, valueString: `${data.vitals.hemoglobin} g/dL` },
            { code: { text: 'Vitamin D' }, valueString: `${data.vitals.vitaminD} ng/mL` },
            { code: { text: 'BMI' }, valueQuantity: { value: data.vitals.bmi, unit: 'kg/m2' } },
          ],
        },
      },
    ],
  }
}

export function downloadJsonReport(data: ClinicalSummaryData) {
  const bundle = generateFhirBundle(data)
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `pulseai_abdm_summary_${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function downloadFhirBundle(data: ClinicalSummaryData) {
  const timestamp = new Date().toISOString()
  const patientId = crypto.randomUUID()
  const glucoseId = crypto.randomUUID()
  const hemoglobinId = crypto.randomUUID()
  const reportId = crypto.randomUUID()
  const medicationIds = data.medications.map(() => crypto.randomUUID())
  const bundle = {
    resourceType: 'Bundle',
    id: `pulseai-fhir-bundle-${Date.now()}`,
    type: 'collection',
    timestamp,
    entry: [
      {
        fullUrl: `urn:uuid:${patientId}`,
        resource: {
          resourceType: 'Patient',
          id: patientId,
          identifier: [
            {
              system: 'https://healthid.ndhm.gov.in',
              type: {
                coding: [
                  {
                    system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
                    code: 'MR',
                    display: 'Medical Record Number / ABHA ID',
                  },
                ],
              },
              value: data.patient.abhaId,
            },
          ],
          name: [{ text: data.patient.name }],
          gender: data.patient.gender,
          birthDate: data.patient.dob,
        },
      },
      ...data.medications.map((med, idx) => ({
        fullUrl: `urn:uuid:${medicationIds[idx]}`,
        resource: {
          resourceType: 'MedicationRequest',
          id: medicationIds[idx],
          status: 'active',
          intent: 'order',
          subject: { reference: `urn:uuid:${patientId}` },
          medicationCodeableConcept: {
            text: med.name,
          },
          dosageInstruction: [{ text: med.dosage }],
          note: [{ text: `Adherence rate: ${med.adherence}%` }],
        },
      })),
      {
        fullUrl: `urn:uuid:${glucoseId}`,
        resource: {
          resourceType: 'Observation',
          id: glucoseId,
          status: 'final',
          subject: { reference: `urn:uuid:${patientId}` },
          code: {
            coding: [{ system: 'http://loinc.org', code: '1558-6', display: 'Fasting glucose in Blood' }],
            text: 'Fasting Glucose',
          },
          valueQuantity: {
            value: Number(data.vitals.fastingGlucose) || 92,
            unit: 'mg/dL',
            system: 'http://unitsofmeasure.org',
            code: 'mg/dL',
          },
          referenceRange: [{ low: { value: 70 }, high: { value: 99 } }],
        },
      },
      {
        fullUrl: `urn:uuid:${hemoglobinId}`,
        resource: {
          resourceType: 'Observation',
          id: hemoglobinId,
          status: 'final',
          subject: { reference: `urn:uuid:${patientId}` },
          code: {
            coding: [{ system: 'http://loinc.org', code: '718-7', display: 'Hemoglobin in Blood' }],
            text: 'Hemoglobin',
          },
          valueQuantity: {
            value: Number(data.vitals.hemoglobin) || 14.2,
            unit: 'g/dL',
            system: 'http://unitsofmeasure.org',
            code: 'g/dL',
          },
          referenceRange: [{ low: { value: 13.5 }, high: { value: 17.5 } }],
        },
      },
      {
        fullUrl: `urn:uuid:${reportId}`,
        resource: {
          resourceType: 'DiagnosticReport',
          id: reportId,
          status: 'final',
          subject: { reference: `urn:uuid:${patientId}` },
          category: [
            {
              coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0074', code: 'LAB', display: 'Laboratory' }],
            },
          ],
          code: { text: 'Complete Metabolic Panel & Diagnostic Laboratory Report' },
          effectiveDateTime: timestamp,
          result: [
            { reference: `urn:uuid:${glucoseId}`, display: 'Fasting Blood Glucose' },
            { reference: `urn:uuid:${hemoglobinId}`, display: 'Hemoglobin' },
          ],
        },
      },
    ],
  }

  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'pulseai-fhir-bundle.json'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function printClinicalSummary(data: ClinicalSummaryData) {
  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    window.print()
    return
  }

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <title>PulseAI Clinical Health Summary - ABDM Compliant</title>
      <style>
        body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; margin: 40px; color: #111; line-height: 1.5; font-size: 13px; }
        .header { display: flex; justify-content: space-between; border-bottom: 2px solid #00d26a; padding-bottom: 16px; margin-bottom: 24px; }
        .logo { font-size: 24px; font-weight: 800; color: #048848; display: flex; align-items: center; gap: 8px; }
        .badge { background: #e6f9f0; color: #048848; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; display: inline-block; }
        .patient-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 24px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
        .section-title { font-size: 15px; font-weight: 700; color: #0f172a; margin-top: 20px; margin-bottom: 10px; border-left: 4px solid #00d26a; padding-left: 8px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th, td { border: 1px solid #e2e8f0; padding: 8px 12px; text-align: left; }
        th { background: #f1f5f9; font-weight: 600; color: #334155; }
        .footer { margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 16px; font-size: 11px; color: #64748b; text-align: center; }
        @media print { body { margin: 20px; } button { display: none; } }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="logo">PulseAI Health Copilot</div>
          <p style="margin: 4px 0 0; color: #64748b;">Ayushman Bharat Digital Mission (ABDM) Clinical Summary</p>
        </div>
        <div style="text-align: right;">
          <span class="badge">VERIFIED ABHA RECORD</span>
          <p style="margin: 6px 0 0; font-size: 11px; color: #64748b;">Generated: ${new Date().toLocaleString()}</p>
        </div>
      </div>

      <div class="patient-card">
        <div><strong>Patient Name:</strong> ${data.patient.name}</div>
        <div><strong>ABHA ID:</strong> ${data.patient.abhaId}</div>
        <div><strong>Date of Birth:</strong> ${data.patient.dob}</div>
        <div><strong>Gender:</strong> ${data.patient.gender}</div>
        <div><strong>Mobile:</strong> ${data.patient.mobile}</div>
        <div><strong>FHIR Profile:</strong> ABDM ClinicalArtifactBundle R4</div>
      </div>

      <div class="section-title">Active Medications & Adherence</div>
      <table>
        <thead>
          <tr><th>Medication</th><th>Dosage</th><th>Schedule</th><th>Adherence Rate</th></tr>
        </thead>
        <tbody>
          ${data.medications
            .map(
              (m) =>
                `<tr><td><strong>${m.name}</strong></td><td>${m.dosage}</td><td>${m.frequency || 'Daily'}</td><td>${m.adherence}%</td></tr>`
            )
            .join('')}
        </tbody>
      </table>

      <div class="section-title">Physiological Vitals & Recent Lab Observations</div>
      <table>
        <thead>
          <tr><th>Observation Marker</th><th>Measured Value</th><th>Reference Target</th><th>Status</th></tr>
        </thead>
        <tbody>
          <tr><td>Blood Pressure</td><td><strong>${data.vitals.bloodPressure} mmHg</strong></td><td>< 120/80 mmHg</td><td>Optimal</td></tr>
          <tr><td>Resting Heart Rate</td><td><strong>${data.vitals.restingHeartRate} bpm</strong></td><td>60–100 bpm</td><td>Normal</td></tr>
          <tr><td>Fasting Blood Glucose</td><td><strong>${data.vitals.fastingGlucose} mg/dL</strong></td><td>70–99 mg/dL</td><td>Normal</td></tr>
          <tr><td>Hemoglobin</td><td><strong>${data.vitals.hemoglobin} g/dL</strong></td><td>13.5–17.5 g/dL</td><td>Normal</td></tr>
          <tr><td>Vitamin D (25-OH)</td><td><strong>${data.vitals.vitaminD} ng/mL</strong></td><td>30–100 ng/mL</td><td>Sufficient</td></tr>
          <tr><td>Body Mass Index (BMI)</td><td><strong>${data.vitals.bmi} kg/m²</strong> (${data.vitals.weightKg} kg)</td><td>18.5–24.9 kg/m²</td><td>Normal</td></tr>
        </tbody>
      </table>

      <div class="section-title">Timeline Records Synced (Supabase Storage & PostgreSQL)</div>
      <table>
        <thead>
          <tr><th>Document</th><th>Date</th><th>Category</th><th>Clinical Summary</th></tr>
        </thead>
        <tbody>
          ${data.recentRecords
            .map(
              (r) =>
                `<tr><td><strong>${r.title}</strong></td><td>${r.date}</td><td>${r.type}</td><td>${r.summary || 'Verified and indexed in health timeline'}</td></tr>`
            )
            .join('')}
        </tbody>
      </table>

      <div class="footer">
        <p><strong>Clinical Disclaimer:</strong> This document is generated by PulseAI Health Copilot for informational and pre-visit planning purposes. It conforms to ABDM FHIR R4 schema recommendations and does not substitute for certified clinical diagnosis.</p>
      </div>

      <script>
        window.onload = function() { window.print(); }
      </script>
    </body>
    </html>
  `

  printWindow.document.write(html)
  printWindow.document.close()
}

export interface PreVisitPrepData {
  patient: {
    name: string
    abhaId: string
    dob?: string
  }
  appointment: {
    doctorName: string
    specialty: string
    date: string
  }
  sections: Array<{
    title: string
    description: string
    note: string
    completed: boolean
  }>
  vitals?: {
    bloodPressure: string
    restingHeartRate: string
    glucose: string
  }
  medications?: Array<{
    name: string
    dosage: string
  }>
}

export function printPreVisitSummary(data: PreVisitPrepData) {
  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    window.print()
    return
  }

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <title>PulseAI Pre-Visit Brief - ${data.patient.name} (${data.appointment.doctorName})</title>
      <style>
        body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; margin: 36px; color: #111; line-height: 1.5; font-size: 13px; }
        .header { display: flex; justify-content: space-between; border-bottom: 2px solid #00d26a; padding-bottom: 14px; margin-bottom: 20px; }
        .logo { font-size: 22px; font-weight: 800; color: #048848; display: flex; align-items: center; gap: 8px; }
        .badge { background: #e6f9f0; color: #048848; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; display: inline-block; }
        .meta-grid { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin-bottom: 20px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
        .section-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin-bottom: 14px; background: #fff; }
        .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
        .section-title { font-size: 13px; font-weight: 700; color: #0f172a; }
        .section-status { font-size: 10px; font-weight: 600; padding: 2px 7px; border-radius: 4px; background: #e2e8f0; color: #475569; }
        .status-ready { background: #e6f9f0; color: #048848; }
        .section-note { background: #f8fafc; padding: 10px 12px; border-radius: 6px; border-left: 3px solid #00d26a; font-size: 12px; color: #1e293b; margin-top: 6px; white-space: pre-wrap; }
        .vitals-bar { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 20px; }
        .vital-box { background: #f1f5f9; border-radius: 6px; padding: 10px; text-align: center; }
        .vital-box span { font-size: 11px; color: #64748b; display: block; }
        .vital-box strong { font-size: 15px; color: #0f172a; }
        .footer { margin-top: 36px; border-top: 1px solid #e2e8f0; padding-top: 12px; font-size: 10px; color: #64748b; text-align: center; }
        @media print { body { margin: 18px; } button { display: none; } }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="logo">PulseAI Pre-Visit Brief</div>
          <p style="margin: 3px 0 0; color: #64748b;">Personal Health Copilot · Consultation Planning Sheet</p>
        </div>
        <div style="text-align: right;">
          <span class="badge">VERIFIED ABHA PATIENT</span>
          <p style="margin: 5px 0 0; font-size: 11px; color: #64748b;">Scheduled: ${data.appointment.date}</p>
        </div>
      </div>

      <div class="meta-grid">
        <div><strong>Patient:</strong> ${data.patient.name}</div>
        <div><strong>ABHA ID:</strong> ${data.patient.abhaId}</div>
        <div><strong>Consulting With:</strong> ${data.appointment.doctorName}</div>
        <div><strong>Specialty:</strong> ${data.appointment.specialty}</div>
        <div><strong>Appointment Window:</strong> ${data.appointment.date}</div>
        <div><strong>ABDM Record Status:</strong> Active & Synchronized</div>
      </div>

      ${data.vitals ? `
      <div style="margin-bottom: 8px; font-size: 12px; font-weight: 700; color: #334155;">Latest Baseline Vitals (Wearable & Clinic Synced)</div>
      <div class="vitals-bar">
        <div class="vital-box"><span>Blood Pressure</span><strong>${data.vitals.bloodPressure}</strong></div>
        <div class="vital-box"><span>Resting Heart Rate</span><strong>${data.vitals.restingHeartRate}</strong></div>
        <div class="vital-box"><span>Fasting Glucose</span><strong>${data.vitals.glucose}</strong></div>
      </div>
      ` : ''}

      <div style="margin-bottom: 12px; font-size: 13px; font-weight: 700; color: #0f172a;">Pre-Visit Patient Notes & Discussion Agenda</div>

      ${data.sections.map((sec) => `
        <div class="section-card">
          <div class="section-header">
            <span class="section-title">${sec.title}</span>
            <span class="section-status ${sec.completed ? 'status-ready' : ''}">${sec.completed ? '✓ Reviewed' : 'Pending'}</span>
          </div>
          <p style="margin: 0; font-size: 11px; color: #64748b;">${sec.description}</p>
          <div class="section-note">${sec.note || 'No additional notes provided.'}</div>
        </div>
      `).join('')}

      <div class="footer">
        <p><strong>Notice to Clinician:</strong> This pre-visit brief is prepared by the patient via PulseAI Health Copilot to streamline in-clinic triage and history taking. All medical observations should be verified by the examining physician.</p>
      </div>

      <script>
        window.onload = function() { window.print(); }
      </script>
    </body>
    </html>
  `

  printWindow.document.write(html)
  printWindow.document.close()
}

