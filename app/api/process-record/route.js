import { GoogleGenerativeAI } from '@google/generative-ai'
import { supabaseServer } from '@/lib/supabaseServer'
import { checkRateLimit, hasBodyTooLarge } from '@/lib/apiSecurity'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

function safeParseJson(text) {
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    const cleaned = text
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/gi, '')
      .trim()
    try {
      return JSON.parse(cleaned)
    } catch {
      return null
    }
  }
}

export async function POST(request) {
  try {
    const rate = checkRateLimit(request, 20)
    if (!rate.allowed) {
      return Response.json({ error: 'Too many uploads. Please try again shortly.' }, {
        status: 429,
        headers: { 'Retry-After': String(rate.retryAfter) },
      })
    }

    if (hasBodyTooLarge(request, 5 * 1024 * 1024)) {
      return Response.json({ error: 'The upload request must be 5 MB or smaller.' }, { status: 413 })
    }

    const formData = await request.formData()
    const file = formData.get('file')
    const mockAbhaId = formData.get('mockAbhaId')?.toString() || '91-8273-4920-1124'
    const language = formData.get('language')?.toString() || 'en'
    const supportedLanguages = new Set(['en', 'hi', 'te', 'ta'])

    if (!file || typeof file === 'string') {
      return Response.json({ error: 'Please select a valid medical document to upload.' }, { status: 400 })
    }

    if (file.size <= 0 || file.size > 4 * 1024 * 1024) {
      return Response.json({ error: 'The document must be between 1 byte and 4 MB.' }, { status: 400 })
    }

    const allowedMimeTypes = new Set(['application/pdf', 'image/jpeg', 'image/png'])
    if (!allowedMimeTypes.has(file.type)) {
      return Response.json({ error: 'Only PDF, JPEG, and PNG medical records are supported.' }, { status: 415 })
    }
    if (!supportedLanguages.has(language)) {
      return Response.json({ error: 'Choose English, Hindi, Telugu, or Tamil.' }, { status: 400 })
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL || !supabaseServer) {
      return Response.json({ error: 'Record storage is unavailable because Supabase is not configured.' }, { status: 503 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const originalName = file.name || 'document'
    const fileType = file.type || 'application/octet-stream'

    // 1. Upload to Supabase Storage bucket 'medical_records'
    const cleanFileName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_')
    const storagePath = `${Date.now()}-${cleanFileName}`

    const { data: uploadData, error: storageError } = await supabaseServer.storage
      .from('medical_records')
      .upload(storagePath, buffer, {
        contentType: fileType,
        upsert: false,
      })

    if (storageError) {
      console.error('Supabase storage upload error:', storageError)
      return Response.json({ error: 'Storage upload failed. Please try again.' }, { status: 500 })
    }

    // Medical documents live in a private bucket; return a time-limited view link.
    const { data: urlData, error: signedUrlError } = await supabaseServer.storage
      .from('medical_records')
      .createSignedUrl(storagePath, 60 * 60 * 24 * 7)
    if (signedUrlError || !urlData?.signedUrl) {
      await supabaseServer.storage.from('medical_records').remove([storagePath])
      return Response.json({ error: 'Could not create a private document link.' }, { status: 500 })
    }
    const documentUrl = urlData.signedUrl

    // 2. Extract medical data from the original document with vision/OCR.
    let extractedData = null

    const apiKey = process.env.GEMINI_API_KEY
    if (apiKey) {
      try {
        const genAI = new GoogleGenerativeAI(apiKey)
        const modelName = process.env.GEMINI_MODEL || 'gemini-3.8-flash'
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            responseMimeType: 'application/json',
          },
          systemInstruction: `You are an expert clinical AI specialist. Your job is to extract medical data from documents (prescriptions, lab tests, discharge summaries, imaging reports) and translate them into a clear 5th-grade reading level explanation for patients.
You must respond with STRICT JSON adhering to this exact schema:
{
  "document_type": "string (e.g. Lab report, Prescription, Discharge summary, Diagnostic scan, Consultation note)",
  "document_date": "string (ISO date YYYY-MM-DD if clearly present, otherwise empty string)",
  "title": "string (brief descriptive document title)",
  "plain_english_summary": "string (explained clearly at a 5th-grade reading level so any patient can understand)",
  "medicines": [
    {
      "name": "string (name of medication)",
      "dosage": "string (e.g. 500 mg)",
      "frequency": "string (e.g. twice daily)",
      "instructions": "string (e.g. take with meals)"
    }
  ],
  "test_values": [
    {
      "name": "string (name of lab test or measurement)",
      "value": "string",
      "unit": "string",
      "abnormal_flag": boolean (true if outside reference range or dangerous, false if normal),
      "explanation": "string (simple 5th-grade level explanation of what this result means)"
    }
  ],
  "diagnoses": ["string (list of medical diagnoses or clinical findings)"],
  "key_findings": ["string (important observations)"]
}`,
        })

        const mime = fileType.includes('pdf')
          ? 'application/pdf'
          : fileType.includes('png')
          ? 'image/png'
          : fileType.includes('jpeg') || fileType.includes('jpg')
          ? 'image/jpeg'
          : fileType || 'application/pdf'

        const languageName = { en: 'English', hi: 'Hindi', te: 'Telugu', ta: 'Tamil' }[language]
        const prompt = `Read this complete medical document, including scanned pages, handwriting, and any English/regional-language mix. Transcribe uncertain text conservatively; never guess missing values. Extract the document date, all medicines and exact dosages, test names/values/units/reference ranges, diagnoses, and abnormal flags. Explain only what is supported by the document in simple patient-friendly language. Return the summary and explanations in ${languageName}; preserve medicine names, units, and measured values exactly. If a field is absent or illegible, leave it empty rather than inventing it.`

        const result = await model.generateContent([
          prompt,
          {
            inlineData: {
              data: buffer.toString('base64'),
              mimeType: mime,
            },
          },
        ], { timeout: 20_000 })

        const responseText = result.response.text()
        extractedData = safeParseJson(responseText)
      } catch (geminiError) {
        console.warn('Gemini extraction failed; preserving the upload for manual review:', geminiError.message || geminiError)
      }
    }

    // Preserve the original document for review if OCR is unavailable; never invent findings.
    let extractionStatus = 'extracted'
    if (!extractedData) {
      const reviewMessages = {
        en: 'AI extraction was unavailable or could not read this document. The original file is saved for manual review; no medical findings were inferred.',
        hi: 'AI विश्लेषण उपलब्ध नहीं था या दस्तावेज़ पढ़ नहीं सका। मूल फ़ाइल को मैन्युअल समीक्षा के लिए सुरक्षित किया गया है; कोई चिकित्सीय निष्कर्ष नहीं गढ़ा गया।',
        te: 'AI విశ్లేషణ అందుబాటులో లేదు లేదా ఈ పత్రాన్ని చదవలేకపోయింది. అసలు ఫైల్ మాన్యువల్ సమీక్ష కోసం భద్రపరచబడింది; వైద్య ఫలితాలను ఊహించి ఇవ్వలేదు.',
        ta: 'AI பகுப்பாய்வு கிடைக்கவில்லை அல்லது இந்த ஆவணத்தைப் படிக்க முடியவில்லை. கைமுறை மதிப்பாய்விற்காக அசல் கோப்பு சேமிக்கப்பட்டது; மருத்துவ முடிவுகள் எதுவும் ஊகிக்கப்படவில்லை.',
      }
      extractedData = {
        document_type: 'Uploaded medical document',
        title: originalName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ') || 'Medical record',
        document_date: '',
        plain_english_summary: reviewMessages[language],
        medicines: [],
        test_values: [],
        diagnoses: [],
        key_findings: [],
        extraction_status: 'needs_manual_review',
      }
      extractionStatus = 'needs_manual_review'
    }

    // Ensure all required fields exist
    if (!extractedData.plain_english_summary) {
      extractedData.plain_english_summary = 'Medical record successfully processed and securely added to your personal health timeline.'
    }
    if (!Array.isArray(extractedData.medicines)) {
      extractedData.medicines = []
    }
    if (!Array.isArray(extractedData.test_values)) {
      extractedData.test_values = []
    }
    if (!Array.isArray(extractedData.diagnoses)) {
      extractedData.diagnoses = []
    }

    // 3. Save into public.health_timeline table with extracted JSON in fhir_data
    const { data: savedRecord, error: insertError } = await supabaseServer
      .from('health_timeline')
      .insert({
        mock_abha_id: mockAbhaId,
        document_url: documentUrl,
        document_type: extractedData.document_type || 'Lab report',
        ai_summary_english: extractedData.plain_english_summary,
        fhir_data: extractedData,
      })
      .select()
      .single()

    if (insertError) {
      await supabaseServer.storage.from('medical_records').remove([storagePath])
      console.error('Supabase health_timeline insert error:', insertError)
      return Response.json({ error: 'Database insert failed. Please try again.' }, { status: 500 })
    }

    // 4. Return saved entry to frontend
    return Response.json({
      success: true,
      extractionStatus,
      record: savedRecord,
      extracted: extractedData,
    })
  } catch (error) {
    console.error('Unexpected error processing record:', error)
    return Response.json({ error: 'An unexpected error occurred processing your record.' }, { status: 500 })
  }
}
