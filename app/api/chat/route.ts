import { GoogleGenerativeAI } from '@google/generative-ai'
import { getOfflineHealthReply, isEmergencyMessage, type OfflineLanguage } from '@/lib/offlineHealthReply'
import { checkRateLimit, hasBodyTooLarge } from '@/lib/apiSecurity'

export const maxDuration = 30

const MAX_REQUEST_BYTES = 3 * 1024 * 1024 // base64 attachments must fit Vercel's request-body limit
const MAX_MESSAGE_CHARACTERS = 10_000

// ---------------------------------------------------------------------------
// Contextual health responses for text-only queries (Fallback Engine)
// ---------------------------------------------------------------------------
const HEALTH_RESPONSES: { patterns: RegExp[]; reply: string }[] = [
  {
    patterns: [/sleep|insomnia|tired|fatigue|rest|wake up/i],
    reply:
      "Good sleep is foundational to physical and cognitive recovery. Here are clinical evidence-backed recommendations:\n\n• **Circadian Consistency**: Maintain identical sleep and wake times daily, even on weekends.\n• **Light Hygiene**: Dim ambient lighting 45 minutes before bedtime; avoid blue light emission from mobile screens.\n• **Optimal Ambient Temperature**: Aim for 18–20 °C (65–68 °F) for ideal REM cycle regulation.\n• **Adenosine Clearance**: Restrict caffeine intake at least 8 hours prior to anticipated bedtime.\n• **Pre-Sleep Relaxation**: 4-7-8 diaphragmatic breathing or progressive muscle relaxation.\n\n*If sleep difficulties persist beyond 3 weeks, consult your physician to evaluate for sleep apnea or circadian rhythm disorders.*",
  },
  {
    patterns: [/blood pressure|hypertension|bp|systolic|diastolic/i],
    reply:
      "Blood pressure monitoring is critical for cardiovascular risk prevention:\n\n• **Reference Standards**: Optimal adult reading is < 120/80 mmHg. Stage 1 hypertension is defined as 130–139/80–89 mmHg.\n• **Sodium Reduction**: Target < 2,000 mg/day (approx. 1 tsp table salt). Focus on reducing processed packaged foods.\n• **DASH Dietary Protocol**: Prioritize potassium-rich whole foods (spinach, bananas, lentils) which counterbalance sodium.\n• **Physical Activity**: 150 minutes of weekly moderate aerobic exercise (brisk walking) can decrease systolic BP by 5–8 mmHg.\n\n*If home readings exceed 140/90 mmHg consistently, or you experience headache with visual changes, contact your physician immediately.*",
  },
  {
    patterns: [/diabetes|blood sugar|glucose|insulin|hba1c|fasting/i],
    reply:
      "Glycemic control involves dietary balance, physical activity, and medical supervision:\n\n• **Standard Targets**: Fasting blood sugar 70–99 mg/dL (normal), HbA1c < 5.7% (normal), 5.7–6.4% (prediabetes), ≥ 6.5% (diabetic range).\n• **Glycemic Index Management**: Substitute refined flour/sugars with low-GI complex carbs (steel-cut oats, millets, quinoa, legumes).\n• **Postprandial Walking**: A 10–15 minute walk immediately following major meals leverages skeletal muscle glucose uptake without insulin spikes.\n• **Hydration**: Adequate water helps kidneys flush excess circulating glucose via urine.\n\n*Always confirm personal glycemic targets with your endocrinologist or diabetologist.*",
  },
  {
    patterns: [/cholesterol|lipid|ldl|hdl|triglyceride/i],
    reply:
      "Understanding your lipid profile is vital for arterial health:\n\n• **LDL ('Bad' Cholesterol)**: Target < 100 mg/dL (or < 70 mg/dL if high cardiovascular risk).\n• **HDL ('Good' Cholesterol)**: Protective target > 50 mg/dL for men, > 60 mg/dL for women.\n• **Triglycerides**: Optimal < 150 mg/dL.\n• **Actionable Interventions**: Eliminate trans fats and reduce saturated fats; increase soluble fiber (psyllium husk, oats, chia seeds); incorporate omega-3 fatty acids.\n\n*Consult your doctor regarding whether statin therapy or lifestyle modification is indicated based on your ASCVD 10-year risk score.*",
  },
  {
    patterns: [/fever|temperature|chills|pyrexia/i],
    reply:
      "Fever is the immune system's physiological response to pathogens:\n\n• **Temperature Range**: Normal body temperature is 36.5–37.5 °C (97.7–99.5 °F). A reading above 38.0 °C (100.4 °F) is considered a fever.\n• **Immediate Measures**: Hydrate frequently with electrolytes or clear broths; rest in light clothing; use room-temperature sponge baths if uncomfortable.\n• **Red Flags**: If fever exceeds 39.5 °C (103 °F), persists beyond 3 days, or is accompanied by stiff neck, shortness of breath, confusion, or severe abdominal pain, seek emergency medical attention immediately.\n\n*Check with a healthcare professional before taking antipyretics like paracetamol or ibuprofen.*",
  },
  {
    patterns: [/headache|migraine|head pain/i],
    reply:
      "Headaches can stem from tension, dehydration, vascular changes, or eye strain:\n\n• **Common Triggers**: Dehydration, poor posture, prolonged screen time, missed meals, or high stress.\n• **Immediate Relief**: Drink 500 mL of water, rest in a darkened quiet room, apply a cool or warm compress to forehead or neck.\n• **Emergency Red Flags (SNOOP criteria)**: If you experience a 'thunderclap' headache (sudden severe onset), headache with neck stiffness, fever, visual disturbance, numbness, or difficulty speaking, visit the emergency room immediately.",
  },
  {
    patterns: [/chest pain|breathing|shortness of breath|breathless|heart attack/i],
    reply:
      "🚨 **URGENT MEDICAL WARNING**: If you or someone near you is experiencing chest pain, tightness, pressure, pain radiating to the jaw/left arm, or severe shortness of breath, **CALL EMERGENCY SERVICES (112 or 108) IMMEDIATELY**.\n\nDo not attempt to drive yourself. Rest in a comfortable seated position while emergency responders are en route.",
  },
  {
    patterns: [/report|result|lab|biomarker|test|findings|explain these/i],
    reply: 'I can explain lab reports, but I do not have any report values in this message. Share a result with its unit and reference range, or attach the report when document analysis is available. I will not assume results that were not provided.',
  },
  {
    patterns: [/hello|hi|hey|greet|who are you|pulseai/i],
    reply:
      "Hello! I'm **PulseAI**, your Personal Health Copilot developed for the Altrix Labs healthcare ecosystem.\n\nHere is how I can assist you today:\n• 📄 **Medical Records & Reports**: Upload lab tests or prescriptions to receive a plain-English explanation of values.\n• 💊 **Medications**: Learn about dosage instructions, indications, and adherence tracking.\n• 📊 **Vitals & Trends**: Understand blood pressure, glucose, and wearable biometric readings.\n• 🚨 **Emergency Triage**: Evaluate symptoms according to clinical acuity protocols.\n\n*How can I help you navigate your health journey today?*",
  },
]

