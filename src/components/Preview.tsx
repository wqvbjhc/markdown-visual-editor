import { useEffect, useRef, useCallback } from 'react'
import { useStore } from '@/utils/store'
import { MermaidBlock } from './MermaidBlock'
import { CodeBlock } from './CodeBlock'
import { createRoot } from 'react-dom/client'
import { applyWechatStyles } from '@/formats/wechat'
import { applyToutiaoStyles } from '@/formats/toutiao'
import { getCurrentAccent } from '@/utils/color-schemes'
import { hydrateLocalMedia } from '@/utils/media'

export function Preview() {
  const { html, format, theme, colorSchemeId, customAccent, localMediaMap, relativeMediaMap } = useStore()
  const containerRef = useRef<HTMLDivElement>(null)
  const rootsRef = useRef(new Set<ReturnType<typeof createRoot>>())
  const renderSeqRef = useRef(0)
  const isDark = theme === 'dark'
  const accent = getCurrentAccent(colorSchemeId, theme, customAccent)

  const renderContent = useCallback(async () => {
    const el = containerRef.current
    if (!el) return
    const seq = ++renderSeqRef.current

    let content = html
    if (format === 'wechat') content = applyWechatStyles(html, accent)
    else if (format === 'toutiao') content = applyToutiaoStyles(html, accent)

    // 释放上轮 createRoot 的 fiber：innerHTML 仅 detach 旧 DOM，不 unmount root 则 fiber 常驻致每次渲染累积泄漏
    for (const r of rootsRef.current) r.unmount()
    rootsRef.current.clear()

    el.innerHTML = content
    await hydrateLocalMedia(el, localMediaMap)
    // 旧 render 被 newer 抢则弃，防 stale closure 在新 DOM 上重复 mount
    if (seq !== renderSeqRef.current) return

    el.querySelectorAll<HTMLElement>('.mermaid-block').forEach((block) => {
      const code = block.getAttribute('data-mermaid') || block.textContent || ''
      block.textContent = ''
      const root = createRoot(block)
      rootsRef.current.add(root)
      root.render(<MermaidBlock code={code} isDark={isDark} />)
    })

    el.querySelectorAll<HTMLElement>('pre > code').forEach((codeEl) => {
      const pre = codeEl.parentElement!
      const classes = Array.from(codeEl.classList)
      const langClass = classes.find((c) => c.startsWith('language-'))
      const lang = langClass ? langClass.replace('language-', '') : ''
      if (lang === 'mermaid') return
      const code = codeEl.textContent || ''
      const wrapper = document.createElement('div')
      pre.replaceWith(wrapper)
      const root = createRoot(wrapper)
      rootsRef.current.add(root)
      root.render(<CodeBlock code={code} lang={lang} isDark={isDark} />)
    })
  }, [html, format, isDark, accent, localMediaMap, relativeMediaMap])

  useEffect(() => {
    void renderContent()
  }, [renderContent])

  useEffect(() => {
    return () => {
      for (const r of rootsRef.current) r.unmount()
      rootsRef.current.clear()
    }
  }, [])

  const wrapperClass = format === 'mobile'
    ? 'mobile-frame'
    : 'preview-content'

  return (
    <div className="preview-pane">
      <div ref={containerRef} className={`${wrapperClass} prose-container`} />
    </div>
  )
}
