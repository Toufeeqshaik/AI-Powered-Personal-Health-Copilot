'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback, type FormEvent } from 'react'
import type { LucideIcon } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { AiChatWidget } from '@/components/ai-chat-widget'
import { TRANSLATIONS, LOCALE_MAP, type Language } from '@/lib/i18n'
import { getOfflineHealthReply } from '@/lib/offlineHealthReply'
import { printClinicalSummary, downloadJsonReport, downloadFhirBundle, printPreVisitSummary, type ClinicalSummaryData } from '@/lib/clinicalSummary'
import {
  Activity, AlertCircle, AlertTriangle, ArrowRight, ArrowUpRight, AudioLines, Bell, CalendarDays,
  Check, CheckCircle2, ChevronDown, ChevronRight, CircleHelp, Clock3, CloudUpload, Download,
  FileHeart, FilePlus2, FileText, Heart, HeartPulse, Home, Loader2, Menu, MessageCircle,
  MessageSquare, MoreHorizontal, Pill, Plus, RefreshCw, Search, Send, Settings, ShieldCheck, Sparkles,
  Languages, Mic, Moon, Paperclip, PhoneCall, Stethoscope, Sun, Thermometer, Upload, Watch, X, Zap,
} from 'lucide-react'

type Section = 'Overview' | 'Health Records' | 'Medications' | 'Copilot Chat' | 'Emergency Triage' | 'Device Sync' | 'Appointments' | 'Pre-Visit Prep' | 'Settings'

type NavItem = { key: string; label: Section; icon: LucideIcon }

const navItems: NavItem[] = [
  { key: 'nav.overview', label: 'Overview', icon: Home },
  { key: 'nav.records', label: 'Health Records', icon: FileHeart },
  { key: 'nav.medications', label: 'Medications', icon: Pill },
  { key: 'nav.chat', label: 'Copilot Chat', icon: MessageCircle },
  { key: 'nav.triage', label: 'Emergency Triage', icon: Activity },
  { key: 'nav.devices', label: 'Device Sync', icon: Watch },
  { key: 'nav.appointments', label: 'Appointments', icon: CalendarDays },
  { key: 'nav.prep', label: 'Pre-Visit Prep', icon: FileText },
]

type ChatMessage = { role: 'assistant' | 'user'; text: string }
type SpeechResultEvent = { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }
type BrowserSpeechRecognition = {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: SpeechResultEvent) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}
type SpeechWindow = Window & {
  SpeechRecognition?: new () => BrowserSpeechRecognition
  webkitSpeechRecognition?: new () => BrowserSpeechRecognition
}

const initialMessages: ChatMessage[] = [
  { role: 'assistant', text: 'Hi Alex, I’m PulseAI, your Personal Health Copilot. I can help analyze your medical reports, track medications, or explain test markers. What is on your mind today?' },
  { role: 'user', text: 'I have a mild headache and slight fever. What should I do?' },
  { role: 'assistant', text: 'I’m sorry you’re feeling unwell. A mild headache and fever can stem from dehydration, viral infection, or tension. Consider resting, hydrating with electrolytes, and monitoring your body temperature every 4 hours. If symptoms persist beyond 48 hours or you experience neck stiffness, please consult your physician.' },
]

const records = [
  { title: 'Blood Test Report', detail: 'Apr 12, 2025 · Apollo Diagnostics', category: 'Lab Results', icon: Activity, color: 'mint' },
  { title: 'X-Ray Chest', detail: 'Mar 18, 2025 · Sunshine Hospital', category: 'Documents', icon: FileHeart, color: 'blue' },
  { title: 'Prescription', detail: 'Apr 05, 2025 · Dr. Sarah Khan', category: 'Documents', icon: Pill, color: 'violet' },
  { title: 'Medical Summary', detail: 'Mar 20, 2025 · HealthHub', category: 'Recent Records', icon: FileText, color: 'amber' },
]

export interface MedItem {
  name: string
  dosage: string
  frequency?: string
  time: string
  adherence: number
  color: string
  loggedToday?: boolean
}