// ---------------------------------------------------------------------------
// Primary Gemini API Caller (with multimodal inline image support)
// ---------------------------------------------------------------------------
async function callGemini(
  prompt: string,
  imagePayload?: { base64: string; mimeType: string },
  history: { role: string; text: string }[] = [],
  language: OfflineLanguage = 'en'
): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return null

  const genAI = new GoogleGenerativeAI(apiKey)
  const modelsToTry = ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.5-flash']

  const languageNames: Record<OfflineLanguage, string> = { en: 'English', hi: 'Hindi', te: 'Telugu', ta: 'Tamil' }
  const systemInstruction = `You are PulseAI, a warm, authoritative, clinically sound Personal Health Copilot built for the Altrix Labs HacXLerate challenge.
Provide clear, compassionate health education in plain language with bullet points and bold highlights.
If analyzing a medical report or image, explain lab markers, flag abnormal values with context, and offer sensible questions to ask a doctor.
Never issue a binding clinical diagnosis or change prescription doses. Always emphasize consulting a certified physician. Reply in ${languageNames[language]} unless the user requests another language.`

  for (const modelName of modelsToTry) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction,
      })

      const contents: any[] = []

      // Add conversation history
      for (const h of history) {
        contents.push({
          role: h.role === 'user' ? 'user' : 'model',
          parts: [{ text: h.text }],
        })
      }

      // Add current turn
      const currentParts: any[] = [{ text: prompt }]

      if (imagePayload?.base64) {
        const cleanBase64 = imagePayload.base64.replace(/^data:[^;]+;base64,/i, '')
        currentParts.unshift({
          inlineData: {
            data: cleanBase64,
            mimeType: imagePayload.mimeType || 'image/jpeg',
          },
        })
      }

      contents.push({
        role: 'user',
        parts: currentParts,
      })

      const result = await model.generateContent({ contents }, { timeout: 8_000 })
      const text = result.response.text()
      if (text && text.trim()) return text.trim()
    } catch {
      // Continue to next model on error (e.g. quota, 404, or 403)
      continue
    }
  }

  return null
}

