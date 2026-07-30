import { useState } from 'react'
import { useMermaidSvg } from '@/hooks/useMermaidSvg'
import { MermaidZoomModal } from './MermaidZoomModal'

export function MermaidBlock({ code, isDark }: { code: string; isDark: boolean }) {
  const { svg, error } = useMermaidSvg(code, isDark)
  const [open, setOpen] = useState(false)

  // hooks 在前，错误态早返在其后（hooks 调用顺序稳定，不违反 rules of hooks）
  if (error) {
    return (
      <div className="mermaid-error">
        <div className="mermaid-error-title">Mermaid 解析错误</div>
        <pre className="mermaid-error-msg">{error}</pre>
        <pre className="mermaid-error-src">{code}</pre>
      </div>
    )
  }

  return (
    <>
      <div
        className="mermaid-rendered"
        title="点击放大"
        onClick={() => setOpen(true)}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      {open && <MermaidZoomModal code={code} isDark={isDark} onClose={() => setOpen(false)} />}
    </>
  )
}
