import { useEffect, useState } from 'react'
import { codeToHtml } from 'shiki'

interface Props {
  code: string
  lang: string
  isDark: boolean
}

export function normalizeCodeBlockText(code: string) {
  return code.endsWith('\n') ? code.slice(0, -1) : code
}

export function getCodeBlockLines(code: string) {
  return normalizeCodeBlockText(code).split('\n')
}

export function CodeBlock({ code, lang, isDark }: Props) {
  const [html, setHtml] = useState('')
  const [copied, setCopied] = useState(false)
  const normalizedCode = normalizeCodeBlockText(code)

  useEffect(() => {
    let cancelled = false
    codeToHtml(normalizedCode, {
      lang: lang || 'text',
      theme: isDark ? 'github-dark' : 'github-light',
    })
      .then((result) => { if (!cancelled) setHtml(result) })
      .catch(() => { if (!cancelled) setHtml(`<pre><code>${escapeHtml(normalizedCode)}</code></pre>`) })
    return () => { cancelled = true }
  }, [normalizedCode, lang, isDark])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(normalizedCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const lines = getCodeBlockLines(normalizedCode)

  return (
    <div className="code-block-wrapper">
      <div className="code-block-header">
        <span className="code-block-lang">{lang || 'text'}</span>
        <button onClick={handleCopy} className="code-block-copy" title="复制代码">
          {copied ? '✓ 已复制' : '复制'}
        </button>
      </div>
      <div className="code-block-body">
        <div className="code-block-lines" aria-hidden="true">
          {lines.map((_, i) => (
            <span key={i}>{i + 1}</span>
          ))}
        </div>
        <div className="code-block-content" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </div>
  )
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