// BazaarLink is an OpenAI-compatible gateway. Keep its credential server-side;
// this text-only fallback is used only after Gemini has failed or is unconfigured.
async function callBazaarLink(prompt: string, history: { role: string; text: string }[], language: OfflineLanguage) {
  const apiKey = process.env.BAZAARLINK_API_KEY
  if (!apiKey) return null

  const languageNames: Record<OfflineLanguage, string> = { en: 'English', hi: 'Hindi', te: 'Telugu', ta: 'Tamil' }
  try {
    const response = await fetch('https://api.bazaarlink.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.BAZAARLINK_MODEL || 'qwen/qwen3.7-flash:free',
        messages: [
          { role: 'system', content: `You are PulseAI, a careful health education assistant. Be compassionate and plain-spoken. Never diagnose or change medication doses. Recommend a qualified clinician for personal medical decisions. Reply in ${languageNames[language]}.` },
          ...history.map((item) => ({ role: item.role === 'user' ? 'user' : 'assistant', content: item.text })),
          { role: 'user', content: prompt },
        ],
      }),
      signal: AbortSignal.timeout(8_000),
      cache: 'no-store',
    })
    if (!response.ok) return null
    const data = await response.json()
    const text = data?.choices?.[0]?.message?.content
    return typeof text === 'string' && text.trim() ? text.trim() : null
  } catch {
    return null
  }
}

async function callGroq(prompt: string, history: { role: string; text: string }[], language: OfflineLanguage) {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return null

  const languageNames: Record<OfflineLanguage, string> = { en: 'English', hi: 'Hindi', te: 'Telugu', ta: 'Tamil' }
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || 'openai/gpt-oss-20b',
        messages: [
          { role: 'system', content: `You are PulseAI, a careful health education assistant. Be compassionate and plain-spoken. Never diagnose or change medication doses. Recommend a qualified clinician for personal medical decisions. Reply in ${languageNames[language]}.` },
          ...history.map((item) => ({ role: item.role === 'user' ? 'user' : 'assistant', content: item.text })),
          { role: 'user', content: prompt },
        ],
      }),
      signal: AbortSignal.timeout(8_000),
      cache: 'no-store',
    })
    if (!response.ok) return null
    const data = await response.json()
    const text = data?.choices?.[0]?.message?.content
    return typeof text === 'string' && text.trim() ? text.trim() : null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Route Handler: POST /api/chat
