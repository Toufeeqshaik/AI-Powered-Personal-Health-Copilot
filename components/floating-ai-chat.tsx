'use client'

import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { ArrowDown, ArrowUp, Check, HeartPulse, MessageCircle, Sparkles, X } from 'lucide-react'

const transport = new DefaultChatTransport({ api: '/api/chat' })

export default function FloatingAIChat() {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const formRef = useRef<HTMLFormElement>(null)
  const transcriptRef = useRef<HTMLDivElement>(null)
  const { messages, sendMessage, status, error } = useChat({ transport })
  const busy = status === 'submitted' || status === 'streaming'

  useLayoutEffect(() => {
    if (open && transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight
    }
  }, [messages, open, status])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const text = draft.trim()
    if (!text || busy) return
    setOpen(true)
    setDraft('')
    void sendMessage({ text })
  }

  const submitOnEnter = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey) return
    if (event.nativeEvent.isComposing || event.keyCode === 229) return
    event.preventDefault()
    formRef.current?.requestSubmit()
  }

  return (
    <div className={`floating-ai-root ${open ? 'floating-ai-open' : ''}`}>
      {open && (
        <section className="floating-ai-window" aria-label="PulseAI health assistant" aria-live="polite">
          <header className="floating-ai-header">
            <div className="floating-ai-avatar"><HeartPulse size={17} /></div>
            <div className="floating-ai-title"><strong>PulseAI</strong><span><i /> Here to help</span></div>
            <button className="floating-ai-close" type="button" aria-label="Close assistant" onClick={() => setOpen(false)}><X size={17} /></button>
          </header>
          <div className="floating-ai-transcript" ref={transcriptRef}>
            {messages.length === 0 ? (
              <div className="floating-ai-welcome">
                <span className="floating-ai-welcome-mark"><Sparkles size={18} /></span>
                <strong>What's on your mind?</strong>
                <p>Ask a health question and I'll help you find clear, general information.</p>
                <span className="floating-ai-safety"><Check size={12} /> Private chat · General guidance only</span>
              </div>
            ) : messages.map((message) => (
              <article className={`floating-ai-message ${message.role === 'user' ? 'floating-ai-user' : 'floating-ai-assistant'}`} key={message.id}>
                <div className="floating-ai-bubble">{message.parts.map((part, index) => part.type === 'text' ? <span key={`${message.id}-${index}`}>{part.text}</span> : null)}</div>
              </article>
            ))}
            {busy && <div className="floating-ai-thinking" role="status"><i /><i /><i /><span className="sr-only">PulseAI is responding</span></div>}
            {error && <p className="floating-ai-error" role="alert">I couldn't reach the assistant. Please try again.</p>}
          </div>
          <form className="floating-ai-form" ref={formRef} onSubmit={submit}>
            <label className="sr-only" htmlFor="floating-ai-input">Ask PulseAI a question</label>
            <textarea id="floating-ai-input" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={submitOnEnter} placeholder="Ask a health question..." rows={1} maxLength={2000} disabled={busy} />
            <button type="submit" aria-label="Send message" disabled={!draft.trim() || busy}><ArrowUp size={17} /></button>
          </form>
          <p className="floating-ai-disclaimer">AI can make mistakes. Not a substitute for medical care.</p>
        </section>
      )}
      <div className="floating-ai-composer">
        <button type="button" className="floating-ai-launcher" aria-expanded={open} aria-label={open ? 'Close PulseAI chat' : 'Open PulseAI chat'} onClick={() => setOpen((current) => !current)}>
          <span className="floating-ai-launcher-icon">{open ? <ArrowDown size={17} /> : <Sparkles size={17} />}</span>
          <span className="floating-ai-launcher-copy"><strong>{open ? 'Chat open' : 'Ask PulseAI'}</strong><small>{open ? 'Tap to minimize' : 'Your health, made clearer'}</small></span>
          {!open && <span className="floating-ai-launcher-action"><MessageCircle size={17} /></span>}
        </button>
      </div>
    </div>
  )
}

export const __floatingChatFormType = undefined

function FloatingChatComposerPreview() {
  return null
}

void FloatingChatComposerPreview
void __floatingChatFormType
