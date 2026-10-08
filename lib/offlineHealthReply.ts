export type OfflineLanguage = 'en' | 'hi' | 'te' | 'ta'

const COPY: Record<OfflineLanguage, { emergency: string; attachment: string; report: string; general: string }> = {
  en: {
    emergency: 'This may be an emergency. Call 112 or 108 now, especially for chest pain, severe breathing difficulty, fainting, or sudden weakness. Do not wait for an online response.',
    attachment: 'I can’t read the attachment while the AI service is offline, so I won’t guess its contents. You can paste the test names, values, units, and reference ranges here, and I can explain them in general terms. For urgent symptoms, call 112 or 108.',
    report: 'I can help explain a report, but I can’t see any results in your message. Paste the test name, value, unit, and the lab’s reference range. I’ll explain what that information generally means; your clinician should interpret it for your situation.',
    general: 'PulseAI’s AI service is temporarily unavailable, but I can still offer general guidance. Share the specific question or the values you want explained. I can’t diagnose conditions or change medication instructions; contact your clinician for personal medical advice.',
  },
  hi: {
    emergency: 'यह आपात स्थिति हो सकती है। सीने में दर्द, बहुत अधिक सांस लेने में कठिनाई, बेहोशी या अचानक कमजोरी हो तो अभी 112 या 108 पर कॉल करें। ऑनलाइन जवाब का इंतज़ार न करें।',
    attachment: 'AI सेवा बंद होने के कारण मैं संलग्न फ़ाइल पढ़ नहीं सकता/सकती, इसलिए उसकी सामग्री का अनुमान नहीं लगाऊँगा/गी। जाँच का नाम, परिणाम, इकाई और संदर्भ सीमा यहाँ लिखें; मैं सामान्य अर्थ समझा सकता/सकती हूँ। तुरंत मदद के लिए 112 या 108 पर कॉल करें।',
    report: 'मैं रिपोर्ट समझाने में मदद कर सकता/सकती हूँ, लेकिन आपके संदेश में रिपोर्ट के परिणाम नहीं दिख रहे हैं। जाँच का नाम, परिणाम, इकाई और लैब की संदर्भ सीमा भेजें। व्यक्तिगत सलाह के लिए अपने डॉक्टर से बात करें।',
    general: 'PulseAI की AI सेवा अभी उपलब्ध नहीं है, फिर भी मैं सामान्य जानकारी दे सकता/सकती हूँ। अपना सवाल या समझने वाले परिणाम लिखें। मैं बीमारी का निदान या दवा की खुराक में बदलाव नहीं कर सकता/सकती; व्यक्तिगत सलाह के लिए डॉक्टर से संपर्क करें।',
  },
  te: {
    emergency: 'ఇది అత్యవసర పరిస్థితి కావచ్చు. ఛాతినొప్పి, తీవ్రమైన శ్వాస ఇబ్బంది, మూర్ఛ లేదా అకస్మాత్తు బలహీనత ఉంటే వెంటనే 112 లేదా 108కు కాల్ చేయండి. ఆన్‌లైన్ సమాధానం కోసం వేచి ఉండకండి.',
    attachment: 'AI సేవ అందుబాటులో లేకపోవడంతో జతచేసిన ఫైల్‌ను చదవలేను; అందులోని విషయాలను ఊహించి చెప్పను. పరీక్ష పేరు, విలువ, యూనిట్, సూచన పరిధిని ఇక్కడ పంపండి; సాధారణ అర్థాన్ని వివరిస్తాను. అత్యవసర లక్షణాలుంటే 112 లేదా 108కు కాల్ చేయండి.',
    report: 'రిపోర్టును అర్థం చేసుకోవడంలో సహాయం చేస్తాను, కానీ మీ సందేశంలో ఫలితాలు కనిపించడం లేదు. పరీక్ష పేరు, విలువ, యూనిట్, ల్యాబ్ సూచన పరిధిని పంపండి. వ్యక్తిగత సలహా కోసం మీ వైద్యుడిని సంప్రదించండి.',
    general: 'PulseAI AI సేవ తాత్కాలికంగా అందుబాటులో లేదు, కానీ సాధారణ ఆరోగ్య సమాచారాన్ని అందించగలను. మీ ప్రశ్న లేదా వివరించాల్సిన విలువలను పంపండి. నేను వ్యాధిని నిర్ధారించలేను లేదా మందుల మోతాదును మార్చలేను; వ్యక్తిగత సలహా కోసం వైద్యుడిని సంప్రదించండి.',
  },
  ta: {
    emergency: 'இது அவசரநிலையாக இருக்கலாம். நெஞ்சுவலி, கடுமையான மூச்சுத்திணறல், மயக்கம் அல்லது திடீர் பலவீனம் இருந்தால் உடனே 112 அல்லது 108-ஐ அழைக்கவும். இணையப் பதிலுக்காகக் காத்திருக்க வேண்டாம்.',
    attachment: 'AI சேவை கிடைக்காததால் இணைப்பைப் படிக்க முடியவில்லை; அதன் உள்ளடக்கத்தை நான் ஊகிக்க மாட்டேன். பரிசோதனைப் பெயர், மதிப்பு, அலகு, குறிப்பு வரம்பை இங்கே பகிரவும்; பொதுவான பொருளை விளக்குகிறேன். அவசர அறிகுறிகள் இருந்தால் 112 அல்லது 108-ஐ அழைக்கவும்.',
    report: 'அறிக்கையை விளக்க உதவுகிறேன், ஆனால் உங்கள் செய்தியில் முடிவுகள் இல்லை. பரிசோதனைப் பெயர், மதிப்பு, அலகு மற்றும் ஆய்வகத்தின் குறிப்பு வரம்பைப் பகிரவும். தனிப்பட்ட ஆலோசனைக்கு மருத்துவரை அணுகவும்.',
    general: 'PulseAI AI சேவை தற்காலிகமாகக் கிடைக்கவில்லை; இருப்பினும் பொதுவான சுகாதாரத் தகவலை வழங்க முடியும். உங்கள் கேள்வி அல்லது விளக்க வேண்டிய மதிப்புகளைப் பகிரவும். நோயைக் கண்டறியவோ மருந்தளவை மாற்றவோ முடியாது; தனிப்பட்ட ஆலோசனைக்கு மருத்துவரை அணுகவும்.',
  },
}

export function isEmergencyMessage(query: string) {
  return /chest pain|shortness of breath|difficulty breathing|can't breathe|cannot breathe|sudden weakness|மூச்சுத்திணறல்|நெஞ்சுவலி|శ్వాస ఇబ్బంది|ఛాతి నొప్పి|सीने में दर्द|सांस लेने में कठिनाई|अचानक कमजोरी/i.test(query)
}

export function getOfflineHealthReply(query: string, language: OfflineLanguage = 'en', hasAttachment = false) {
  const copy = COPY[language] || COPY.en
  const normalized = query.toLowerCase()
  if (isEmergencyMessage(query)) return copy.emergency
  if (hasAttachment) return copy.attachment
  if (/report|lab|result|biomarker|test value|medical record|रिपोर्ट|रिपోర్ట్|அறிக்கை|పరీక్ష/.test(normalized)) return copy.report
  return copy.general
}
