import { useEffect, useState } from 'react'
import mermaid from 'mermaid'

/**
 * 渲染 mermaid 源码 → { svg, error }。inline 预览与放大 modal 共用，消除重复渲染逻辑。
 *
 * useMaxWidth 透传到 mermaid 的 flowchart.useMaxWidth：
 *   - 不传（undefined）：沿用 mermaid 默认 true，inline「缩到容器宽」现状不变。
 *   - false：modal 用，让 mermaid 出显式 px 宽，图有具体尺寸可供 transform 缩放。
 *
 * mermaid 单例坑（同 src/utils/mermaid-png.ts）：Preview 的 MermaidBlock 每次渲染都
 *   mermaid.initialize 重置配置，故本 hook 每次 render 前都重设，不缓存「已 init」标志。
 */

let mermaidSvgIdCounter = 0

export function useMermaidSvg(
  code: string,
  isDark: boolean,
  opts?: { useMaxWidth?: boolean },
): { svg: string; error: string | null } {
  const [svg, setSvg] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const trimmed = code.trim()
    if (!trimmed) return
    let cancelled = false

    mermaid.initialize({
      startOnLoad: false,
      theme: isDark ? 'dark' : 'default',
      securityLevel: 'loose',
      fontFamily: 'system-ui, sans-serif',
      ...(opts?.useMaxWidth === false ? { flowchart: { useMaxWidth: false } } : {}),
    })

    const id = `mermaid-svg-${++mermaidSvgIdCounter}`
    mermaid.render(id, trimmed).then(
      ({ svg: rendered }) => {
        // mermaid v10+ 临时测量 svg 用 id 自身；v9 用 d{id}。两者都清防 DOM 残留
        document.getElementById(id)?.remove()
        document.getElementById('d' + id)?.remove()
        if (!cancelled) { setSvg(rendered); setError(null) }
      },
      (err) => {
        document.getElementById(id)?.remove()
        document.getElementById('d' + id)?.remove()
        if (!cancelled) { setError(String(err?.message || err)); setSvg('') }
      },
    )

    return () => { cancelled = true }
  }, [code, isDark, opts?.useMaxWidth])

  return { svg, error }
}