// ---------------------------------------------------------------------------
export async function POST(request: Request) {
  const rate = checkRateLimit(request)
  if (!rate.allowed) {
    return Response.json({ error: 'Too many requests. Please try again shortly.' }, {
      status: 429,
      headers: { 'Retry-After': String(rate.retryAfter) },
    })
  }

  if (hasBodyTooLarge(request, MAX_REQUEST_BYTES + 512 * 1024)) {
    return Response.json({ error: 'Request is too large. Attachments must be 3 MB or smaller.' }, { status: 413 })
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Could not parse JSON body.' }, { status: 400 })
  }

  if (!body || typeof body !== 'object') {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const supportedLanguages: OfflineLanguage[] = ['en', 'hi', 'te', 'ta']
  const language: OfflineLanguage = supportedLanguages.includes(body.language) ? body.language : 'en'

  // 1. Normalize input: accept message, text, prompt, query, or messages array
  let userText = ''
  if (typeof body.message === 'string' && body.message.trim()) {
    userText = body.message.trim()
  } else if (typeof body.text === 'string' && body.text.trim()) {
    userText = body.text.trim()
  } else if (typeof body.prompt === 'string' && body.prompt.trim()) {
    userText = body.prompt.trim()
  } else if (typeof body.query === 'string' && body.query.trim()) {
    userText = body.query.trim()
  } else if (Array.isArray(body.messages) && body.messages.length > 0) {
    // Extract last user message from AI SDK / Chat UI array
    const last = [...body.messages].reverse().find((m: any) => m && (m.role === 'user' || !m.role))
    if (last) {
      if (typeof last.content === 'string') userText = last.content.trim()
      else if (typeof last.text === 'string') userText = last.text.trim()
      else if (Array.isArray(last.parts)) {
        userText = last.parts
          .filter((p: any) => p && typeof p.text === 'string')
          .map((p: any) => p.text)
          .join(' ')
          .trim()
      }
    }
  }

  // If still empty, provide welcoming health prompt instead of hard error
  if (!userText) {
    userText = 'Hello PulseAI, what can you help me with?'
  }

  if (userText.length > MAX_MESSAGE_CHARACTERS) {
    userText = userText.slice(0, MAX_MESSAGE_CHARACTERS)
  }

  // 2. Extract image attachment if present (base64 string or attachment object)
  let imagePayload: { base64: string; mimeType: string } | undefined
  let attachedFileName: string | undefined

  if (typeof body.imageBase64 === 'string' && body.imageBase64) {
    imagePayload = { base64: body.imageBase64, mimeType: body.imageType || 'image/jpeg' }
  } else if (typeof body.image === 'string' && body.image) {
    imagePayload = { base64: body.image, mimeType: body.imageType || 'image/jpeg' }
  } else if (body.attachment && typeof body.attachment === 'object') {
    imagePayload = {
      base64: body.attachment.base64 || body.attachment.data || '',
      mimeType: body.attachment.mimeType || body.attachment.type || 'image/jpeg',
    }
    attachedFileName = body.attachment.name
  } else if (typeof body.attachment === 'string' && body.attachment.startsWith('data:')) {
    const match = body.attachment.match(/^data:([^;]+);base64,(.+)$/)
    if (match) {
      imagePayload = { mimeType: match[1], base64: match[2] }
    }
  }

  if (typeof body.fileName === 'string') {
    attachedFileName = body.fileName
  }

  if (imagePayload?.base64 && Math.ceil(imagePayload.base64.replace(/^data:[^;]+;base64,/i, '').length * 0.75) > MAX_REQUEST_BYTES) {
    return Response.json({ error: 'Attachments must be 3 MB or smaller.' }, { status: 413 })
  }

  // 3. Normalize history if provided
  const history: { role: string; text: string }[] = []
  if (Array.isArray(body.history)) {
    for (const item of body.history) {
      if (item && typeof item === 'object' && typeof item.text === 'string') {
        history.push({
          role: item.role === 'user' ? 'user' : 'assistant',
          text: item.text,
        })
      }
    }
  }

  // 4. Try Gemini Multimodal / Text Generation
  const geminiResponse = await callGemini(userText, imagePayload, history, language)

  if (geminiResponse) {
    return Response.json({
      reply: geminiResponse,
      text: geminiResponse,
      message: geminiResponse,
      role: 'assistant',
    })
  }

  // Gateway fallbacks are text-only; attachments continue to the conservative
  // offline response after Gemini's multimodal path fails.
  const gatewayResponse = imagePayload ? null : await callBazaarLink(userText, history, language)
  if (gatewayResponse) {
    return Response.json({ reply: gatewayResponse, text: gatewayResponse, message: gatewayResponse, role: 'assistant' })
  }
  const groqResponse = imagePayload ? null : await callGroq(userText, history, language)
  if (groqResponse) {
    return Response.json({ reply: groqResponse, text: groqResponse, message: groqResponse, role: 'assistant' })
  }

  // 5. Intelligent Fallback Strategy
  let finalReply = ''
  if (isEmergencyMessage(userText)) {
    finalReply = getOfflineHealthReply(userText, language)
  } else if (imagePayload?.base64 || attachedFileName) {
    finalReply = getOfflineHealthReply(userText, language, true)
  } else {
    const matched = HEALTH_RESPONSES.find((item) =>
      item.patterns.some((pattern) => pattern.test(userText))
    )
    if (language === 'en' && matched && !/report|result|lab|biomarker|test|findings|explain these/i.test(userText)) {
      finalReply = matched.reply
    } else {
      finalReply = getOfflineHealthReply(userText, language)
    }
  }

  return Response.json({
    reply: finalReply,
    text: finalReply,
    message: finalReply,
    role: 'assistant',
  })
}
