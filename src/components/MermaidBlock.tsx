import { useEffect, useRef, useState } from 'react'
import mermaid from 'mermaid'

let mermaidIdCounter = 0

function initMermaid(isDark: boolean) {
  mermaid.initialize({
    startOnLoad: false,
    theme: isDark ? 'dark' : 'default',
    securityLevel: 'loose',
    fontFamily: 'system-ui, sans-serif',
  })
}

export function MermaidBlock({ code, isDark }: { code: string; isDark: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [svg, setSvg] = useState('')

  useEffect(() => {
    if (!code.trim()) return
    initMermaid(isDark)

    const id = `mermaid-${++mermaidIdCounter}`
    let cancelled = false

    mermaid.render(id, code.trim()).then(
      ({ svg: rendered }) => {
        if (!cancelled) { setSvg(rendered); setError(null) }
      },
      (err) => {
        if (!cancelled) {
          setError(String(err?.message || err))
          setSvg('')
        }
        const el = document.getElementById('d' + id)
        el?.remove()
      },
    )

    return () => { cancelled = true }
  }, [code, isDark])

  if (error) {
    return (
      <div className="mermaid-error">
        <div className="mermaid-error-title">Mermaid 解析错误</div>
        <pre className="mermaid-error-msg">{error}</pre>
        <pre className="mermaid-error-src">{code}</pre>
      </div>
    )
  }

  return <div ref={ref} className="mermaid-rendered" dangerouslySetInnerHTML={{ __html: svg }} />
}