const initialMeds: MedItem[] = [
  { name: 'Metformin', dosage: '500 mg · Twice daily', frequency: 'Twice daily', time: '8:00 AM · 8:00 PM', adherence: 96, color: 'mint' },
  { name: 'Omega-3', dosage: '1000 mg · Once daily', frequency: 'Once daily', time: 'With breakfast', adherence: 88, color: 'blue' },
  { name: 'Atorvastatin', dosage: '20 mg · Once daily', frequency: 'Once daily', time: '9:00 PM', adherence: 92, color: 'violet' },
]

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand ${compact ? 'brand-compact' : ''}`}>
      <div className="brand-mark"><HeartPulse size={21} strokeWidth={1.8} /></div>
      <div className="brand-copy"><strong>PulseAI</strong><span>Health Copilot</span></div>
    </div>
  )
}

function ProfilePortrait({ imageUrl, className = '' }: { imageUrl: string | null; className?: string }) {
  return (
    <span className={`profile-portrait ${className}`} role="img" aria-label="Alex Morgan profile picture">
      {imageUrl ? <img src={imageUrl} alt="" /> : (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <defs><linearGradient id="portrait-bg" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#34d399" /><stop offset="1" stopColor="#0891b2" /></linearGradient></defs>
          <circle cx="32" cy="32" r="32" fill="url(#portrait-bg)" />
          <path d="M10 64c1-13 9-20 22-20s21 7 22 20" fill="#123b43" />
          <path d="M20 27c0-11 5-18 13-18 10 0 15 8 14 19-1-4-4-7-7-9-5 4-11 6-20 6z" fill="#273443" />
          <ellipse cx="32" cy="30" rx="12" ry="15" fill="#f2bd9f" />
          <path d="M20 26c2-12 8-17 15-16 7 1 11 7 12 14-6-2-10-6-12-9-4 5-9 9-15 11z" fill="#263342" />
          <circle cx="28" cy="30" r="1.2" fill="#273443" /><circle cx="37" cy="30" r="1.2" fill="#273443" />
          <path d="M29 37c2 2 5 2 7 0" fill="none" stroke="#a85652" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      )}
    </span>
  )
}

function AnimatedGreeting({ profileImage, t }: { profileImage: string | null; t: (key: string) => string }) {
  const prompts = useMemo(() => [
    t('hero.greetingPrefix'),
    t('hero.checkIn'),
    t('hero.reports'),
    t('hero.medications'),
    t('hero.trends'),
  ], [t])
  const [promptIndex, setPromptIndex] = useState(0)
  const [visibleCharacters, setVisibleCharacters] = useState(0)

  useEffect(() => {
    let timeoutId = 0
    let characterIndex = 0
    let phase: 'typing' | 'hold' | 'erasing' = 'typing'
    let currentPrompt = promptIndex
    const tick = () => {
      const prompt = prompts[currentPrompt]
      if (phase === 'typing') {
        characterIndex += 1
        setVisibleCharacters(characterIndex)
        if (characterIndex >= prompt.length) {
          phase = 'hold'
          timeoutId = window.setTimeout(tick, 1800)
        } else timeoutId = window.setTimeout(tick, 54)
      } else if (phase === 'hold') {
        phase = 'erasing'
        timeoutId = window.setTimeout(tick, 480)
      } else {
        characterIndex -= 1
        setVisibleCharacters(characterIndex)
        if (characterIndex <= 0) {
          currentPrompt = (currentPrompt + 1) % prompts.length
          setPromptIndex(currentPrompt)
          phase = 'typing'
          timeoutId = window.setTimeout(tick, 300)
        } else timeoutId = window.setTimeout(tick, 28)
      }
    }
    timeoutId = window.setTimeout(tick, 420)
    return () => window.clearTimeout(timeoutId)
  }, [prompts])

  const visibleText = prompts[promptIndex].slice(0, visibleCharacters)
  return (
    <span className="animated-greeting" aria-live="off" aria-label={prompts[promptIndex]}>
      <span aria-hidden="true">{visibleText}</span>
      {promptIndex === 0 && visibleCharacters >= prompts[0].length && <ProfilePortrait imageUrl={profileImage} className="hero-portrait" />}
      <span className="typing-caret" aria-hidden="true" />
    </span>
  )
}

function Sidebar({
  active,
  onSelect,
  open,
  onClose,
  lang = 'en',
  profileImage,
  onProfileImageChange,
}: {
  active: Section
  onSelect: (page: Section) => void
  open: boolean
  onClose: () => void
  lang: Language
  profileImage: string | null
  onProfileImageChange: (dataUrl: string) => void
}) {
  const t = (k: string) => TRANSLATIONS[lang]?.[k] || TRANSLATIONS['en']?.[k] || k
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const abhaParts = t('workspace.abha').split(':')

  return (
    <>
      {open && <button aria-label="Close navigation" className="sidebar-scrim" onClick={onClose} />}
      <aside className={`sidebar ${open ? 'sidebar-open' : ''}`} aria-label="Main navigation">
        <div className="sidebar-top">
          <Brand />
          <button className="icon-button mobile-close" aria-label="Close menu" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="workspace-switch">
          <button className="workspace-avatar" type="button" aria-label="Upload profile picture" title="Change profile picture" onClick={() => avatarInputRef.current?.click()}>
            <ProfilePortrait imageUrl={profileImage} />
            <span className="avatar-edit-indicator"><Upload size={11} /></span>
          </button>
          <div className="workspace-profile-copy">
            <span>Alex Morgan</span>
            <small>{t('workspace.personal')}</small>
            <span className="abha-badge"><ShieldCheck size={12} /><span className="abha-copy"><strong>{abhaParts[0]?.trim() || 'ABHA ID'}</strong><span>{abhaParts.slice(1).join(':').trim() || '91-8273-4920-1124'}</span></span></span>
          </div>
          <input ref={avatarInputRef} className="sr-only" type="file" accept="image/*" aria-label="Choose profile picture" onChange={(event) => {
            const file = event.currentTarget.files?.[0]
            if (file?.type.startsWith('image/') && file.size <= 5 * 1024 * 1024) {
              const reader = new FileReader()
              reader.onload = () => { if (typeof reader.result === 'string') onProfileImageChange(reader.result) }
              reader.readAsDataURL(file)
            }
            event.currentTarget.value = ''
          }} />
          <ChevronDown size={15} />
        </div>
        <p className="nav-label">WORKSPACE</p>
        <nav className="nav-list">
          {navItems.map(({ key, label, icon: Icon }) => (
            <button
              key={label}
              className={`nav-item ${active === label ? 'nav-active' : ''}`}
              onClick={() => { onSelect(label); onClose() }}
              aria-current={active === label ? 'page' : undefined}
            >
              <Icon size={17} strokeWidth={1.7} />
              <span>{t(key)}</span>
              {label === 'Emergency Triage' && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-spacer" />
        <div className="privacy-note">
          <ShieldCheck size={15} />
          <span>{t('workspace.privacy')}</span>
        </div>
        <button
          className={`nav-item settings-link ${active === 'Settings' ? 'nav-active' : ''}`}
          onClick={() => { onSelect('Settings'); onClose() }}
        >
          <Settings size={17} />
          <span>{t('nav.settings')}</span>
        </button>
        <div className="sidebar-footer">
          <div className="avatar-small">AM</div>
          <div><strong>Alex Morgan</strong><span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}><span className="radar-pulse" /> {t('workspace.verified')}</span></div>
          <MoreHorizontal size={17} />
        </div>
      </aside>
    </>
  )
}

function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string
  title: React.ReactNode
  description: string
  action?: React.ReactNode
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action && <div className="heading-action">{action}</div>}
    </div>
  )
}

function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`panel ${className}`}>{children}</section>
}

function PanelHeading({
  title,
  detail,
  action,
}: {
  title: string
  detail?: string
  action?: React.ReactNode
}) {
  return (
    <div className="panel-heading">
      <div>
        <h2>{title}</h2>
        {detail && <p>{detail}</p>}
      </div>
      {action}
    </div>
  )
}

export type TimelineEvent = {
  date: string
  title: string
  doctor: string
  summary: string
  meds: string
  dosages?: string
  normalValues?: string
  abnormalAlerts?: { name: string; value: string; unit: string; explanation?: string }[]
  diagnoses?: string[]
  documentUrl?: string
  isAiExtracted?: boolean
}

const timelineEvents: TimelineEvent[] = [
  {
    date: 'APR 12, 2025',
    title: 'Complete Metabolic Panel',
    doctor: 'Apollo Diagnostics · Lab Test',
    summary: 'Your kidney markers, liver enzymes, and overall electrolytes look healthy. Fasting glucose is slightly elevated at 108 mg/dL.',
    meds: 'None prescribed',
    normalValues: 'Creatinine (0.9 mg/dL), BUN (14 mg/dL), Sodium (140 mEq/L)',
    abnormalAlerts: [{ name: 'Fasting Glucose', value: '108', unit: 'mg/dL', explanation: 'Mildly elevated (Prediabetes threshold)' }],
    diagnoses: ['Impaired Fasting Glucose'],
  },
  {
    date: 'APR 05, 2025',
    title: 'General Wellness Consultation',
    doctor: 'Dr. Sarah Khan · General Physician',
    summary: 'Routine follow-up for blood pressure and lipid management. Vitals stable; continued current regimen with lifestyle adjustments.',
    meds: 'Metformin 500 mg, Atorvastatin 20 mg',
    dosages: 'Metformin: Twice daily with meals · Atorvastatin: Once daily at bedtime',
    normalValues: 'Blood Pressure (118/78 mmHg), Resting Heart Rate (68 bpm)',
    abnormalAlerts: [],
    diagnoses: ['Essential Hypertension (Controlled)', 'Hyperlipidemia'],
  },
  {
    date: 'MAR 18, 2025',
    title: 'Chest Radiograph (PA View)',
    doctor: 'Sunshine Hospital · Radiology',
    summary: 'Lungs are clear with no signs of infection, fluid, or cardiac enlargement. Normal thoracic anatomy.',
    meds: 'None prescribed',
    normalValues: 'Cardiothoracic ratio normal, Costophrenic angles clear',
    abnormalAlerts: [],
    diagnoses: ['Normal Radiographic Study'],
  },
]

function TimelineCard({ event, index, t }: { event: TimelineEvent; index: number; t: (key: string) => string }) {
  const isFirst = index === 0
  const hasAbnormals = event.abnormalAlerts && event.abnormalAlerts.length > 0

  return (
    <article className="timeline-entry" aria-labelledby={`event-title-${index}`}>
      <div className="timeline-spine">
        <span
          className="timeline-bullet"
          style={hasAbnormals ? { borderColor: '#fb8a9d', background: 'rgba(251, 138, 157, 0.2)' } : undefined}
        >
          {hasAbnormals ? <AlertCircle size={10} color="#fb8a9d" /> : <i />}
        </span>
        <div className="timeline-tail" />
      </div>

      <div className="timeline-body">
        <div className="timeline-meta" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <time
            dateTime={event.date}
            style={{
              padding: '2px 8px',
              borderRadius: '6px',
              background: 'rgba(255, 255, 255, 0.07)',
              color: '#9db1bd',
              fontSize: '9px',
              fontWeight: 650,
              letterSpacing: '0.4px',
            }}
          >
            {event.date}
          </time>
          <span className="timeline-dot" />
          <span style={{ color: '#c4d7e2', fontSize: '10px', fontWeight: 550 }}>{event.doctor}</span>
          <span
            style={{
              marginLeft: 'auto',
              fontSize: '8px',
              padding: '2px 8px',
              borderRadius: '6px',
              background: 'rgba(0, 210, 106, 0.12)',
              color: '#00e887',
              border: '1px solid rgba(0, 210, 106, 0.3)',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <span className="radar-pulse" />
            {t('timeline.verifiedDoc')}
          </span>
        </div>

        <h3 id={`event-title-${index}`} style={{ margin: '8px 0 6px', fontSize: '15px', color: '#f1f8fc', fontWeight: 650 }}>
          {event.title}
        </h3>

        <div className="summary-bubble">
          <span className="summary-bubble-label">
            <Sparkles size={11} /> {t('timeline.summary')}
          </span>
          <p style={{ margin: 0, fontSize: '11px', lineHeight: 1.6, color: '#cde0eb' }}>{event.summary}</p>
        </div>

        {hasAbnormals && (
          <div
            style={{
              marginTop: '10px',
              padding: '10px 14px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.14), rgba(239, 68, 68, 0.05))',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ff6b81', fontSize: '9px', fontWeight: 700, letterSpacing: '0.4px' }}>
              <AlertTriangle size={13} />
              <span>{t('timeline.abnormalAlert')}</span>
            </div>
            {event.abnormalAlerts!.map((alert, i) => (
              <div key={i} style={{ fontSize: '10px', color: '#ffd6dc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span><strong>{alert.name}:</strong> <span style={{ color: '#ff8a9e', fontWeight: 600 }}>{alert.value} {alert.unit}</span></span>
                {alert.explanation && <span style={{ color: '#ffadb9', fontStyle: 'italic', fontSize: '9px' }}>({alert.explanation})</span>}
              </div>
            ))}
          </div>
        )}

        {/* Separated Medication Pill Chips */}
        {event.meds && event.meds !== 'None prescribed' && event.meds !== 'None listed' && (
          <div style={{ marginTop: '10px' }}>
            <span style={{ fontSize: '8px', color: '#7e95a2', fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase', display: 'block', marginBottom: '5px' }}>
              {t('timeline.medicines')}
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {event.meds.split(',').map((medItem, mIdx) => {
                const trimmed = medItem.trim().replace(/\s+(\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|IU))$/i, ' · $1')
                if (!trimmed) return null
                return (
                  <span
                    key={mIdx}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '3px 9px',
                      borderRadius: '6px',
                      background: 'rgba(0, 210, 106, 0.1)',
                      border: '1px solid rgba(0, 210, 106, 0.28)',
                      color: '#d4fce8',
                      fontSize: '10px',
                      fontWeight: 500,
                    }}
                  >
                    <Pill size={11} color="#00e887" />
                    {trimmed}
                  </span>
                )
              })}
            </div>
          </div>
        )}

        <div className="timeline-chips" style={{ marginTop: '10px' }}>
          {event.diagnoses && event.diagnoses.length > 0 && (
            <div className="chip">
              <span className="chip-label">Diagnoses</span>
              <span className="chip-value" style={{ color: '#56b8ff' }}>{event.diagnoses.join(', ')}</span>
            </div>
          )}
          {event.dosages && event.dosages !== '—' && (
            <div className="chip">
              <span className="chip-label">Dosages</span>
              <span className="chip-value">{event.dosages}</span>
            </div>
          )}
          {event.normalValues && (
            <div className="chip">
              <span className="chip-label">Normal values</span>
              <span className="chip-value">{event.normalValues}</span>
            </div>
          )}
        </div>

        {event.documentUrl && (
          <div style={{ marginTop: '10px' }}>
            <a
              href={event.documentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="subtle-link"
              style={{ fontSize: '9px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            >
              <FileHeart size={12} /> View original document <ArrowUpRight size={11} />
            </a>
          </div>
        )}
      </div>
    </article>
  )
}

function SmartUploadZone({
  notify,
  onRecordUploaded,
  className = '',
  t = (k: string) => k,
  language = 'en',
}: {
  notify: (message: string) => void
  onRecordUploaded?: () => void
  className?: string
  t?: (k: string) => string
  language?: Language
}) {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<string>('')
  const [dragOver, setDragOver] = useState(false)
  const [lastUploaded, setLastUploaded] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const processFile = async (file: File) => {
    if (!/\.(pdf|jpe?g|png)$/i.test(file.name)) {
      notify('Choose PDF, JPEG, or PNG records up to 4 MB each.')
      return
    }
    if (file.size > 4 * 1024 * 1024) {
      notify('File is larger than the 4 MB limit.')
      return
    }

    setIsUploading(true)
    setUploadStatus('Uploading to Supabase & analyzing with Gemini AI...')
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('mockAbhaId', '91-8273-4920-1124')
      formData.append('language', language)

      const res = await fetch('/api/process-record', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to process document.')
      }

      setLastUploaded(file.name)
      notify(data.extractionStatus === 'needs_manual_review'
        ? `${file.name} was saved to your timeline for manual review; no medical findings were guessed.`
        : `Successfully extracted ${file.name} and saved to your health timeline!`)
      if (onRecordUploaded) {
        onRecordUploaded()
      }
    } catch (err: any) {
      console.error('Upload error:', err)
      notify(err.message || 'Error processing record. Please try again.')
    } finally {
      setIsUploading(false)
      setUploadStatus('')
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return
    processFile(files[0])
  }

  return (
    <section className={`upload-panel ${className}`} aria-labelledby="upload-heading">
      <div className="upload-heading-row">
        <div>
          <span className="upload-kicker"><ShieldCheck size={13} /> PRIVATE BY DESIGN</span>
          <h2 id="upload-heading">Smart upload</h2>
          <p>Bring your health records together.</p>
        </div>
        <span className="upload-step">01 <span>/ 02</span></span>
      </div>

      {isUploading ? (
        <div
          className="upload-dropzone"
          style={{
            borderColor: '#00d26a',
            background: 'rgba(0, 210, 106, 0.08)',
            cursor: 'wait',
            minHeight: '182px',
          }}
          aria-live="polite"
        >
          <div className="upload-icon" style={{ borderColor: 'rgba(0, 210, 106, 0.4)', background: 'rgba(0, 210, 106, 0.15)', color: '#00d26a' }}>
            <Loader2 size={24} className="animate-spin" />
          </div>
          <strong style={{ color: '#00e887', fontSize: '12px' }}>Analyzing Medical Record</strong>
          <span style={{ color: '#c0ced8', fontSize: '9px', maxWidth: '240px', lineHeight: 1.5 }}>
            {uploadStatus}
          </span>
          <div style={{ width: '80%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden', marginTop: '6px' }}>
            <div style={{ width: '100%', height: '100%', background: 'linear-gradient(90deg, #00d26a, #22d3ee)', animation: 'pulse 1.5s infinite ease-in-out' }} />
          </div>
          <span style={{ color: '#8fa2ae', fontSize: '8px' }}>Gemini 1.5 Flash · Supabase Storage</span>
        </div>
      ) : (
        <label
          className="upload-dropzone"
          htmlFor="medical-record-upload"
          style={dragOver ? { borderColor: '#22d3ee', background: 'rgba(34, 211, 238, 0.12)', transform: 'translateY(-1px)' } : undefined}
          onDragOver={(event) => { event.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(event) => {
            event.preventDefault()
            setDragOver(false)
            handleFiles(event.dataTransfer.files)
          }}
        >
          <input
            ref={inputRef}
            id="medical-record-upload"
            className="sr-only"
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
            onChange={(event) => handleFiles(event.currentTarget.files)}
          />
          <span className="upload-icon"><CloudUpload size={25} /></span>
          <strong>{t('upload.title')}</strong>
          <span className="upload-browse">or <span>{t('upload.browse')}</span></span>
          <span className="upload-formats"><FileText size={12} /> PDF, JPEG, PNG <i /> Up to 4 MB each</span>
        </label>
      )}

      <p className="upload-description">{t('upload.desc')}</p>

      {lastUploaded && (
        <div className="upload-selection" aria-live="polite" style={{ marginTop: '10px' }}>
          <span>Recent upload: {lastUploaded}</span>
          <button type="button" onClick={() => setLastUploaded(null)}>Clear</button>
          <p style={{ color: '#00e887', marginTop: '4px' }}>
            ✓ Extracted &amp; saved to Supabase health_timeline
          </p>
        </div>
      )}

      <button className="upload-records-link" onClick={() => notify('Your health records are synced to Supabase.')}>
        <FileHeart size={15} /> View existing records <ArrowRight size={13} />
      </button>
    </section>
  )
}

function HealthScoreGauge({ score = 84, statusText = 'Good' }: { score?: number; statusText?: string }) {
  const [dashOffset, setDashOffset] = useState(263.89)

  useEffect(() => {
    const targetOffset = 263.89 * (1 - score / 100)
    const timer = setTimeout(() => {
      setDashOffset(targetOffset)
    }, 150)
    return () => clearTimeout(timer)
  }, [score])

  return (
    <div className="score-gauge" role="img" aria-label={`Health score: ${score}% (${statusText})`} style={{ width: 104, height: 104, position: 'relative' }}>
      <svg viewBox="0 0 100 100">
        <circle className="gauge-track stroke-slate-200 dark:stroke-slate-800/80" cx="50" cy="50" r="42" />
        <circle
          className="gauge-value stroke-emerald-400 text-emerald-400 dark:stroke-emerald-400 dark:drop-shadow-[0_0_10px_rgba(16,185,129,0.55)]"
          cx="50"
          cy="50"
          r="42"
          strokeDasharray="263.89"
          strokeDashoffset={dashOffset}
        />
      </svg>
      <div className="gauge-text">
        <strong className="dark:text-white dark:font-bold">{score}</strong>
        <span className="dark:text-white dark:font-bold">{statusText}</span>
      </div>
    </div>
  )
}

function Overview({
  onSelect,
  notify,
  profileImage,
  records,
  isLoading,
  onRefresh,
  onExport,
  onExportFhir,
  scaleSynced = false,
  language,
  t,
}: {
  onSelect: (page: Section) => void
  notify: (message: string) => void
  profileImage: string | null
  records: any[]
  isLoading: boolean
  onRefresh: () => void
  onExport: () => void
  onExportFhir: () => void
  scaleSynced?: boolean
  language: Language
  t: (k: string) => string
}) {
  const weeklyActivity = [
    { day: 'Mon', steps: '5,240', value: 48 },
    { day: 'Tue', steps: '6,810', value: 64 },
    { day: 'Wed', steps: '7,120', value: 68 },
    { day: 'Thu', steps: '8,420', value: 82 },
    { day: 'Fri', steps: '6,430', value: 60 },
    { day: 'Sat', steps: '9,180', value: 92 },
    { day: 'Sun', steps: '7,460', value: 72 },
  ]
  const [selectedTrendDay, setSelectedTrendDay] = useState((new Date().getDay() + 6) % 7)
  const dbTimelineItems: TimelineEvent[] = records.map((record) => {
    const fhir = record.fhir_data || {}
    const medicines = Array.isArray(fhir.medicines)
      ? fhir.medicines.map((m: any) => (typeof m === 'string' ? m : m.name)).filter(Boolean).join(', ')
      : 'None listed'
    const dosages = Array.isArray(fhir.medicines)
      ? fhir.medicines.map((m: any) => (typeof m === 'object' && m.dosage ? `${m.name}: ${m.dosage}` : '')).filter(Boolean).join(' · ')
      : '—'
    const normalValues = Array.isArray(fhir.test_values)
      ? fhir.test_values.filter((t: any) => !t.abnormal_flag).map((t: any) => `${t.name} (${t.value} ${t.unit || ''})`).join(', ')
      : ''
    const abnormalAlerts = Array.isArray(fhir.test_values)
      ? fhir.test_values.filter((t: any) => t.abnormal_flag).map((t: any) => ({
          name: t.name || 'Test',
          value: String(t.value || ''),
          unit: t.unit || '',
          explanation: t.explanation || 'Abnormal marker',
        }))
      : []
    const diagnoses = Array.isArray(fhir.diagnoses) ? fhir.diagnoses : []

    const formattedDate = record.created_at
      ? new Date(record.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()
      : 'RECENT'

    return {
      date: formattedDate,
      title: fhir.title || record.document_type || 'Uploaded Medical Record',
      doctor: `Verified Document · ABHA ${record.mock_abha_id || '91-8273-4920-1124'}`,
      summary: record.ai_summary_english || fhir.plain_english_summary || 'Clinical details extracted and categorized.',
      meds: medicines || 'None listed',
      dosages: dosages || '—',
      normalValues: normalValues || undefined,
      abnormalAlerts: abnormalAlerts.length > 0 ? abnormalAlerts : undefined,
      diagnoses: diagnoses.length > 0 ? diagnoses : undefined,
      documentUrl: record.document_url,
      isAiExtracted: true,
    }
  })

  const displayEvents = dbTimelineItems.length > 0 ? dbTimelineItems : timelineEvents

  return (
    <>
      <PageHeading
        eyebrow={t('overview.eyebrow')}
        title={<AnimatedGreeting profileImage={profileImage} t={t} />}
        description={t('overview.desc')}
        action={
          <div className="overview-actions">
            <button className="secondary-button" onClick={onExport}>
              <Download size={14} /> {t('action.downloadSummary')}
            </button>
            <button className="secondary-button" onClick={onExportFhir}>
              <Download size={14} /> {t('action.downloadFhir')}
            </button>
            <button className="primary-button" onClick={() => onSelect('Copilot Chat')}>
              <Sparkles size={14} /> {t('action.askPulseAI')}
            </button>
          </div>
        }
      />

      <div className="overview-grid">
        <Panel className="score-panel">
          <PanelHeading title={t('score.title')} detail={t('score.detail')} />
          <div className="score-content">
            <HealthScoreGauge score={84} statusText={t('score.status')} />
            <div className="score-legend">
              <div><span className="dot-mint" /><span className="score-legend-label">{t('score.routine')}</span><strong>92%</strong></div>
              <div><span className="dot-blue" /><span className="score-legend-label">{t('score.vitals')}</span><strong>88%</strong></div>
              <div><span className="dot-violet" /><span className="score-legend-label">{t('score.screenings')}</span><strong>78%</strong></div>
            </div>
          </div>
        </Panel>

        <Panel className="vitals-panel">
          <PanelHeading
            title={t('vitals.title')}
            detail={t('vitals.detail')}
            action={<button className="subtle-link" onClick={() => onSelect('Device Sync')}>{t('vitals.viewDevices')} <ArrowRight size={13} /></button>}
          />
          <div className="vitals-grid">
            <Vital icon={Heart} label={t('vitals.hr')} value="68" unit="bpm" change={t('vitals.resting')} color="vital-mint" />
            <Vital icon={Activity} label={t('vitals.bp')} value="120/80" unit="mmHg" change={t('vitals.optimal')} color="vital-blue" />
            <Vital icon={Thermometer} label={t('vitals.glucose')} value="92" unit="mg/dL" change={t('vitals.fastingNormal')} color="vital-violet" />
            <Vital icon={Watch} label={t('vitals.activity')} value="8,420" unit="steps" change={t('vitals.goal10k')} color="vital-amber" />
            {scaleSynced && (
              <Vital icon={Activity} label={t('vitals.weight')} value="72.4" unit="kg" change="BMI 22.8 · Normal" color="vital-mint" />
            )}
          </div>
        </Panel>

        <Panel className="med-summary-panel">
          <PanelHeading
            title={t('meds.title')}
            detail={t('meds.logged')}
            action={<button className="subtle-link" onClick={() => onSelect('Medications')}>{t('meds.schedule')} <ArrowRight size={13} /></button>}
          />
          <div className="med-summary-list">
            <div className="med-item"><div className="med-pill-icon mint"><Pill size={15} /></div><div className="med-text"><strong>Metformin</strong><span>500 mg · 8:00 AM</span></div><span className="status-badge status-done"><Check size={12} /> {t('meds.taken')}</span></div>
            <div className="med-item"><div className="med-pill-icon blue"><Pill size={15} /></div><div className="med-text"><strong>Omega-3</strong><span>1000 mg · Breakfast</span></div><span className="status-badge status-done"><Check size={12} /> {t('meds.taken')}</span></div>
            <div className="med-item"><div className="med-pill-icon violet"><Pill size={15} /></div><div className="med-text"><strong>Atorvastatin</strong><span>20 mg · 9:00 PM</span></div><span className="status-badge status-due">{t('meds.upcoming')}</span></div>
          </div>
        </Panel>

        <Panel className="insights-panel">
          <PanelHeading title={t('insights.title')} detail={t('insights.detail')} />
          <div className="insights-list">
            <Insight icon={Sparkles} text="Your resting heart rate has been steady over the past 14 days." />
            <Insight icon={AlertCircle} text="Fasting blood sugar is in the normal range. Keep up the post-meal walks." />
            <Insight icon={Clock3} text="Time to schedule your follow-up with Dr. Sarah Khan next month." />
          </div>
        </Panel>

        <Panel className="trends-panel">
          <PanelHeading
            title={t('trends.title')}
            detail={t('trends.detail')}
            action={<span className="trend-badge"><ArrowUpRight size={13} /> +6% this week</span>}
          />
          <div className="trend-chart-summary"><span>{weeklyActivity[selectedTrendDay].day} activity</span><strong>{weeklyActivity[selectedTrendDay].steps}<small> steps</small></strong></div>
          <div className="mini-chart" role="group" aria-label="Weekly activity by day">
            {weeklyActivity.map((item, i) => (
              <button className={`chart-bar-wrap ${selectedTrendDay === i ? 'chart-day-selected' : ''}`} key={item.day} type="button" aria-pressed={selectedTrendDay === i} aria-label={`${item.day}: ${item.steps} steps`} onClick={() => setSelectedTrendDay(i)}>
                <span className="chart-bar-value">{item.value}%</span>
                <span className="chart-bar-track"><span className="chart-bar" style={{ height: `${item.value}%` }} /></span>
                <span className="chart-day-label">{item.day}</span>
              </button>
            ))}
          </div>
          <div className="chart-caption"><span><i /> Steps</span><span>Daily movement</span></div>
        </Panel>
        <SmartUploadZone className="overview-upload-panel" notify={notify} onRecordUploaded={onRefresh} t={t} language={language} />
      </div>

      <div className="timeline-upload-grid">
        <Panel className="timeline-panel">
          <PanelHeading
            title={t('timeline.title')}
            detail={dbTimelineItems.length > 0 ? `Showing ${dbTimelineItems.length} records extracted with Gemini & stored in Supabase` : t('timeline.detail')}
            action={
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  className="icon-button"
                  title={t('timeline.refresh')}
                  onClick={onRefresh}
                  disabled={isLoading}
                >
                  <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
                </button>
                <button className="subtle-link" onClick={() => onSelect('Health Records')}>
                  {t('records.viewAll')} <ArrowRight size={13} />
                </button>
              </div>
            }
          />

          <div className="timeline-stream">
            {isLoading ? (
              <div style={{ padding: '30px', textAlign: 'center', color: '#8fa2ae' }}>
                <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 8px' }} />
                <span>Syncing health timeline from Supabase...</span>
              </div>
            ) : (
              displayEvents.map((event, index) => (
                <TimelineCard key={`${event.date}-${index}`} event={event} index={index} t={t} />
              ))
            )}
          </div>

          <div className="timeline-footer">
            <ShieldCheck size={13} />
            <span>
              {dbTimelineItems.length > 0
                ? 'Secured with Supabase and Gemini AI. Always refer to original clinical documents.'
                : 'Example records for preview. Upload a document to add to your Supabase timeline.'}
            </span>
            <button className="subtle-link" onClick={() => onSelect('Health Records')}>
              All records <ArrowRight size={13} />
            </button>
          </div>
        </Panel>
      </div>
    </>
  )
}

function Vital({ icon: Icon, label, value, unit, change, color }: { icon: LucideIcon; label: string; value: string; unit: string; change: string; color: string }) {
  return <div className="vital"><div className={`vital-icon ${color}`}><Icon size={16} /></div><span className="vital-label">{label}</span><div className="vital-number">{value}<small>{unit}</small></div><span className="vital-change"><Check size={11} /> {change}</span></div>
}

function Insight({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return <div className="insight-row"><div className="insight-check"><Icon size={15} /></div><span>{text}</span><ChevronRight size={14} /></div>
}

type RecordItem = {
  title: string
  detail: string
  category: string
  icon: LucideIcon
  color: string
  url?: string
}

function RecordsPage({
  notify,
  dbRecords = [],
  t = (k: string) => k,
}: {
  notify: (message: string) => void
  dbRecords?: any[]
  t?: (k: string) => string
}) {
  const [filter, setFilter] = useState('All records')
  const [query, setQuery] = useState('')
  const filters = ['All records', 'Lab Results', 'Documents']
  const mappedDb: RecordItem[] = dbRecords.map((r) => {
    const isRx = r.document_type?.toLowerCase().includes('prescrip')
    return {
      title: r.fhir_data?.title || r.document_type || 'Uploaded Medical Record',
      detail: `${new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · Supabase Record`,
      category: isRx ? 'Documents' : 'Lab Results',
      icon: isRx ? Pill : Activity,
      color: 'mint',
      url: r.document_url,
    }
  })
  const allRecords: RecordItem[] = [...mappedDb, ...records]
  const shown = allRecords.filter((record) => (filter === 'All records' || record.category === filter || (record.title === 'Medical Summary' && filter === 'All records')) && record.title.toLowerCase().includes(query.toLowerCase()))
  return <>
    <PageHeading
      eyebrow={t('records.eyebrow')}
      title={t('records.title')}
      description={t('records.desc')}
      action={
        <button className="primary-button" onClick={() => notify('Drag & drop your files in Overview to analyze and add them.')}>
          <Upload size={15} /> {t('records.upload')}
        </button>
      }
    />
    <div className="stats-row"><Stat label="Total records" value={String(allRecords.length)} hint="Across 4 categories" icon={FileHeart} /><Stat label="Latest lab results" value="Apr 12" hint="Blood test report" icon={Activity} /><Stat label="Next check-in" value="May 16" hint="Annual wellness" icon={CalendarDays} /></div>
    <div className="records-layout"><Panel><PanelHeading title="Your records" detail="Recently added and updated" /><div className="records-toolbar"><div className="filter-tabs">{filters.map((item) => <button key={item} className={filter === item ? 'filter-active' : ''} onClick={() => setFilter(item)}>{item}</button>)}</div><label className="search-box"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search records" aria-label="Search records" /></label></div><div className="record-list">{shown.map(({ title, detail, icon: Icon, color, url }) => <div className="record-row" key={title}><div className={`record-icon ${color}`}><Icon size={18} /></div><div className="record-info"><strong>{title}</strong><span>{detail}</span></div><span className="record-category">{title === 'Medical Summary' ? 'Summary' : title.toLowerCase().includes('blood') || title.toLowerCase().includes('lab') ? 'Lab result' : title.toLowerCase().includes('prescrip') ? 'Prescription' : 'Document'}</span>{url ? <a href={url} target="_blank" rel="noopener noreferrer" className="outline-button" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>View <ArrowRight size={13} /></a> : <button className="outline-button" onClick={() => notify(`${title} opened in your record viewer.`)}>View <ArrowRight size={13} /></button>}</div>)}</div></Panel>
      <Panel><PanelHeading title="Lab trends" detail="Your readings over time" action={<button className="icon-button" aria-label="More trend options"><MoreHorizontal size={17} /></button>} /><HealthChart /><div className="chart-legend"><span><i className="legend-mint" /> Hemoglobin</span><span><i className="legend-blue" /> Glucose</span><span><i className="legend-violet" /> Vitamin D</span></div><div className="results-list"><div><span>Hemoglobin</span><strong>14.2 g/dL</strong><em>Normal</em></div><div><span>Glucose</span><strong>92 mg/dL</strong><em>Normal</em></div><div><span>Vitamin D</span><strong>32 ng/mL</strong><em>Normal</em></div></div></Panel></div>
  </>
}

function Stat({ label, value, hint, icon: Icon }: { label: string; value: string; hint: string; icon: LucideIcon }) {
  return <Panel className="stat-card"><div className="stat-top"><span>{label}</span><Icon size={16} /></div><strong>{value}</strong><small>{hint}</small></Panel>
}

function HealthChart() {
  return (
    <div style={{ height: '140px', display: 'flex', alignItems: 'flex-end', gap: '12px', padding: '16px 8px 8px' }}>
      {[
        { month: 'Jan', val1: 65, val2: 50, val3: 70 },
        { month: 'Feb', val1: 70, val2: 55, val3: 72 },
        { month: 'Mar', val1: 75, val2: 60, val3: 68 },
        { month: 'Apr', val1: 85, val2: 58, val3: 80 },
      ].map((item) => (
        <div key={item.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '100%', height: '100px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '4px' }}>
            <div style={{ width: '8px', height: `${item.val1}%`, background: '#00d26a', borderRadius: '4px' }} />
            <div style={{ width: '8px', height: `${item.val2}%`, background: '#56b8ff', borderRadius: '4px' }} />
            <div style={{ width: '8px', height: `${item.val3}%`, background: '#b3a1ff', borderRadius: '4px' }} />
          </div>
          <span style={{ fontSize: '9px', color: '#7b929e' }}>{item.month}</span>
        </div>
      ))}
    </div>
  )
}

function MedicationsPage({
  notify,
  meds,
  setMeds,
  t = (k: string) => k,
}: {
  notify: (message: string) => void
  meds: MedItem[]
  setMeds: React.Dispatch<React.SetStateAction<MedItem[]>>
  t?: (k: string) => string
}) {
  const [tab, setTab] = useState('My medications')
  const [showAddModal, setShowAddModal] = useState(false)
  const [medName, setMedName] = useState('')
  const [medDosage, setMedDosage] = useState('')
  const [medFrequency, setMedFrequency] = useState('Once daily')
  const [medTime, setMedTime] = useState('8:00 AM')

  const markTaken = (name: string) => {
    setMeds((current) =>
      current.map((med) => {
        if (med.name === name) {
          const newAdherence = med.loggedToday ? Math.max(med.adherence - 2, 70) : Math.min(med.adherence + 4, 100)
          return {
            ...med,
            adherence: newAdherence,
            loggedToday: !med.loggedToday,
          }
        }
        return med
      })
    )
    notify(`Dose logged for ${name}. Adherence updated!`)
  }

  const handleAddMedication = (e: FormEvent) => {
    e.preventDefault()
    if (!medName.trim() || !medDosage.trim()) {
      notify('Please enter medicine name and dosage.')
      return
    }

    const colors = ['mint', 'blue', 'violet', 'amber']
    const newMed: MedItem = {
      name: medName.trim(),
      dosage: `${medDosage.trim()} · ${medFrequency}`,
      frequency: medFrequency,
      time: medTime,
      adherence: 100,
      color: colors[meds.length % colors.length],
      loggedToday: false,
    }

    setMeds((prev) => [...prev, newMed])
    setShowAddModal(false)
    setMedName('')
    setMedDosage('')
    notify(`Added ${newMed.name} to your active medication routine!`)
  }

  const totalDoses = meds.length
  const takenCount = meds.filter((m) => m.loggedToday || m.adherence >= 90).length

  return (
    <>
      <PageHeading
        eyebrow={t('meds.eyebrow')}
        title={t('meds.title')}
        description={t('meds.desc')}
        action={
          <button className="primary-button" onClick={() => setShowAddModal(true)}>
            <Plus size={16} /> {t('meds.add')}
          </button>
        }
      />

      <div className="stats-row">
        <Stat label={t('meds.todayDoses')} value={`${takenCount} / ${totalDoses}`} hint={`${Math.max(0, totalDoses - takenCount)} dose(s) pending`} icon={Pill} />
        <Stat label={t('meds.adherenceMonth')} value="94%" hint="Up 3% from last month" icon={Activity} />
        <Stat label={t('meds.nextDose')} value="8:00 PM" hint="Metformin · 500 mg" icon={Clock3} />
      </div>

      <Panel>
        <div className="records-toolbar">
          <div className="filter-tabs">
            {['My medications', 'Schedule', 'History'].map((item) => (
              <button key={item} className={tab === item ? 'filter-active' : ''} onClick={() => setTab(item)}>
                {item}
              </button>
            ))}
          </div>
          <span className="muted-small"><span className="live-dot" /> Schedule synced today</span>
        </div>

        <div className="med-list">
          {meds.map((med) => (
            <div className="med-row" key={med.name}>
              <div className={`record-icon ${med.color}`}><Pill size={18} /></div>
              <div className="med-info">
                <strong>{med.name}</strong>
                <span>{med.dosage}</span>
                <small><Clock3 size={12} /> {med.time}</small>
              </div>
              <div className="adherence-block">
                <div className="adherence-ring" style={{ '--progress': `${med.adherence * 3.6}deg` } as React.CSSProperties}>
                  <span>{med.adherence}%</span>
                </div>
                <small>adherence</small>
              </div>
              <span className="status-pill" style={med.loggedToday ? { borderColor: '#00d26a', color: '#00e887' } : undefined}>
                <CheckCircle2 size={12} /> {med.loggedToday ? 'Dose Logged' : 'On track'}
              </span>
              <button
                className="outline-button"
                style={med.loggedToday ? { background: 'rgba(0, 210, 106, 0.15)', borderColor: '#00d26a' } : undefined}
                onClick={() => markTaken(med.name)}
              >
                <Check size={14} /> {med.loggedToday ? t('meds.undoDose') : t('meds.logDose')}
              </button>
            </div>
          ))}
        </div>
      </Panel>

      <div className="med-note">
        <ShieldCheck size={16} />
        <p>Medication information is for reference. Follow the directions provided by your prescribing clinician.</p>
        <button className="subtle-link" onClick={() => notify('Your care team contact details are in your profile.')}>
          Need help? <ArrowRight size={13} />
        </button>
      </div>

      {showAddModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 60,
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          role="dialog"
          aria-modal="true"
        >
          <div
            style={{
              width: '100%',
              maxWidth: '460px',
              background: '#0c202d',
              border: '1px solid rgba(0, 210, 106, 0.3)',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(0, 210, 106, 0.15)', display: 'grid', placeItems: 'center', color: '#00e887' }}>
                  <Pill size={18} />
                </div>
                <h2 style={{ margin: 0, fontSize: '16px', color: '#eff9ff' }}>Add New Medication</h2>
              </div>
              <button className="icon-button" onClick={() => setShowAddModal(false)}><X size={18} /></button>
            </div>

            <form onSubmit={handleAddMedication} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#8fa2ae', marginBottom: '6px' }}>Medicine Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Metformin or Amoxicillin"
                  value={medName}
                  onChange={(e) => setMedName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.15)',
                    background: 'rgba(255,255,255,0.05)',
                    color: '#fff',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#8fa2ae', marginBottom: '6px' }}>Dosage *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 500 mg or 10 ml"
                  value={medDosage}
                  onChange={(e) => setMedDosage(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.15)',
                    background: 'rgba(255,255,255,0.05)',
                    color: '#fff',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#8fa2ae', marginBottom: '6px' }}>Frequency</label>
                  <select
                    value={medFrequency}
                    onChange={(e) => setMedFrequency(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid rgba(255,255,255,0.15)',
                      background: '#071722',
                      color: '#fff',
                      fontSize: '13px',
                      boxSizing: 'border-box',
                    }}
                  >
                    <option value="Once daily">Once daily</option>
                    <option value="Twice daily">Twice daily</option>
                    <option value="Thrice daily">Thrice daily</option>
                    <option value="As needed">As needed</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#8fa2ae', marginBottom: '6px' }}>Scheduled Time</label>
                  <input
                    type="text"
                    placeholder="e.g. 8:00 AM"
                    value={medTime}
                    onChange={(e) => setMedTime(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid rgba(255,255,255,0.15)',
                      background: 'rgba(255,255,255,0.05)',
                      color: '#fff',
                      fontSize: '13px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" className="secondary-button" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="primary-button">
                  Save Medication
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

function ChatPage({ t = (k: string) => k, language = 'en' }: { t?: (k: string) => string; language?: Language }) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [draft, setDraft] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [fileBase64, setFileBase64] = useState<string | null>(null)
  const [thinking, setThinking] = useState(false)
  const [listening, setListening] = useState(false)
  const [voiceNotice, setVoiceNotice] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null)

  useLayoutEffect(() => {
    const messagesElement = messagesRef.current
    if (messagesElement) messagesElement.scrollTop = messagesElement.scrollHeight
  }, [messages, thinking])

  useEffect(() => () => recognitionRef.current?.stop(), [])

  const selectFiles = (selected: FileList | null) => {
    if (!selected?.length) return
    const valid = Array.from(selected).filter((file) => /\.(pdf|jpe?g|png)$/i.test(file.name) && file.size <= 3 * 1024 * 1024)
    setFiles((current) => [...current, ...valid])
    if (valid.length > 0) {
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setFileBase64(reader.result)
        }
      }
      reader.readAsDataURL(valid[0])
      setVoiceNotice(`Attached ${valid[0].name} for multimodal AI analysis.`)
    }
  }

  const toggleSpeech = () => {
    if (listening) {
      recognitionRef.current?.stop()
      return
    }
    const SpeechRecognition = (window as SpeechWindow).SpeechRecognition ?? (window as SpeechWindow).webkitSpeechRecognition
    if (!SpeechRecognition) {
      setVoiceNotice('Speech recognition is not available in this browser. Try Chrome or Edge.')
      return
    }
    const recognition = new SpeechRecognition()
    recognition.lang = 'en-US'
    recognition.continuous = false
    recognition.interimResults = false
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results).slice(event.resultIndex).filter((result) => result.isFinal).map((result) => result[0].transcript.trim()).filter(Boolean).join(' ')
      if (transcript) setDraft((current) => `${current}${current ? ' ' : ''}${transcript}`)
      setVoiceNotice(transcript ? 'Voice input captured and added to your query.' : '')
    }
    recognition.onerror = () => {
      setListening(false)
      setVoiceNotice('Microphone access was unavailable. Check your browser permissions and try again.')
    }
    recognition.onend = () => {
      setListening(false)
      recognitionRef.current = null
    }
    recognitionRef.current = recognition
    setVoiceNotice('Listening… Speak clearly now.')
    try {
      recognition.start()
      setListening(true)
    } catch {
      recognitionRef.current = null
      setListening(false)
      setVoiceNotice('Could not start speech recognition. Please try again.')
    }
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const text = draft.trim()
    if ((!text && files.length === 0) || thinking) return

    const attachedName = files.length > 0 ? files[0].name : undefined
    const attachmentNote = files.length ? `\n📎 [Attached Report: ${files.map((file) => file.name).join(', ')}]` : ''
    const userText = `${text || 'Please inspect the attached medical record and explain its findings.'}${attachmentNote}`

    setMessages((current) => [...current, { role: 'user', text: userText }])
    const currentFileBase64 = fileBase64
    setDraft('')
    setFiles([])
    setFileBase64(null)
    setVoiceNotice('')
    if (fileInputRef.current) fileInputRef.current.value = ''
    setThinking(true)

    try {
      const history = messages.map((m) => ({ role: m.role, text: m.text }))
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text || 'Please inspect and explain this medical record.',
          attachment: currentFileBase64,
          fileName: attachedName,
          history,
          language,
        }),
      })
      const data = await res.json()
      const reply: string = data.reply || data.text || getOfflineHealthReply(text, language, Boolean(currentFileBase64))
      setMessages((current) => [...current, { role: 'assistant', text: reply }])
    } catch {
      setMessages((current) => [
        ...current,
        { role: 'assistant', text: getOfflineHealthReply(text, language, Boolean(currentFileBase64)) },
      ])
    } finally {
      setThinking(false)
    }
  }

  const prompts = ['How can I improve my sleep?', 'Help me understand my latest results', 'What should I ask at my next visit?']

  return (
    <>
      <PageHeading eyebrow={t('chat.eyebrow')} title={t('chat.title')} description={t('chat.desc')} action={<span className="secure-chip"><ShieldCheck size={13} /> Private conversation</span>} />
      <Panel className="chat-panel">
        <div className="chat-topline">
          <div className="copilot-avatar"><Sparkles size={17} /></div>
          <div><strong>PulseAI Copilot</strong><span><i className="live-dot" /> Ready to help</span></div>
          <button className="icon-button" aria-label="More chat options"><MoreHorizontal size={18} /></button>
        </div>
        <div className="chat-messages" ref={messagesRef} aria-live="polite">
          {messages.map((message, index) => (
            <div className={`chat-message ${message.role === 'user' ? 'message-user' : ''}`} key={`${message.role}-${index}`}>
              {message.role === 'assistant' && <div className="message-avatar"><HeartPulse size={15} /></div>}
              <div className="message-content">
                <div className="message-bubble" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>
                  {message.text}
                </div>
                <span>{message.role === 'user' ? 'You' : 'PulseAI'} · {index === messages.length - 1 ? 'Just now' : 'Previous'}</span>
              </div>
            </div>
          ))}
          {thinking && (
            <div className="chat-message">
              <div className="message-avatar"><HeartPulse size={15} /></div>
              <div className="typing-indicator" aria-label="PulseAI is responding"><i /><i /><i /></div>
            </div>
          )}
        </div>
        <div className="suggestion-row">
          {prompts.map((prompt) => <button key={prompt} onClick={() => setDraft(prompt)}>{prompt}</button>)}
        </div>
        <div className="chat-disclaimer">
          <ShieldCheck size={13} /> Your conversations are private. PulseAI is not a substitute for professional medical advice.
        </div>
      </Panel>
      <div className="chat-composer-dock">
        <div className="chat-dock-heading">
          <span className="chat-dock-brand"><span className="chat-dock-icon"><Sparkles size={13} /></span>Ask PulseAI</span>
          <span className="chat-dock-status">Multimodal Gemini Copilot · Vision &amp; Clinical OCR</span>
        </div>
        {files.length > 0 && (
          <div className="chat-attachments" aria-label="Selected files">
            {files.map((file, index) => (
              <span className="chat-attachment" key={`${file.name}-${index}`}>
                <FileText size={13} />
                <span>{file.name}</span>
                <button type="button" aria-label={`Remove ${file.name}`} onClick={() => { setFiles([]); setFileBase64(null) }}><X size={12} /></button>
              </span>
            ))}
          </div>
        )}
        <form className="chat-composer" onSubmit={submit}>
          <input ref={fileInputRef} className="sr-only" type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,application/pdf,image/jpeg,image/png" aria-label="Choose files to attach" onChange={(event) => { selectFiles(event.currentTarget.files); event.currentTarget.value = '' }} />
          <button type="button" className="composer-action attach-action" aria-label="Attach files" title="Attach files" onClick={() => fileInputRef.current?.click()}>
            <Paperclip size={17} /><span>{t('chat.attach')}</span>
          </button>
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter' && (event.nativeEvent.isComposing || event.keyCode === 229)) event.preventDefault() }}
            placeholder={t('chat.placeholder')}
            aria-label="Message PulseAI"
          />
          <button
            type="button"
            className={`composer-action microphone-action ${listening ? 'is-listening' : ''}`}
            aria-label={listening ? 'Stop speech recognition' : 'Start speech recognition'}
            title={listening ? 'Stop listening' : 'Speak your message'}
            aria-pressed={listening}
            style={listening ? { color: '#00e887', background: 'rgba(0, 210, 106, 0.2)' } : undefined}
            onClick={toggleSpeech}
          >
            {listening ? <AudioLines size={18} className="animate-pulse" /> : <Mic size={17} />}
            <span>{listening ? t('chat.listening') : t('chat.speak')}</span>
          </button>
          <button className="send-button" type="submit" aria-label={t('chat.send')} disabled={(!draft.trim() && files.length === 0) || thinking}>
            <Send size={16} />
          </button>
        </form>
        {voiceNotice && (
          <div className="chat-composer-notice" role="status">
            {voiceNotice}
            <button type="button" aria-label="Dismiss message" onClick={() => setVoiceNotice('')}><X size={12} /></button>
          </div>
        )}
      </div>
    </>
  )
}

function TriagePage({ notify, t = (k: string) => k }: { notify: (message: string) => void; t?: (k: string) => string }) {
  const [symptoms, setSymptoms] = useState<string[]>([])
  const [showAssessment, setShowAssessment] = useState(false)

  const symptomList = [
    { name: 'Chest pain or pressure', type: 'critical' },
    { name: 'Difficulty breathing', type: 'critical' },
    { name: 'Sudden weakness or numbness', type: 'critical' },
    { name: 'Severe or unusual pain', type: 'moderate' },
    { name: 'Fever or chills', type: 'moderate' },
    { name: 'Headache', type: 'moderate' },
  ]

  const toggle = (item: string) => {
    setSymptoms((current) =>
      current.includes(item) ? current.filter((symptom) => symptom !== item) : [...current, item]
    )
    setShowAssessment(false)
  }

  const isCritical = symptoms.some((s) => ['Chest pain or pressure', 'Difficulty breathing', 'Sudden weakness or numbness'].includes(s))
  const isModerate = !isCritical && symptoms.some((s) => ['Severe or unusual pain', 'Fever or chills', 'Headache'].includes(s))
  const isMild = !isCritical && !isModerate

  const handleGetGuidance = () => {
    if (symptoms.length === 0) {
      notify('Please select at least one symptom to evaluate.')
      return
    }
    setShowAssessment(true)
    notify(isCritical ? 'CRITICAL ALERT: Emergency action recommended.' : 'Triage guidance generated.')
  }

  return (
    <>
      <PageHeading eyebrow={t('triage.eyebrow')} title={t('triage.title')} description={t('triage.desc')} action={<span className="secure-chip"><ShieldCheck size={13} /> Guidance, not diagnosis</span>} />

      {/* Top Banner */}
      <div
        className={`triage-alert ${isCritical ? 'triage-alert-urgent' : ''}`}
        style={
          isCritical
            ? { background: 'rgba(239, 68, 68, 0.15)', borderColor: '#ef4444' }
            : isModerate
            ? { background: 'rgba(245, 193, 91, 0.12)', borderColor: '#f5c15b' }
            : undefined
        }
      >
        <div className="alert-symbol" style={isCritical ? { color: '#ef4444' } : isModerate ? { color: '#f5c15b' } : undefined}>
          <AlertCircle size={22} />
        </div>
        <div>
          <strong>
            {isCritical
              ? '🚨 Red Alert: Seek Immediate Emergency Medical Care'
              : isModerate
              ? '⚠️ Amber Alert: Clinical Consultation Advised (Non-Emergency)'
              : '✅ Green Alert: Routine Symptom Monitoring'}
          </strong>
          <p>
            {isCritical
              ? 'These symptoms can indicate acute cardiac, pulmonary, or neurological distress. Call 112 / 108 or proceed to the nearest emergency room immediately.'
              : isModerate
              ? 'Moderate clinical acuity. We recommend booking an appointment with a general physician within 12–24 hours, hydrating, and resting.'
              : 'Symptoms appear mild. Rest, maintain hydration, and consult a doctor if discomfort persists past 48 hours.'}
          </p>
        </div>
        {isCritical ? (
          <a
            href="tel:112"
            className="primary-button"
            style={{ background: '#ef4444', color: '#fff', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <PhoneCall size={14} /> Call 112 / 108
          </a>
        ) : (
          <button className="outline-button" onClick={() => notify('Care advice: Keep hydrated and rest in a well-ventilated space.')}>
            What to do <ArrowRight size={13} />
          </button>
        )}
      </div>

      <div className="triage-layout">
        <Panel>
          <PanelHeading title="What are you experiencing?" detail="Select all that apply. This helps categorize clinical urgency." />
          <div className="symptom-grid">
            {symptomList.map(({ name, type }) => (
              <button
                key={name}
                className={`symptom-option ${symptoms.includes(name) ? 'symptom-selected' : ''}`}
                style={
                  symptoms.includes(name) && type === 'critical'
                    ? { borderColor: '#ef4444', background: 'rgba(239, 68, 68, 0.15)' }
                    : undefined
                }
                onClick={() => toggle(name)}
                aria-pressed={symptoms.includes(name)}
              >
                <span className="symptom-checkbox">{symptoms.includes(name) && <Check size={13} />}</span>
                {name}
                {type === 'critical' && <span style={{ marginLeft: 'auto', fontSize: '8px', color: '#ff6b81', fontWeight: 700 }}>URGENT</span>}
              </button>
            ))}
          </div>

          <button className="primary-button triage-submit" onClick={handleGetGuidance}>
            <Sparkles size={15} /> {t('triage.getGuidance')} <ArrowRight size={14} />
          </button>

          {showAssessment && (
            <div
              style={{
                marginTop: '16px',
                padding: '16px',
                borderRadius: '12px',
                border: isCritical ? '1px solid rgba(239,68,68,0.4)' : isModerate ? '1px solid rgba(245,193,91,0.4)' : '1px solid rgba(0,210,106,0.4)',
                background: isCritical ? 'rgba(239,68,68,0.08)' : isModerate ? 'rgba(245,193,91,0.08)' : 'rgba(0,210,106,0.08)',
              }}
            >
              <h3 style={{ margin: '0 0 8px', fontSize: '13px', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ShieldCheck size={16} color={isCritical ? '#ef4444' : isModerate ? '#f5c15b' : '#00e887'} />
                Clinical Triage Evaluation
              </h3>
              <p style={{ margin: '0 0 10px', fontSize: '11px', color: '#c4d5df', lineHeight: 1.5 }}>
                {isCritical
                  ? 'Selected indicators match emergency escalation protocols. Do not attempt to drive yourself. Keep calm, sit in a comfortable upright position, and call national helpline 112 or local ambulance 108.'
                  : isModerate
                  ? 'Symptoms indicate a moderate physiological response. Rest, check your vitals (temperature and blood pressure), and consult your doctor if pain or fever does not abate with rest.'
                  : 'No high-acuity red flags identified. Ensure proper hydration (2–3 liters daily) and rest. Reach out to your doctor if new symptoms emerge.'}
              </p>
              <div style={{ fontSize: '10px', color: '#8fa2ae' }}>
                <strong>Recommended helpline:</strong> Emergency 112 · Ambulance 108 · Tele-Health 104
              </div>
            </div>
          )}
        </Panel>

        <Panel className="triage-info">
          <div className="care-icon"><HeartPulse size={20} /></div>
          <h2>We’re here to help you find your next step.</h2>
          <p>PulseAI can help you organize symptoms and understand general health information. Only a healthcare professional can assess your situation.</p>
          <div className="care-detail"><ShieldCheck size={15} /><span>Your information is private and secure</span></div>
          <div className="care-detail"><Stethoscope size={15} /><span>For medical advice, contact your care team</span></div>
          <div className="care-detail"><PhoneCall size={15} /><span>National Emergency Helpline: 112 / 108</span></div>
        </Panel>
      </div>
    </>
  )
}

export interface DeviceState {
  name: string
  kind: string
  icon: LucideIcon
  color: string
  connected: boolean
  syncing: boolean
  synced: string
  metrics: Record<string, string>
}

function DevicesPage({
  notify,
  devices,
  setDevices,
  onConnectScale,
  isConnectingScale,
  t = (k: string) => k,
}: {
  notify: (message: string) => void
  devices: DeviceState[]
  setDevices: React.Dispatch<React.SetStateAction<DeviceState[]>>
  onConnectScale: () => Promise<void>
  isConnectingScale: boolean
  t?: (k: string) => string
}) {
  const toggleConnection = (index: number) => {
    const dev = devices[index]
    if (dev.name.includes('Smart Scale')) {
      if (!dev.connected) {
        onConnectScale()
        return
      }
    }
    setDevices((current) =>
      current.map((d, i) => {
        if (i === index) {
          const willConnect = !d.connected
          return {
            ...d,
            connected: willConnect,
            synced: willConnect ? 'All caught up · Just now' : 'Not connected',
          }
        }
        return d
      })
    )
    notify(`${dev.name} ${dev.connected ? 'disconnected' : 'connected and synced!'}`)
  }

  const triggerSync = (index: number) => {
    setDevices((current) =>
      current.map((dev, i) => (i === index ? { ...dev, syncing: true } : dev))
    )
    window.setTimeout(() => {
      setDevices((current) =>
        current.map((dev, i) =>
          i === index
            ? {
                ...dev,
                syncing: false,
                connected: true,
                synced: 'All caught up · Just now',
              }
            : dev
        )
      )
      notify(`Synced latest biometrics from ${devices[index].name}!`)
    }, 900)
  }

  const connectedCount = devices.filter((d) => d.connected).length

  return (
    <>
      <PageHeading
        eyebrow={t('devices.eyebrow')}
        title={t('devices.title')}
        description={t('devices.desc')}
        action={
          <button className="secondary-button" onClick={onConnectScale} disabled={isConnectingScale}>
            <Plus size={15} /> {isConnectingScale ? 'Scanning BLE...' : t('devices.connect')}
          </button>
        }
      />

      <div className="device-overview">
        <div>
          <span className="eyebrow">CONNECTED DEVICES</span>
          <strong>{connectedCount}<small> of {devices.length}</small></strong>
          <p>Your biometric health data syncs securely with ABHA profile.</p>
        </div>
        <div className="sync-indicator">
          <span className="sync-ring"><Zap size={20} /></span>
          <div>
            <strong>All caught up</strong>
            <small>Live continuous sync active</small>
          </div>
        </div>
      </div>

      <div className="section-title-row">
        <div>
          <h2>Your devices</h2>
          <p>Manage connected smart scales, wearables, and fitness apps.</p>
        </div>
        <button className="subtle-link" onClick={() => notify('Supported devices: Apple Watch, Pixel Watch, Garmin, Withings, Oura, Fitbit.')}>
          View supported devices <ArrowRight size={13} />
        </button>
      </div>

      <div className="device-grid">
        {devices.map((device, index) => (
          <Panel className="device-card" key={device.name}>
            <div className={`device-icon ${device.color}`}><device.icon size={20} /></div>
            <div className="device-status-line">
              <span className={device.connected ? 'connected-tag' : 'disconnected-tag'}>
                {device.connected ? <span className="radar-pulse" /> : <i />} {device.connected ? (device.name.includes('Smart Scale') ? 'Connected · Live Sync' : 'Connected') : 'Not connected'}
              </span>
              <button
                className="icon-button"
                aria-label={`Sync ${device.name}`}
                title="Sync device"
                onClick={() => triggerSync(index)}
              >
                {device.syncing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={15} />}
              </button>
            </div>

            <h3>{device.name}</h3>
            <p>{device.kind}</p>

            {device.connected && (
              <div style={{ margin: '8px 0', padding: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', display: 'flex', gap: '12px' }}>
                {Object.entries(device.metrics).map(([k, v]) => (
                  <div key={k} style={{ fontSize: '9px' }}>
                    <span style={{ color: '#79909f', display: 'block' }}>{k}</span>
                    <strong style={{ color: '#00e887' }}>{v}</strong>
                  </div>
                ))}
              </div>
            )}

            <div className="device-card-footer">
              <span>
                <Clock3 size={12} /> {device.syncing ? 'Syncing...' : device.synced}
              </span>
              <button
                className={device.connected ? 'text-action' : 'text-action text-action-mint'}
                onClick={() => toggleConnection(index)}
                disabled={device.name.includes('Smart Scale') && isConnectingScale}
              >
                {device.name.includes('Smart Scale') && isConnectingScale ? 'Scanning BLE...' : device.connected ? 'Disconnect' : 'Connect'} <ArrowRight size={12} />
              </button>
            </div>
          </Panel>
        ))}
      </div>

      <Panel className="device-privacy">
        <div className="privacy-icon"><ShieldCheck size={19} /></div>
        <div>
          <strong>Your health data belongs to you.</strong>
          <p>Choose which devices to connect. Data is encrypted in transit and mapped directly to your personal health timeline.</p>
        </div>
        <button className="subtle-link" onClick={() => notify('Device privacy rules are compliant with ABDM standards.')}>
          Privacy settings <ArrowRight size={13} />
        </button>
      </Panel>
    </>
  )
}

type DoctorItem = {
  name: string
  specialty: string
  rating: string
  visits: string
  availability: string
  initials: string
  color: string
}

function AppointmentsPage({ notify, t = (k: string) => k }: { notify: (message: string) => void; t?: (k: string) => string }) {
  const [specialty, setSpecialty] = useState('All specialties')
  const [searchQuery, setSearchQuery] = useState('')
  const [bookingDoctor, setBookingDoctor] = useState<DoctorItem | null>(null)
  const [bookingSlot, setBookingSlot] = useState('Tomorrow, 10:00 AM')
  const [consultType, setConsultType] = useState('In-Person Clinic Visit')
  const [bookingReason, setBookingReason] = useState('Routine Checkup & Lab Review')
  const [confirmedBookings, setConfirmedBookings] = useState<Record<string, { slot: string; type: string; reason: string }>>({
    'Dr. Sarah Khan': { slot: 'May 16 · 10:30 AM', type: 'In-Person Clinic Visit', reason: 'Annual wellness follow-up' },
  })

  const doctors: DoctorItem[] = [
    { name: 'Dr. Sarah Khan', specialty: 'General Physician', rating: '4.9', visits: '218 visits', availability: 'Today, 2:30 PM', initials: 'SK', color: 'portrait-coral' },
    { name: 'Dr. Rahul Mehta', specialty: 'Cardiologist', rating: '4.8', visits: '164 visits', availability: 'Tomorrow, 10:00 AM', initials: 'RM', color: 'portrait-blue' },
    { name: 'Dr. Priya Nair', specialty: 'Dermatologist', rating: '4.9', visits: '192 visits', availability: 'Available in 2 days', initials: 'PN', color: 'portrait-violet' },
  ]
  const specialties = ['All specialties', 'General Physician', 'Cardiologist', 'Dermatologist']
  const availableSlots = [
    'Today, 2:30 PM (Immediate)',
    'Tomorrow, 10:00 AM',
    'Thursday, 4:15 PM',
    'Friday, 11:30 AM',
    'Next Monday, 2:00 PM',
  ]

  const filtered = doctors.filter((doctor) => {
    const matchesSpecialty = specialty === 'All specialties' || doctor.specialty === specialty
    const matchesSearch = !searchQuery.trim() ||
      doctor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doctor.specialty.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesSpecialty && matchesSearch
  })

  const handleConfirmBooking = (e: FormEvent) => {
    e.preventDefault()
    if (!bookingDoctor) return

    setConfirmedBookings((prev) => ({
      ...prev,
      [bookingDoctor.name]: {
        slot: bookingSlot,
        type: consultType,
        reason: bookingReason,
      },
    }))
    notify(`Appointment confirmed with ${bookingDoctor.name} for ${bookingSlot}!`)
    setBookingDoctor(null)
  }

  return (
    <>
      <PageHeading
        eyebrow={t('appts.eyebrow')}
        title={t('appts.title')}
        description={t('appts.desc')}
        action={<span className="secure-chip"><ShieldCheck size={13} /> Verified ABDM Providers</span>}
      />

      <Panel className="appointment-search">
        <div className="search-leading">
          <Search size={17} />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by doctor, specialty, or condition"
            aria-label="Search by doctor, specialty, or location"
          />
        </div>
        <button className="primary-button" onClick={() => notify(`Showing ${filtered.length} available care providers near you.`)}>
          Find care <ArrowRight size={15} />
        </button>
      </Panel>

      <div className="section-title-row doctors-title">
        <div>
          <h2>Recommended for you</h2>
          <p>Thoughtful care from verified ABDM clinical practitioners.</p>
        </div>
        <div className="specialty-filter">
          <Stethoscope size={15} />
          <select value={specialty} onChange={(event) => setSpecialty(event.target.value)} aria-label="Filter by specialty">
            {specialties.map((item) => <option key={item}>{item}</option>)}
          </select>
          <ChevronDown size={13} />
        </div>
      </div>

      <div className="doctor-grid">
        {filtered.map((doctor) => {
          const booking = confirmedBookings[doctor.name]
          return (
            <Panel className="doctor-card" key={doctor.name}>
              <div className="doctor-main">
                <div className={`doctor-avatar ${doctor.color}`}>{doctor.initials}</div>
                <div>
                  <h3>{doctor.name}</h3>
                  <span>{doctor.specialty}</span>
                  <div className="doctor-rating">
                    <span>★</span> {doctor.rating} <small>· {doctor.visits}</small>
                  </div>
                </div>
                <button
                  className="icon-button"
                  aria-label={`More about ${doctor.name}`}
                  onClick={() => notify(`${doctor.name} is affiliated with Apollo Health City & ABDM registered.`)}
                >
                  <MoreHorizontal size={17} />
                </button>
              </div>

              <div className="availability">
                <span><CalendarDays size={14} /> Next available</span>
                <strong>{doctor.availability}</strong>
              </div>

              {booking && (
                <div
                  style={{
                    margin: '6px 0 10px',
                    padding: '6px 10px',
                    borderRadius: '7px',
                    background: 'rgba(0, 210, 106, 0.12)',
                    border: '1px solid rgba(0, 210, 106, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '9px',
                    color: '#00e887',
                    fontWeight: 600,
                  }}
                >
                  <span className="radar-pulse" />
                  <span>Booked: {booking.slot}</span>
                </div>
              )}

              <button
                className="outline-button book-button"
                style={booking ? { borderColor: '#00d26a', color: '#00e887', background: 'rgba(0, 210, 106, 0.08)' } : undefined}
                onClick={() => {
                  setBookingDoctor(doctor)
                  setBookingSlot(doctor.availability)
                }}
              >
                {booking ? 'Manage Booking' : 'Book appointment'} <ArrowRight size={14} />
              </button>
            </Panel>
          )
        })}
      </div>

      {bookingDoctor && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 70,
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          role="dialog"
          aria-modal="true"
        >
          <div
            style={{
              width: '100%',
              maxWidth: '480px',
              background: '#0c202d',
              border: '1px solid rgba(0, 210, 106, 0.35)',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: '0 24px 60px rgba(0,0,0,0.65)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div className={`doctor-avatar ${bookingDoctor.color}`} style={{ width: '38px', height: '38px', borderRadius: '10px', display: 'grid', placeItems: 'center', fontWeight: 700 }}>
                  {bookingDoctor.initials}
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: '15px', color: '#eff9ff' }}>Book with {bookingDoctor.name}</h2>
                  <span style={{ fontSize: '11px', color: '#8fa2ae' }}>{bookingDoctor.specialty} · ABDM Verified</span>
                </div>
              </div>
              <button className="icon-button" onClick={() => setBookingDoctor(null)}><X size={18} /></button>
            </div>

            <form onSubmit={handleConfirmBooking} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#8fa2ae', marginBottom: '6px' }}>Select Consultation Slot</label>
                <select
                  value={bookingSlot}
                  onChange={(e) => setBookingSlot(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.15)',
                    background: '#071722',
                    color: '#fff',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                  }}
                >
                  {availableSlots.map((slot) => (
                    <option key={slot} value={slot}>{slot}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#8fa2ae', marginBottom: '6px' }}>Consultation Mode</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  {['In-Person Clinic Visit', 'ABDM Video Tele-Consult'].map((type) => (
                    <button
                      type="button"
                      key={type}
                      onClick={() => setConsultType(type)}
                      style={{
                        padding: '10px',
                        borderRadius: '8px',
                        border: consultType === type ? '1px solid #00d26a' : '1px solid rgba(255,255,255,0.12)',
                        background: consultType === type ? 'rgba(0, 210, 106, 0.15)' : 'rgba(255,255,255,0.03)',
                        color: consultType === type ? '#00e887' : '#9ca3af',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        textAlign: 'center',
                      }}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#8fa2ae', marginBottom: '6px' }}>Chief Concern / Reason for Visit</label>
                <input
                  type="text"
                  required
                  value={bookingReason}
                  onChange={(e) => setBookingReason(e.target.value)}
                  placeholder="e.g. Discuss recent blood sugar test, headaches, or prescription review"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.15)',
                    background: 'rgba(255,255,255,0.05)',
                    color: '#fff',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button type="button" className="secondary-button" onClick={() => setBookingDoctor(null)}>
                  Cancel
                </button>
                <button type="submit" className="primary-button">
                  <Check size={14} /> Confirm Appointment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

function PrepPage({ notify, t = (k: string) => k }: { notify: (message: string) => void; t?: (k: string) => string }) {
  const [checked, setChecked] = useState([true, true, true, false])
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0)
  const [notes, setNotes] = useState<Record<number, string>>({
    0: 'Experiencing mild afternoon tension headaches and want to review recent fasting glucose (108 mg/dL) from Apollo lab report.',
    1: 'Mild hypertension diagnosed in 2023. Family history of type 2 diabetes on maternal side.',
    2: 'Taking Metformin 500 mg twice daily with meals (96% adherence) and Atorvastatin 20 mg at bedtime.',
    3: 'Should we adjust Metformin dosage or schedule routine HbA1c testing? What are recommended aerobic targets?',
  })

  const items = [
    { title: 'Reason for visit', description: 'Briefly describe your symptoms or concern.', icon: MessageCircle, placeholder: 'e.g. Describe symptom duration, severity, and triggers...' },
    { title: 'Medical history', description: 'Share relevant past conditions and family history.', icon: FileHeart, placeholder: 'e.g. Relevant surgeries, allergies, chronic conditions...' },
    { title: 'Current medications', description: 'Include prescriptions, vitamins, and supplements.', icon: Pill, placeholder: 'e.g. Dosage, schedule adherence, any side effects noticed...' },
    { title: 'Questions for your doctor', description: 'Jot down anything you’d like to discuss.', icon: CircleHelp, placeholder: 'e.g. Questions about lab results, lifestyle tweaks, medications...' },
  ]

  const done = checked.filter(Boolean).length

  const handlePrintSummary = () => {
    printPreVisitSummary({
      patient: {
        name: 'Alex Morgan',
        abhaId: '91-8273-4920-1124',
        dob: '1992-05-14',
      },
      appointment: {
        doctorName: 'Dr. Sarah Khan',
        specialty: 'General Physician',
        date: 'Friday, May 16 · 10:30 AM',
      },
      sections: items.map((item, idx) => ({
        title: item.title,
        description: item.description,
        note: notes[idx] || '',
        completed: Boolean(checked[idx]),
      })),
      vitals: {
        bloodPressure: '120/80 mmHg',
        restingHeartRate: '68 bpm',
        glucose: '92 mg/dL',
      },
    })
    notify('Pre-visit brief generated! Print preview opened.')
  }

  return (
    <>
      <PageHeading
        eyebrow={t('prep.eyebrow')}
        title={t('prep.title')}
        description={t('prep.desc')}
        action={
          <button className="secondary-button" onClick={handlePrintSummary}>
            <Download size={15} /> {t('prep.save')}
          </button>
        }
      />

      <div className="prep-layout">
        <Panel className="prep-panel">
          <div className="prep-progress-header">
            <div>
              <span className="eyebrow">YOUR APPOINTMENT</span>
              <h2>Let’s get you ready.</h2>
              <p>Annual wellness visit · Dr. Sarah Khan</p>
            </div>
            <div className="prep-date">
              <CalendarDays size={16} />
              <span>May 16<small>Friday · 10:30 AM</small></span>
            </div>
          </div>

          <div className="progress-track">
            <span style={{ width: `${(done / items.length) * 100}%` }} />
          </div>
          <div className="progress-caption">
            {done} of {items.length} sections complete <span>{Math.round((done / items.length) * 100)}%</span>
          </div>

          <div className="prep-checklist" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {items.map((item, index) => {
              const isExpanded = expandedIndex === index
              const isDone = checked[index]
              return (
                <div
                  key={item.title}
                  style={{
                    borderRadius: '10px',
                    border: isExpanded ? '1px solid rgba(0, 210, 106, 0.35)' : '1px solid rgba(130, 170, 188, 0.12)',
                    background: isExpanded ? 'rgba(0, 210, 106, 0.03)' : 'rgba(255, 255, 255, 0.02)',
                    overflow: 'hidden',
                    transition: 'border-color 0.2s',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 14px',
                      cursor: 'pointer',
                    }}
                    onClick={() => setExpandedIndex(isExpanded ? null : index)}
                  >
                    <button
                      type="button"
                      style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '5px',
                        border: isDone ? '1px solid #00d26a' : '1px solid rgba(255,255,255,0.2)',
                        background: isDone ? '#00d26a' : 'transparent',
                        color: '#052012',
                        display: 'grid',
                        placeItems: 'center',
                        cursor: 'pointer',
                        padding: 0,
                        flexShrink: 0,
                      }}
                      onClick={(e) => {
                        e.stopPropagation()
                        setChecked((current) => current.map((val, i) => (i === index ? !val : val)))
                      }}
                    >
                      {isDone && <Check size={13} strokeWidth={3} />}
                    </button>
                    <span className="prep-item-icon" style={{ color: isDone ? '#00e887' : '#9ca3af' }}>
                      <item.icon size={17} />
                    </span>
                    <span className="prep-item-copy" style={{ flex: 1 }}>
                      <strong style={{ color: isDone ? '#eff9ff' : '#cad7df' }}>{item.title}</strong>
                      <small style={{ color: '#79909e' }}>{item.description}</small>
                    </span>
                    <ChevronRight
                      size={16}
                      style={{
                        color: '#79909e',
                        transform: isExpanded ? 'rotate(90deg)' : 'none',
                        transition: 'transform 0.2s ease',
                      }}
                    />
                  </div>

                  {isExpanded && (
                    <div style={{ padding: '0 14px 14px 46px' }}>
                      <textarea
                        value={notes[index] || ''}
                        onChange={(e) => setNotes({ ...notes, [index]: e.target.value })}
                        placeholder={item.placeholder}
                        rows={3}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          border: '1px solid rgba(255, 255, 255, 0.12)',
                          background: '#071621',
                          color: '#e4f1f8',
                          fontSize: '11px',
                          lineHeight: 1.5,
                          resize: 'vertical',
                          boxSizing: 'border-box',
                        }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                        <span style={{ fontSize: '9px', color: '#688290' }}>
                          Notes save automatically for your ABDM print summary
                        </span>
                        <button
                          type="button"
                          className="subtle-link"
                          style={{ fontSize: '9px' }}
                          onClick={() => {
                            if (!isDone) {
                              setChecked((current) => current.map((val, i) => (i === index ? true : val)))
                            }
                            setExpandedIndex(null)
                          }}
                        >
                          <Check size={11} /> Save &amp; collapse
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <button className="primary-button prep-generate" style={{ marginTop: '16px', width: '100%' }} onClick={handlePrintSummary}>
            <Sparkles size={15} /> {t('prep.generate')} <ArrowRight size={14} />
          </button>
        </Panel>

        <div className="prep-side">
          <Panel className="prep-tip">
            <div className="tip-icon"><Sparkles size={18} /></div>
            <span className="eyebrow">A HELPFUL REMINDER</span>
            <h2>Bring the full picture.</h2>
            <p>Include how long you’ve noticed symptoms and any patterns that seem important to you.</p>
          </Panel>

          <Panel className="prep-privacy">
            <ShieldCheck size={18} />
            <div>
              <strong>You’re in control.</strong>
              <p>Your notes are private, encrypted locally, and only shared when you choose to print or export.</p>
            </div>
          </Panel>
        </div>
      </div>
    </>
  )
}

function SettingsPage({ notify, theme, onToggleTheme }: { notify: (message: string) => void; theme: 'light' | 'dark'; onToggleTheme: () => void }) {
  return <>
    <PageHeading eyebrow="MAKE IT YOURS" title="Settings" description="Manage your profile, preferences, and privacy." />
    <div className="settings-grid"><Panel><PanelHeading title="Personal profile" detail="Your details help personalize your experience." />{[['Full name', 'Alex Morgan'], ['Email address', 'alex.morgan@email.com'], ['Date of birth', 'May 14, 1992'], ['Care preference', 'General wellness']].map(([label, value]) => <div className="setting-row" key={label}><span>{label}</span><strong>{value}</strong><button className="subtle-link" onClick={() => notify(`${label} settings are ready to edit.`)}>Edit</button></div>)}</Panel><Panel><PanelHeading title="Privacy & notifications" detail="Choose what works best for you." />{[['Health reminders', 'Personalized nudges for your routine'], ['Weekly health summary', 'A calm recap of your health trends'], ['Device sync alerts', 'Know when a connected device updates']].map(([title, detail], index) => <div className="setting-toggle-row" key={title}><div><strong>{title}</strong><small>{detail}</small></div><button className="toggle-switch" role="switch" aria-checked={index !== 2} aria-label={title} onClick={(event) => { const target = event.currentTarget; target.setAttribute('aria-checked', String(target.getAttribute('aria-checked') !== 'true')); notify(`${title} preference updated.`) }}><span /></button></div>)}</Panel><Panel><PanelHeading title="Appearance" detail="Choose the look that feels right for you." /><div className="appearance-row"><div><strong>{theme === 'dark' ? 'Dark theme' : 'Light theme'}</strong><small>Switch between light and dark mode.</small></div><button className="secondary-button" onClick={onToggleTheme}>{theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />} Switch to {theme === 'dark' ? 'light' : 'dark'}</button></div></Panel></div>
  </>
}

export default function PulseAIApp() {
  const [active, setActive] = useState<Section>('Overview')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>('dark')
  const [language, setLanguage] = useState<Language>('en')
  const [profileImage, setProfileImage] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const toastTimer = useRef<number | null>(null)
  const [timelineRecords, setTimelineRecords] = useState<any[]>([])
  const [loadingTimeline, setLoadingTimeline] = useState(false)
  const [meds, setMeds] = useState<MedItem[]>(initialMeds)

  // Web Bluetooth Smart Scale & Device states
  const [devices, setDevices] = useState<DeviceState[]>([
    {
      name: 'Pixel Watch 2',
      kind: 'Smartwatch · Heart rate, steps, sleep',
      icon: Watch,
      color: 'mint',
      connected: true,
      syncing: false,
      synced: 'Synced 9:42 AM',
      metrics: { 'Resting HR': '68 bpm', 'SpO2': '98%', 'Daily Steps': '8,420' },
    },
    {
      name: 'Google Fit',
      kind: 'Fitness · Activity, workouts, calories',
      icon: Activity,
      color: 'blue',
      connected: true,
      syncing: false,
      synced: 'Synced 8:18 AM',
      metrics: { 'Active Time': '45 min', 'Calories Burned': '540 kcal' },
    },
    {
      name: 'Withings Smart Scale',
      kind: 'Smart scale · Weight, BMI, body composition',
      icon: Activity,
      color: 'violet',
      connected: false,
      syncing: false,
      synced: 'Ready to connect',
      metrics: { 'Weight': '72.4 kg', 'BMI': '22.8', 'Body Fat': '18.2%' },
    },
  ])
  const [hasSyncedScale, setHasSyncedScale] = useState(false)
  const [isConnectingScale, setIsConnectingScale] = useState(false)

  const notify = (message: string) => {
    setToast(message)
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(''), 4000)
  }
  const toggleTheme = () => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
  const choosePage = (page: Section) => {
    setActive(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleConnectScale = async () => {
    setIsConnectingScale(true)
    notify('Scanning for nearby BLE Body Scales...')

    const completeScaleSync = () => {
      setDevices((current) =>
        current.map((dev) =>
          dev.name.includes('Smart Scale')
            ? {
                ...dev,
                connected: true,
                syncing: false,
                synced: 'Connected · Live Sync',
                metrics: { 'Weight': '72.4 kg', 'BMI': '22.8', 'Body Fat': '18.2%' },
              }
            : dev
        )
      )
      setHasSyncedScale(true)
      setIsConnectingScale(false)

      const scaleDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date()).toUpperCase()
      const scaleEventTitle = 'Bluetooth Metric: Withings Smart Body Scale Sync'
      const scaleEventSummary = 'Weight: 72.4 kg, BMI: 22.8 (Healthy range), Body Fat: 18.2%. Sync verified via local Web Bluetooth GATT profile.'

      setTimelineRecords((prev) => [
        {
          id: 'scale-sync-' + Date.now(),
          document_type: scaleEventTitle,
          created_at: new Date().toISOString(),
          mock_abha_id: '91-8273-4920-1124',
          ai_summary_english: scaleEventSummary,
          fhir_data: {
            title: scaleEventTitle,
            plain_english_summary: scaleEventSummary,
            medicines: [],
            test_values: [
              { name: 'Weight', value: '72.4', unit: 'kg', abnormal_flag: false, explanation: 'Normal' },
              { name: 'BMI', value: '22.8', unit: 'kg/m²', abnormal_flag: false, explanation: 'Healthy range' },
              { name: 'Body Fat', value: '18.2', unit: '%', abnormal_flag: false, explanation: 'Athletic/Optimal' },
            ],
            diagnoses: ['Normal Body Composition Index'],
          },
        },
        ...prev,
      ])
      notify('Withings Smart Scale connected via Bluetooth! Biometrics ingested into Overview & Timeline.')
    }

    if (typeof navigator !== 'undefined' && 'bluetooth' in navigator && (navigator as any).bluetooth) {
      try {
        const navBluetooth = (navigator as any).bluetooth
        await navBluetooth.requestDevice({
          filters: [{ services: ['weight_scale'] }],
          optionalServices: ['battery_service'],
        })
        completeScaleSync()
        return
      } catch (err: any) {
        console.log('Bluetooth prompt dismissed or unsupported, falling back to simulator:', err)
      }
    }

    setTimeout(() => {
      completeScaleSync()
    }, 1200)
  }

  const fetchTimeline = useCallback(async () => {
    try {
      setLoadingTimeline(true)
      const { data, error } = await supabase
        .from('health_timeline')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Supabase query error:', error)
        return
      }
      if (data) {
        setTimelineRecords(data)
      }
    } catch (err) {
      console.error('Failed to load health timeline records:', err)
    } finally {
      setLoadingTimeline(false)
    }
  }, [])

  useEffect(() => {
    fetchTimeline()
  }, [fetchTimeline])

  // Live dynamic header date
  const locale = LOCALE_MAP[language] || 'en-US'
  const liveHeaderDate = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date()).toUpperCase()

  const handleExportSummary = () => {
    const summaryData = {
      patient: {
        name: 'Alex Morgan',
        abhaId: '91-8273-4920-1124',
        gender: 'Female',
        dob: '1992-05-14',
        mobile: '+91 98765 43210',
      },
      medications: meds.map((m) => ({
        name: m.name,
        dosage: m.dosage,
        frequency: m.frequency,
        adherence: m.adherence,
      })),
      vitals: {
        bloodPressure: '120/80',
        restingHeartRate: '68',
        fastingGlucose: '92',
        hemoglobin: '14.2',
        vitaminD: '32',
        weightKg: hasSyncedScale ? 72.4 : 72.4,
        bmi: hasSyncedScale ? 22.8 : 22.1,
      },
      recentRecords: timelineRecords.map((r) => ({
        title: r.fhir_data?.title || r.document_type || 'Lab Record',
        date: new Date(r.created_at).toLocaleDateString(),
        type: r.document_type || 'Diagnostic Report',
        summary: r.ai_summary_english || r.fhir_data?.plain_english_summary,
      })),
    }

    printClinicalSummary(summaryData)
    notify('ABDM Clinical Summary generated! Print preview opened.')
  }

  const handleExportFhir = () => {
    const fhirSummaryData: ClinicalSummaryData = {
      patient: {
        name: 'Alex Morgan',
        abhaId: '91-8273-4920-1124',
        gender: 'Female',
        dob: '1992-05-14',
        mobile: '+91 98765 43210',
      },
      medications: meds.map((m) => ({
        name: m.name,
        dosage: m.dosage,
        frequency: m.frequency,
        adherence: m.adherence,
      })),
      vitals: {
        bloodPressure: '120/80',
        restingHeartRate: '68',
        fastingGlucose: '92',
        hemoglobin: '14.2',
        vitaminD: '32',
        weightKg: hasSyncedScale ? 72.4 : 72.4,
        bmi: hasSyncedScale ? 22.8 : 22.1,
      },
      recentRecords: timelineRecords.map((r) => ({
        title: r.fhir_data?.title || r.document_type || 'Diagnostic Report',
        date: r.created_at ? new Date(r.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        type: r.document_type || 'Diagnostic Report',
        summary: r.ai_summary_english || r.fhir_data?.plain_english_summary || '',
      })),
    }

    downloadFhirBundle(fhirSummaryData)
    notify('ABDM FHIR Bundle (R4 JSON) downloaded successfully!')
  }

  const translationAliases: Record<string, string> = {
    'score.detail': 'score.subtitle',
    'vitals.detail': 'vitals.subtitle',
    'vitals.viewDevices': 'action.viewDevices',
    'vitals.resting': 'vitals.hr.change',
    'vitals.optimal': 'vitals.bp.change',
    'vitals.fastingNormal': 'vitals.glucose.change',
    'vitals.goal10k': 'vitals.activity.change',
    'meds.logged': 'meds.subtitle',
    'meds.schedule': 'action.schedule',
    'insights.detail': 'insights.subtitle',
    'trends.detail': 'trends.subtitle',
    'timeline.detail': 'timeline.emptySubtitle',
    'timeline.refresh': 'action.refresh',
    'records.viewAll': 'action.viewAll',
    'records.upload': 'records.uploadBtn',
    'meds.eyebrow': 'meds.header.eyebrow',
    'meds.desc': 'meds.header.desc',
    'meds.adherenceMonth': 'meds.monthAdherence',
    'meds.add': 'action.addMed',
    'triage.getGuidance': 'action.getGuidance',
    'devices.connect': 'devices.connectBtn',
    'prep.generate': 'action.generateSummary',
  }
  const t = (k: string) => {
    const key = TRANSLATIONS[language]?.[k] ? k : translationAliases[k] || k
    return TRANSLATIONS[language]?.[key] || TRANSLATIONS['en']?.[key] || k
  }

  const descriptions: Record<Section, string> = {
    'Overview': 'Your wellness, in focus.',
    'Health Records': 'Your health library.',
    'Medications': 'Your daily routine.',
    'Copilot Chat': 'Here when you need us.',
    'Emergency Triage': 'Help you can act on.',
    'Device Sync': 'Your connected health.',
    'Appointments': 'Care that fits your life.',
    'Pre-Visit Prep': 'Feel ready for your visit.',
    'Settings': 'Make it yours.',
  }

  return (
    <div className="app-shell" data-theme={theme} data-active={active}>
      <Sidebar active={active} onSelect={choosePage} open={sidebarOpen} onClose={() => setSidebarOpen(false)} lang={language} profileImage={profileImage} onProfileImageChange={setProfileImage} />
      <main className="main-content">
        <header className="topbar">
          <button className="icon-button menu-button" aria-label="Open navigation" onClick={() => setSidebarOpen(true)}>
            <Menu size={19} />
          </button>
          <div className="breadcrumb">
            <span>PulseAI</span>
            <ChevronRight size={13} />
            <strong>{active}</strong>
          </div>
          <div className="topbar-actions">
            <span className="topbar-date">{liveHeaderDate}</span>
            <label className="language-picker">
              <Languages size={14} />
              <span className="sr-only">Language</span>
              <select
                aria-label="Language"
                value={language}
                onChange={(event) => {
                  const newLang = event.target.value as Language
                  setLanguage(newLang)
                  const langNames: Record<Language, string> = { en: 'English', hi: 'हिन्दी', te: 'తెలుగు', ta: 'தமிழ்' }
                  notify(`Language changed to ${langNames[newLang]}! Dashboard localized.`)
                }}
              >
                <option value="en">English</option>
                <option value="hi">हिन्दी</option>
                <option value="te">తెలుగు</option>
                <option value="ta">தமிழ்</option>
              </select>
              <ChevronDown size={12} />
            </label>
            <button className="icon-button theme-button" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} onClick={toggleTheme}>
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <button className="icon-button notification-button" aria-label="Notifications" onClick={() => notify('You’re all caught up on notifications.')}>
              <Bell size={17} /><i />
            </button>
            <button className="icon-button" aria-label="Export ABDM report" title="Export ABDM report" onClick={handleExportSummary}>
              <Download size={18} />
            </button>
            <button className="topbar-profile" aria-label="Open profile settings" onClick={() => choosePage('Settings')}>
              AM
            </button>
          </div>
        </header>
        <div className="content-wrap" data-section={active} key={active}>
          {active === 'Overview' && (
            <Overview
              onSelect={choosePage}
              notify={notify}
              profileImage={profileImage}
              records={timelineRecords}
              isLoading={loadingTimeline}
              onRefresh={fetchTimeline}
              onExport={handleExportSummary}
              onExportFhir={handleExportFhir}
              scaleSynced={hasSyncedScale}
              language={language}
              t={t}
            />
          )}
          {active === 'Health Records' && <RecordsPage notify={notify} dbRecords={timelineRecords} t={t} />}
          {active === 'Medications' && <MedicationsPage notify={notify} meds={meds} setMeds={setMeds} t={t} />}
          {active === 'Copilot Chat' && <ChatPage t={t} language={language} />}
          {active === 'Emergency Triage' && <TriagePage notify={notify} t={t} />}
          {active === 'Device Sync' && (
            <DevicesPage
              notify={notify}
              devices={devices}
              setDevices={setDevices}
              onConnectScale={handleConnectScale}
              isConnectingScale={isConnectingScale}
              t={t}
            />
          )}
          {active === 'Appointments' && <AppointmentsPage notify={notify} t={t} />}
          {active === 'Pre-Visit Prep' && <PrepPage notify={notify} t={t} />}
          {active === 'Settings' && <SettingsPage notify={notify} theme={theme} onToggleTheme={toggleTheme} />}
          <footer className="app-footer">
            <Brand compact />
            <span>{descriptions[active]}</span>
            <span className="footer-built"><span className="live-dot" /> Built around you</span>
          </footer>
        </div>
      </main>
      <aside className="medical-safety-banner" role="note" style={{ marginTop: '32px', marginBottom: '64px' }}>
        <AlertTriangle size={16} />
        <span>{t('banner.safety')}</span>
      </aside>
      <nav className="mobile-bottom-nav" aria-label="Quick navigation">
        {navItems.slice(0, 4).map(({ key, label, icon: Icon }) => (
          <button key={label} className={active === label ? 'mobile-nav-active' : ''} onClick={() => choosePage(label)} aria-label={label} aria-current={active === label ? 'page' : undefined}>
            <Icon size={18} />
            <span>{t(key)}</span>
          </button>
        ))}
      </nav>
      {toast && (
        <div className="toast-message" role="status">
          <CheckCircle2 size={17} />{toast}
          <button onClick={() => setToast('')} aria-label="Dismiss notification"><X size={15} /></button>
        </div>
      )}
      <AiChatWidget language={language} />
    </div>
  )
}
