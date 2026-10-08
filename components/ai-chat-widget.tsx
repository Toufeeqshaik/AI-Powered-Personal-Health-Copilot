'use client'

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import {
  ArrowUp, AudioLines, GripHorizontal, HeartPulse, MessageCircle, Mic,
  Paperclip, RotateCcw, Sparkles, X, FileText
} from 'lucide-react'
import { getOfflineHealthReply } from '@/lib/offlineHealthReply'
import type { Language } from '@/lib/i18n'

type WidgetMessage = {
  id: string
  role: 'user' | 'assistant'
  text: string
  attachmentName?: string
}

type SpeechResultEvent = {
  resultIndex: number
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>
}

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

const quickPrompts = [
  'What can you help me with?',
  'How can I get better sleep?',
  'Explain my latest lab reports',
]

export function AiChatWidget({ language = 'en' }: { language?: Language }) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<WidgetMessage[]>([])
  const [isWorking, setIsWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [listening, setListening] = useState(false)
  const [attachedFile, setAttachedFile] = useState<{ name: string; base64: string } | null>(null)

  // Drag state
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const isDraggingRef = useRef(false)
  const dragStartRef = useRef({ startX: 0, startY: 0, initialX: 0, initialY: 0, moved: false })

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, isWorking, open])

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop()
    }
  }, [])

  // Draggable logic
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    isDraggingRef.current = true
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: position.x,
      initialY: position.y,
      moved: false,
    }
    const target = e.currentTarget as HTMLElement
    target.setPointerCapture?.(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return
    const dx = e.clientX - dragStartRef.current.startX
    const dy = e.clientY - dragStartRef.current.startY
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      dragStartRef.current.moved = true
    }
    setPosition({
      x: dragStartRef.current.initialX + dx,
      y: dragStartRef.current.initialY + dy,
    })
  }

  const onPointerUp = (e: React.PointerEvent) => {
    isDraggingRef.current = false
    try {
      const target = e.currentTarget as HTMLElement
      target.releasePointerCapture?.(e.pointerId)
    } catch {}
  }

  const handleLauncherClick = () => {
    if (dragStartRef.current.moved) return
    setOpen((prev) => !prev)
  }

  const toggleSpeech = () => {
    if (listening) {
      recognitionRef.current?.stop()
      return
    }

    const SpeechRecognition =
      (window as SpeechWindow).SpeechRecognition ??
      (window as SpeechWindow).webkitSpeechRecognition

    if (!SpeechRecognition) {
      setNotice('Voice recognition is not supported in this browser. Try Chrome or Edge.')
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = 'en-US'
    recognition.continuous = false
    recognition.interimResults = false

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .slice(event.resultIndex)
        .filter((r) => r.isFinal)
        .map((r) => r[0].transcript.trim())
        .filter(Boolean)
        .join(' ')

      if (transcript) {
        setInput((prev) => (prev ? `${prev} ${transcript}` : transcript))
        setNotice('Voice input captured.')
      }
    }

    recognition.onerror = () => {
      setListening(false)
      setNotice('Microphone access unavailable. Check browser permissions.')
    }

    recognition.onend = () => {
      setListening(false)
      recognitionRef.current = null
    }

    recognitionRef.current = recognition
    setNotice('Listening… Speak now.')
    try {
      recognition.start()
      setListening(true)
    } catch {
      recognitionRef.current = null
      setListening(false)
      setNotice('Could not start speech recognition.')
    }
  }

  const handleFileAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 3 * 1024 * 1024) {
      setNotice('Chat attachments must be 3 MB or smaller.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAttachedFile({ name: file.name, base64: reader.result })
        setNotice(`Attached ${file.name} for multimodal visual analysis.`)
      }
    }
    reader.readAsDataURL(file)
  }

  const submitText = async (text: string) => {
    const userMessage = text.trim()
    if ((!userMessage && !attachedFile) || isWorking) return

    setNotice('')
    setError(null)
    setInput('')

    const filePayload = attachedFile
    setAttachedFile(null)

    const userEntry: WidgetMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: userMessage || `Please inspect the attached record: ${filePayload?.name}`,
      attachmentName: filePayload?.name,
    }

    const nextMessages = [...messages, userEntry]
    setMessages(nextMessages)
    setIsWorking(true)

    try {
      const historyPayload = messages.map((m) => ({
        role: m.role,
        text: m.text,
      }))

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userEntry.text,
          attachment: filePayload?.base64,
          fileName: filePayload?.name,
          history: historyPayload,
          language,
        }),
      })

      const data = await res.json()
      const assistantText =
        data.reply || data.text || data.message || getOfflineHealthReply(userEntry.text, language, Boolean(filePayload))

      const assistantEntry: WidgetMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        text: assistantText,
      }

      setMessages([...nextMessages, assistantEntry])
    } catch (err: any) {
      console.error('Widget chat error:', err)
      const assistantEntry: WidgetMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        text: getOfflineHealthReply(userEntry.text, language, Boolean(filePayload)),
      }
      setMessages([...nextMessages, assistantEntry])
    } finally {
      setIsWorking(false)
    }
  }

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    submitText(input)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey) return
    if (event.nativeEvent.isComposing || event.keyCode === 229) return
    event.preventDefault()
    submitText(input)
  }

  const startFreshChat = () => {
    setMessages([])
    setError(null)
    setNotice('')
    setInput('')
    setAttachedFile(null)
  }

  return (
    <div
      className={`pulse-widget ${open ? 'pulse-widget-open' : ''}`}
      style={{
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
        touchAction: 'none',
        transition: isDraggingRef.current ? 'none' : 'transform 0.15s ease-out',
      }}
    >
      {open && (
        <section className="pulse-chat-window" aria-label="PulseAI chat assistant">
          <header
            className="pulse-chat-header"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            style={{ cursor: 'grab', userSelect: 'none' }}
          >
            <div className="pulse-chat-identity">
              <div className="pulse-chat-avatar"><HeartPulse size={18} /></div>
              <div>
                <strong style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  PulseAI
                  <GripHorizontal size={14} style={{ color: '#526d7b', opacity: 0.8 }} />
                </strong>
                <span><i /> Drag header to reposition</span>
              </div>
            </div>
            <div className="pulse-chat-header-actions" onPointerDown={(e) => e.stopPropagation()}>
              {messages.length > 0 && (
                <button
                  type="button"
                  className="pulse-chat-icon-button"
                  aria-label="Start a new chat"
                  title="Start a new chat"
                  onClick={startFreshChat}
                >
                  <RotateCcw size={15} />
                </button>
              )}
              <button
                type="button"
                className="pulse-chat-icon-button"
                aria-label="Close chat"
                title="Close chat"
                onClick={() => setOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
          </header>

          <div className="pulse-chat-messages" aria-live="polite" aria-relevant="additions text">
            {messages.length === 0 ? (
              <div className="pulse-chat-welcome">
                <span className="pulse-welcome-icon"><Sparkles size={18} /></span>
                <span className="pulse-chat-kicker">A LITTLE MORE CLARITY</span>
                <h2>What&apos;s on your mind?</h2>
                <p>Ask a general health question or attach a lab report for multimodal analysis.</p>
                <div className="pulse-chat-prompts">
                  {quickPrompts.map((prompt) => (
                    <button type="button" key={prompt} onClick={() => submitText(prompt)}>
                      {prompt}
                      <ArrowUp size={13} />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((message) => (
                <div className={`pulse-chat-message pulse-message-${message.role}`} key={message.id}>
                  {message.role === 'assistant' && (
                    <span className="pulse-message-mark"><Sparkles size={12} /></span>
                  )}
                  <div className="pulse-message-bubble">
                    {message.attachmentName && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                          marginBottom: '6px',
                          fontSize: '10px',
                          color: '#00e887',
                        }}
                      >
                        <FileText size={12} />
                        <span>Attached: {message.attachmentName}</span>
                      </div>
                    )}
                    <p style={{ whiteSpace: 'pre-wrap', margin: 0, lineHeight: 1.55 }}>
                      {message.text}
                    </p>
                  </div>
                </div>
              ))
            )}
            {isWorking && (
              <div className="pulse-chat-thinking" role="status">
                <span /><span /><span />Thinking through your health query...
              </div>
            )}
            {error && (
              <div className="pulse-chat-error" role="alert">
                {error}
                <button type="button" onClick={() => submitText(messages[messages.length - 1]?.text || 'Hello')}>
                  Try again
                </button>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {attachedFile && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 14px',
                background: 'rgba(0, 210, 106, 0.08)',
                borderTop: '1px solid rgba(0, 210, 106, 0.2)',
                fontSize: '10px',
                color: '#00e887',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <FileText size={12} /> {attachedFile.name}
              </span>
              <button
                type="button"
                onClick={() => setAttachedFile(null)}
                style={{ background: 'none', border: 'none', color: '#ff6b81', cursor: 'pointer' }}
              >
                <X size={12} />
              </button>
            </div>
          )}

          <form className="pulse-chat-form" onSubmit={onSubmit}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              className="sr-only"
              onChange={handleFileAttach}
            />
            <button
              type="button"
              className="composer-action attach-action"
              style={{ background: 'transparent', border: 'none', color: '#8fa2ae', cursor: 'pointer', padding: '6px' }}
              title="Attach lab report or prescription"
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip size={16} />
            </button>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Ask a health question or attach record..."
              aria-label="Message PulseAI"
              rows={1}
              maxLength={4000}
              disabled={isWorking}
            />
            <button
              type="button"
              className={`composer-action microphone-action ${listening ? 'is-listening' : ''}`}
              style={{
                background: listening ? 'rgba(0, 210, 106, 0.2)' : 'transparent',
                color: listening ? '#00e887' : '#8fa2ae',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '6px',
                borderRadius: '8px',
              }}
              title={listening ? 'Stop listening' : 'Speak message'}
              onClick={toggleSpeech}
            >
              {listening ? <AudioLines size={16} className="animate-pulse" /> : <Mic size={16} />}
            </button>
            <button
              type="submit"
              aria-label="Send message"
              disabled={(!input.trim() && !attachedFile) || isWorking}
            >
              <ArrowUp size={17} />
            </button>
          </form>
          <div className="pulse-chat-footer">
            <span>{notice || 'General information only — not a clinical diagnosis.'}</span>
            <span>Enter to send · Drag header to move</span>
          </div>
        </section>
      )}

      <button
        type="button"
        className="pulse-launcher"
        aria-label={open ? 'Close PulseAI assistant' : 'Open PulseAI assistant'}
        aria-expanded={open}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onClick={handleLauncherClick}
        style={{ cursor: 'grab', userSelect: 'none' }}
      >
        <span className="pulse-launcher-wave pulse-launcher-wave-one" />
        <span className="pulse-launcher-wave pulse-launcher-wave-two" />
        <span className="pulse-launcher-core">{open ? <X size={21} /> : <MessageCircle size={21} />}</span>
        {!open && <span className="pulse-launcher-label">Ask PulseAI ⠿</span>}
      </button>
    </div>
  )
}
