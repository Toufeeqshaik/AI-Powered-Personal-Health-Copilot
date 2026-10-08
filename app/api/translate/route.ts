import { GoogleGenerativeAI } from '@google/generative-ai'
import { checkRateLimit } from '@/lib/apiSecurity'

export const maxDuration = 30

const MEDICAL_TRANSLATIONS: Record<string, Record<string, string>> = {
  hi: {
    'Blood pressure is normal': 'रक्तचाप सामान्य है',
    'Fasting glucose is slightly elevated': 'उपवास में ग्लूकोज का स्तर थोड़ा बढ़ा हुआ है',
    'Follow up in 4 weeks': '4 सप्ताह में डॉक्टर से पुनः मिलें',
    'Take with food': 'भोजन के साथ लें',
    'All clear': 'सभी रिपोर्ट सामान्य हैं',
  },
  te: {
    'Blood pressure is normal': 'రక్తపోటు సాధారణంగా ఉంది',
    'Fasting glucose is slightly elevated': 'ఫాస్టింగ్ గ్లూకోజ్ కొద్దిగా పెరిగింది',
    'Follow up in 4 weeks': '4 వారాల తర్వాత వైద్యుడిని సంప్రదించండి',
    'Take with food': 'ఆహారంతో పాటు తీసుకోండి',
    'All clear': 'అన్ని నివేదికలు సాధారణం',
  },
  ta: {
    'Blood pressure is normal': 'இரத்த அழுத்தம் இயல்பாக உள்ளது',
    'Fasting glucose is slightly elevated': 'உணவுக்கு முன் குளுக்கோஸ் சற்று அதிகமாக உள்ளது',
    'Follow up in 4 weeks': '4 வாரங்களில் மருத்துவரை மீண்டும் சந்திக்கவும்',
    'Take with food': 'உணவுடன் உட்கொள்ளவும்',
    'All clear': 'அனைத்து அறிக்கைகளும் சாதாரணமாக உள்ளன',
  },
}

export async function POST(request: Request) {
  const rate = checkRateLimit(request)
  if (!rate.allowed) {
    return Response.json({ error: 'Too many requests. Please try again shortly.' }, {
      status: 429,
      headers: { 'Retry-After': String(rate.retryAfter) },
    })
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON request body.' }, { status: 400 })
  }

  const { text, targetLanguage = 'hi' } = body || {}

  if (!text || typeof text !== 'string') {
    return Response.json({ error: 'Field "text" is required.' }, { status: 400 })
  }

  if (text.length > 20_000) {
    return Response.json({ error: 'Text must be 20,000 characters or fewer.' }, { status: 413 })
  }

  if (!['en', 'hi', 'te', 'ta'].includes(targetLanguage)) {
    return Response.json({ error: 'Choose English, Hindi, Telugu, or Tamil.' }, { status: 400 })
  }

  if (targetLanguage === 'en') {
    return Response.json({ originalText: text, translatedText: text, targetLanguage })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (apiKey) {
    try {
      const genAI = new GoogleGenerativeAI(apiKey)
      const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-3.8-flash' })
      const prompt = `Translate the following medical summary/clinical text into ${targetLanguage} (maintain clinical accuracy and plain language comprehension for patients):\n\n"${text}"\n\nReturn ONLY the translated text.`
      const result = await model.generateContent(prompt, { timeout: 8_000 })
      const translated = result.response.text()
      if (translated && translated.trim()) {
        return Response.json({
          originalText: text,
          translatedText: translated.trim(),
          targetLanguage,
        })
      }
    } catch {
      // Fall through to fallback
    }
  }

  // Fallback translation dictionary
  const langDict = MEDICAL_TRANSLATIONS[targetLanguage] || {}
  const match = langDict[text] || text

  return Response.json({
    originalText: text,
    translatedText: match,
    targetLanguage,
    note: match === text
      ? 'Translation service is unavailable; the original text is shown unchanged.'
      : 'Translated with the built-in offline phrasebook.',
  })
}
