
import { useState, useRef, useEffect, useCallback } from 'react'
import { specSectionsEn, specSectionsZh } from './spec/sections'
import { ui as uiData, typeIndexData, errorCodesData } from './spec/static-data'
import type { SpecSection, SpecSubsection } from './spec/sections'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// ─── Sidebar Navigation ──────────────────────────────────────────────────────

function Sidebar({
  sections,
  activeId,
  onNavigate,
  isOpen,
  onClose,
  ui,
}: {
  sections: SpecSection[]
  activeId: string
  onNavigate: (id: string) => void
  isOpen: boolean
  onClose: () => void
  ui: any
}) {
  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/20 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={`fixed top-0 left-0 z-40 h-full w-72 transform border-r border-slate-200 bg-white/80 backdrop-blur-xl transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-slate-200 px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-sm text-white shadow-md shadow-indigo-200">
                AI
              </div>
              <div>
                <h1 className="text-sm font-bold tracking-tight text-slate-900">
                  {ui.sidebarTitle}
                </h1>
                <p className="text-xs text-slate-400">{ui.sidebarSubtitle}</p>
              </div>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-4">
            {sections.map(section => (
              <div key={section.id} className="mb-3">
                <button
                  onClick={() => {
                    onNavigate(section.subsections[0].id)
                    onClose()
                  }}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-semibold transition-colors ${section.subsections.some(s => s.id === activeId)
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-700 hover:bg-slate-100'
                    }`}
                >
                  <span className="text-base">{section.icon}</span>
                  {section.title}
                </button>
                <div className="ml-8 mt-1 space-y-0.5">
                  {section.subsections.map(sub => (
                    <button
                      key={sub.id}
                      onClick={() => {
                        onNavigate(sub.id)
                        onClose()
                      }}
                      className={`block w-full rounded-md px-3 py-1.5 text-left text-xs transition-colors ${activeId === sub.id
                        ? 'bg-indigo-100/80 font-medium text-indigo-700'
                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                        }`}
                    >
                      {sub.title}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </nav>

          <div className="border-t border-slate-200 px-6 py-4">
            <p className="text-xs text-slate-400">
              {ui.sidebarFooter}
            </p>
          </div>
        </div>
      </aside>
    </>
  )
}

// ─── Code Block ──────────────────────────────────────────────────────────────

function CodeBlock({ code, className, ui }: { code: string; className?: string; ui: any }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className={`group relative ${className ?? ''}`}>
      <button
        onClick={handleCopy}
        className="absolute top-3 right-3 z-10 rounded-md border border-slate-600 bg-slate-700 px-2 py-1 text-xs text-slate-300 opacity-0 transition-opacity hover:bg-slate-600 group-hover:opacity-100"
        title={ui.copy}
      >
        {copied ? ui.copied : ui.copy}
      </button>
      <pre className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-900 p-5 text-sm leading-relaxed text-slate-200 shadow-sm">
        <code>{code}</code>
      </pre>
    </div>
  )
}

// ───  Markdown Renderer ───────────────────────────────────────────────────────

function MarkdownRenderer({ content, className = '' }: { content: string; className?: string }) {
  return (
    <div className={`prose-custom max-w-none ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>,
          ul: ({ children }) => <ul className="mb-4 ml-6 list-disc space-y-1.5 marker:text-slate-400">{children}</ul>,
          ol: ({ children }) => <ol className="mb-4 ml-6 list-decimal space-y-1.5 marker:text-slate-400 marker:font-mono marker:text-[10px]">{children}</ol>,
          li: ({ children }) => <li className="pl-1 text-inherit">{children}</li>,
          code: (props: any) => {
            const { children, className, node, ...rest } = props
            const isBlock = /language-(\w+)/.test(className || '') || (node?.position?.start.line !== node?.position?.end.line)

            if (!isBlock) {
              return (
                <code className="mx-0.5 rounded-md bg-slate-100/80 px-1.5 py-0.5 text-[0.8125rem] font-medium text-indigo-700 border border-slate-200/50" {...rest}>
                  {children}
                </code>
              )
            }
            return (
              <pre className="my-4 overflow-x-auto rounded-lg bg-slate-900 p-4 text-xs text-slate-300">
                <code className={className}>{children}</code>
              </pre>
            )
          },
          strong: ({ children }) => <strong className="font-bold text-slate-900">{children}</strong>,
          em: ({ children }) => <em className="italic text-slate-800">{children}</em>,
          blockquote: ({ children }) => (
            <blockquote className="my-4 border-l-4 border-slate-200 pl-4 py-1 italic text-slate-600 bg-slate-50/50 rounded-r-md">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="my-6 overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-sm text-left">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">{children}</thead>,
          th: ({ children }) => <th className="px-4 py-2 font-semibold uppercase text-[10px] tracking-wider">{children}</th>,
          td: ({ children }) => <td className="px-4 py-2 border-b border-slate-100 last:border-0">{children}</td>,
          a: ({ href, children }) => (
            <a href={href} className="text-indigo-600 hover:text-indigo-500 underline underline-offset-4 decoration-indigo-200" target="_blank" rel="noopener">
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

// ─── Content Subsection ──────────────────────────────────────────────────────

function SubsectionView({
  subsection,
  ui,
}: {
  subsection: SpecSubsection
  ui: any
}) {
  return (
    <section id={subsection.id} className="scroll-mt-20">
      <h2 className="mb-4 text-2xl font-bold tracking-tight text-slate-900">
        {subsection.title}
      </h2>

      {subsection.content && (
        <div className="mb-6">
          <MarkdownRenderer content={subsection.content} />
        </div>
      )}

      {subsection.code && <CodeBlock code={subsection.code} className="mb-6" ui={ui} />}

      {subsection.decisions && subsection.decisions.length > 0 && (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50/50 p-5 shadow-sm">
          <h4 className="mb-3 flex items-center gap-2 text-sm font-bold text-emerald-800 uppercase tracking-wider">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-200 text-[10px]">
              ✓
            </span>
            {ui.designDecisions}
          </h4>
          <div className="space-y-4">
            {subsection.decisions.map((d, i) => (
              <div key={i} className="text-emerald-900 prose-compact prose-emerald">
                <MarkdownRenderer content={d} />
              </div>
            ))}
          </div>
        </div>
      )}

      {subsection.notes && subsection.notes.length > 0 && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50/50 p-5 shadow-sm">
          <h4 className="mb-3 flex items-center gap-2 text-sm font-bold text-amber-800 uppercase tracking-wider">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-200 text-[10px]">
              !
            </span>
            {ui.notes}
          </h4>
          <div className="space-y-4">
            {subsection.notes.map((n, i) => (
              <div key={i} className="text-amber-900 prose-compact prose-amber">
                <MarkdownRenderer content={n} />
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

// ─── Type Quick Reference ────────────────────────────────────────────────────

function TypeIndex({ onNavigate, ui, lang }: { onNavigate: (id: string) => void; ui: any; lang: 'en' | 'zh' }) {
  const items = typeIndexData[lang]
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-bold tracking-wider text-slate-900 uppercase">
        {ui.typeRefTitle}
      </h3>
      <div className="space-y-1">
        {items.map(t => (
          <button
            key={t.name}
            onClick={() => onNavigate(t.section)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-indigo-50"
          >
            <code className="shrink-0 text-xs font-semibold text-indigo-600">
              {t.name}
            </code>
            <span className="truncate text-xs text-slate-400">{t.desc}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Alias Matrix Visualization ──────────────────────────────────────────────

const aliasData = [
  { alias: 'chat', input: ['text'], output: ['text'], features: 'multi_turn, system_prompt, stream' },
  { alias: 'vision', input: ['text', 'image'], output: ['text'], features: 'multi_turn, stream' },
  { alias: 'stt', input: ['audio'], output: ['text'], features: '—' },
  { alias: 'tts', input: ['text'], output: ['audio'], features: 'stream' },
  { alias: 'drawing', input: ['text'], output: ['image'], features: '—' },
  { alias: 'img2img', input: ['text', 'image'], output: ['image'], features: '—' },
  { alias: 'embedding', input: ['text'], output: ['embedding'], features: '—' },
  { alias: 'infill', input: ['text'], output: ['text'], features: 'infill' },
  { alias: 'music', input: ['text'], output: ['audio'], features: '—' },
  { alias: 'video_gen', input: ['text'], output: ['video'], features: '—' },
]

const modalityColors: Record<string, string> = {
  text: 'bg-blue-100 text-blue-700 border-blue-200',
  image: 'bg-violet-100 text-violet-700 border-violet-200',
  audio: 'bg-amber-100 text-amber-700 border-amber-200',
  video: 'bg-rose-100 text-rose-700 border-rose-200',
  embedding: 'bg-emerald-100 text-emerald-700 border-emerald-200',
}

function AliasMatrix({ ui }: { ui: any }) {
  const h = ui.matrixHeaders
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/80">
            <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-slate-500 uppercase">
              {h.alias}
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-slate-500 uppercase">
              {h.input}
            </th>
            <th className="px-4 py-3 text-center text-xs font-semibold tracking-wider text-slate-500 uppercase">
              →
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-slate-500 uppercase">
              {h.output}
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-slate-500 uppercase">
              {h.typicalFeatures}
            </th>
          </tr>
        </thead>
        <tbody>
          {aliasData.map((row, i) => (
            <tr
              key={row.alias}
              className={`border-b border-slate-100 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'
                }`}
            >
              <td className="px-4 py-2.5">
                <code className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                  {row.alias}
                </code>
              </td>
              <td className="px-4 py-2.5">
                <div className="flex flex-wrap gap-1.5">
                  {row.input.map(m => (
                    <span
                      key={m}
                      className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${modalityColors[m]}`}
                    >
                      {m}
                    </span>
                  ))}
                </div>
              </td>
              <td className="px-4 py-2.5 text-center text-slate-300">→</td>
              <td className="px-4 py-2.5">
                <div className="flex flex-wrap gap-1.5">
                  {row.output.map(m => (
                    <span
                      key={m}
                      className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${modalityColors[m]}`}
                    >
                      {m}
                    </span>
                  ))}
                </div>
              </td>
              <td className="px-4 py-2.5 text-xs text-slate-500">{row.features}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Error Code Table ────────────────────────────────────────────────────────

function ErrorCodeTable({ ui, lang }: { ui: any; lang: 'en' | 'zh' }) {
  const h = ui.errorHeaders
  const codes = errorCodesData[lang]

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/80">
            <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-slate-500 uppercase">
              {h.code}
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-slate-500 uppercase">
              {h.name}
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-slate-500 uppercase">
              {h.desc}
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-slate-500 uppercase">
              {h.origin}
            </th>
          </tr>
        </thead>
        <tbody>
          {codes.map((e, i) => (
            <tr
              key={e.code}
              className={`border-b border-slate-100 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'
                }`}
            >
              <td className="px-4 py-2.5">
                <code
                  className={`rounded-md px-2 py-0.5 text-xs font-bold ${e.http
                    ? 'bg-blue-50 text-blue-700'
                    : 'bg-purple-50 text-purple-700'
                    }`}
                >
                  {e.code}
                </code>
              </td>
              <td className="px-4 py-2.5 font-mono text-xs text-slate-700">
                {e.name}
              </td>
              <td className="px-4 py-2.5 text-xs text-slate-600">{e.desc}</td>
              <td className="px-4 py-2.5">
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${e.http
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-purple-100 text-purple-700'
                    }`}
                >
                  {e.http ? ui.errorOrigin.http : ui.errorOrigin.ai}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Routing Diagram ─────────────────────────────────────────────────────────

function RoutingDiagram({ ui }: { ui: any }) {
  const d = ui.diagram
  return (
    <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-indigo-50/30 p-6 shadow-sm">
      <h4 className="mb-5 text-sm font-bold text-slate-700">{d.requestFlow}</h4>
      <div className="flex flex-col items-center gap-3">
        {/* Request */}
        <div className="rounded-lg border border-indigo-200 bg-indigo-100 px-6 py-2.5 text-sm font-semibold text-indigo-800 shadow-sm">
          AIRequest: model = "local://Qwen3-8B"
        </div>
        <Arrow />
        {/* Router */}
        <div className="w-full max-w-md rounded-lg border border-slate-300 bg-white p-4 shadow-sm">
          <div className="mb-2 text-center text-xs font-bold tracking-wider text-slate-500 uppercase">
            {d.globalRouter}
          </div>
          <div className="text-center text-xs text-slate-500">
            {d.parseUri}
          </div>
        </div>
        <Arrow />
        {/* Provider Selection */}
        <div className="flex w-full max-w-lg justify-center gap-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-400">
            {d.remote}
          </div>
          <div className="rounded-lg border-2 border-indigo-300 bg-indigo-50 px-4 py-2.5 text-xs font-semibold text-indigo-700 shadow-sm">
            {d.local} ✓
          </div>
        </div>
        <Arrow />
        {/* Engine Selection */}
        <div className="w-full max-w-md rounded-lg border border-slate-300 bg-white p-4 shadow-sm">
          <div className="mb-2 text-center text-xs font-bold tracking-wider text-slate-500 uppercase">
            {d.rulesEngine}
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <span className="rounded-full border-2 border-blue-300 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              llama.cpp ✓
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-400">
              whisper.cpp
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-400">
              sd.cpp
            </span>
          </div>
        </div>
        <Arrow />
        {/* Model Config */}
        <div className="w-full max-w-md rounded-lg border border-slate-300 bg-white p-4 shadow-sm">
          <div className="mb-2 text-center text-xs font-bold tracking-wider text-slate-500 uppercase">
            {d.modelConfig}
          </div>
          <div className="space-y-1 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-mono text-emerald-700">
                ChatML.yaml
              </span>
              <span className="text-slate-400">← {d.baseTemplate}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-mono text-emerald-700">
                Qwen.yaml
              </span>
              <span className="text-slate-400">← {d.extends} ChatML</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-amber-700">
                variant: qwen3
              </span>
              <span className="text-slate-400">
                ← {d.matchedBy} modelPattern
              </span>
            </div>
          </div>
        </div>
        <Arrow />
        {/* Result */}
        <div className="rounded-lg border border-emerald-200 bg-emerald-100 px-6 py-2.5 text-sm font-semibold text-emerald-800 shadow-sm">
          {d.invoke}
        </div>
      </div>
    </div>
  )
}

function Arrow() {
  return (
    <div className="flex h-6 items-center justify-center">
      <svg width="12" height="24" viewBox="0 0 12 24" className="text-slate-400">
        <path d="M6 0 L6 18 M1 14 L6 20 L11 14" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
    </div>
  )
}

// ─── Main App ────────────────────────────────────────────────────────────────

export function App() {
  const [lang, setLang] = useState<'en' | 'zh'>('en')

  const currentSections = lang === 'en' ? specSectionsEn : specSectionsZh
  const currentUi = uiData[lang]

  const [activeId, setActiveId] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SpecSubsection[]>([])
  const [showSearch, setShowSearch] = useState(false)
  const mainRef = useRef<HTMLDivElement>(null)

  // Initialization check to avoid empty activeId
  useEffect(() => {
    if (currentSections.length > 0 && currentSections[0].subsections.length > 0) {
      if (!activeId) setActiveId(currentSections[0].subsections[0].id)
    }
  }, [currentSections, activeId])

  const navigateTo = useCallback((id: string) => {
    setActiveId(id)
    setShowSearch(false)
    setSearchQuery('')
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [])

  // Intersection observer for active section tracking
  useEffect(() => {
    const allSubsections = currentSections.flatMap(s => s.subsections)
    const observer = new IntersectionObserver(
      entries => {
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible.length > 0) {
          setActiveId(visible[0].target.id)
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0 }
    )

    allSubsections.forEach(sub => {
      const el = document.getElementById(sub.id)
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [currentSections])

  // Search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }
    const q = searchQuery.toLowerCase()
    const results = currentSections
      .flatMap(s => s.subsections)
      .filter(
        sub =>
          sub.title.toLowerCase().includes(q) ||
          sub.content.toLowerCase().includes(q) ||
          (sub.code && sub.code.toLowerCase().includes(q))
      )
    setSearchResults(results)
  }, [searchQuery, currentSections])

  // Keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setShowSearch(s => !s)
      }
      if (e.key === 'Escape') {
        setShowSearch(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Find which section a subsection belongs to
  const findSection = (subId: string): SpecSection | undefined =>
    currentSections.find(s => s.subsections.some(sub => sub.id === subId))

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/20">
      <Sidebar
        sections={currentSections}
        activeId={activeId}
        onNavigate={navigateTo}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        ui={currentUi}
      />

      <div className="flex-1 lg:ml-0">
        {/* Top Bar */}
        <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/70 backdrop-blur-xl">
          <div className="flex items-center gap-4 px-6 py-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <div className="relative flex-1 max-w-lg">
              <input
                type="text"
                placeholder={currentUi.searchPlaceholder}
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value)
                  setShowSearch(true)
                }}
                onFocus={() => setShowSearch(true)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-4 py-2 pl-10 text-sm text-slate-700 placeholder-slate-400 focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:outline-none"
              />
              <svg
                className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>

              {showSearch && searchResults.length > 0 && (
                <div className="absolute top-full left-0 mt-2 w-full max-h-96 overflow-y-auto rounded-xl border border-slate-200 bg-white py-2 shadow-xl z-50">
                  {searchResults.slice(0, 10).map(r => (
                    <button
                      key={r.id}
                      onClick={() => navigateTo(r.id)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-indigo-50"
                    >
                      <span className="text-xs text-indigo-500">
                        {findSection(r.id)?.icon}
                      </span>
                      <div>
                        <div className="text-sm font-medium text-slate-700">
                          {r.title}
                        </div>
                        <div className="text-xs text-slate-400">
                          {findSection(r.id)?.title}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setLang('en')}
                className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${lang === 'en' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
              >
                EN
              </button>
              <button
                onClick={() => setLang('zh')}
                className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${lang === 'zh' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
              >
                中文
              </button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main ref={mainRef} className="mx-auto max-w-4xl px-6 py-10 lg:px-12">
          {/* Hero */}
          <div className="mb-16">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-4 py-1.5">
              <span className="h-2 w-2 rounded-full bg-indigo-500" />
              <span className="text-xs font-semibold text-indigo-700">
                {currentUi.draftLabel}
              </span>
            </div>
            <h1 className="mb-4 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
              {currentUi.heroTitle}
            </h1>
            <p className="mb-8 max-w-2xl text-lg leading-relaxed text-slate-600">
              {currentUi.heroDesc}
            </p>
            <div className="flex flex-wrap gap-3">
              {currentUi.heroTags.map(
                (label: string) => (
                  <span
                    key={label}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm"
                  >
                    {label}
                  </span>
                )
              )}
            </div>
          </div>

          {/* Type Quick Reference */}
          <div className="mb-12">
            <TypeIndex onNavigate={navigateTo} ui={currentUi} lang={lang} />
          </div>

          {/* Alias Matrix */}
          <div className="mb-16">
            <h3 className="mb-4 text-lg font-bold text-slate-900">
              {currentUi.aliasMatrixTitle}
            </h3>
            <AliasMatrix ui={currentUi} />
          </div>

          {/* Sections */}
          <div className="space-y-16">
            {currentSections.map(section => (
              <div key={section.id}>
                <div className="mb-8 flex items-center gap-3 border-b border-slate-200 pb-4">
                  <span className="text-2xl">{section.icon}</span>
                  <h2 className="text-xl font-bold text-slate-900">
                    {section.title}
                  </h2>
                </div>
                <div className="space-y-12">
                  {section.subsections.map(sub => (
                    <SubsectionView
                      key={sub.id}
                      subsection={sub}
                      ui={currentUi}
                    />
                  ))}
                </div>

                {/* Insert interactive elements at relevant sections */}
                {section.id === 'routing' && (
                  <div className="mt-10">
                    <h3 className="mb-4 text-lg font-bold text-slate-900">
                      {currentUi.requestFlowTitle}
                    </h3>
                    <RoutingDiagram ui={currentUi} />
                  </div>
                )}
                {section.id === 'errors' && (
                  <div className="mt-10">
                    <h3 className="mb-4 text-lg font-bold text-slate-900">
                      {currentUi.errorTableTitle}
                    </h3>
                    <ErrorCodeTable ui={currentUi} lang={lang} />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Footer */}
          <footer className="mt-20 border-t border-slate-200 pt-8 pb-12">
            <div className="text-center">
              <p className="text-sm text-slate-400">
                {currentUi.footerTitle}
              </p>
              <p className="mt-1 text-xs text-slate-300">
                {currentUi.footerSubtitle}
              </p>
            </div>
          </footer>
        </main>
      </div>
    </div>
  )
}
