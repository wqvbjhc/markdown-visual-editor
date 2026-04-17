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
  const isDark = theme === 'dark'
  const accent = getCurrentAccent(colorSchemeId, theme, customAccent)

  const renderContent = useCallback(async () => {
    const el = containerRef.current
    if (!el) return

    let content = html
    if (format === 'wechat') content = applyWechatStyles(html, accent)
    else if (format === 'toutiao') content = applyToutiaoStyles(html, accent)

    el.innerHTML = content
    await hydrateLocalMedia(el, localMediaMap)

    el.querySelectorAll<HTMLElement>('.mermaid-block').forEach((block) => {
      const code = block.getAttribute('data-mermaid') || block.textContent || ''
      block.textContent = ''
      const root = createRoot(block)
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
      root.render(<CodeBlock code={code} lang={lang} isDark={isDark} />)
    })
  }, [html, format, isDark, accent, localMediaMap, relativeMediaMap])

  useEffect(() => {
    void renderContent()
  }, [renderContent])

  const wrapperClass = format === 'mobile'
    ? 'mobile-frame'
    : 'preview-content'

  return (
    <div className="preview-pane">
      <div ref={containerRef} className={`${wrapperClass} prose-container`} />
    </div>
  )
}
