import { useEffect, useRef, useCallback } from 'react'
import { useStore } from '@/utils/store'
import { processMarkdown } from '@/pipeline/processor'
import { MarkdownEditor } from '@/components/Editor'
import { Preview } from '@/components/Preview'
import { Toolbar } from '@/components/Toolbar'
import { applyColorScheme, applyCustomColor, getSchemeById } from '@/utils/color-schemes'

export default function App() {
  const { markdown, setHtml, theme, colorSchemeId, customAccent, enableDeAI } = useStore()
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    if (colorSchemeId === 'custom') {
      applyCustomColor(customAccent, theme)
      return
    }

    applyColorScheme(getSchemeById(colorSchemeId), theme)
  }, [theme, colorSchemeId, customAccent])

  const renderMarkdown = useCallback(async (md: string, deAI: boolean) => {
    try {
      const html = await processMarkdown(md, deAI)
      setHtml(html)
    } catch (e) {
      console.error('Markdown processing error:', e)
    }
  }, [setHtml])

  useEffect(() => {
    clearTimeout(timerRef.current)

    if (!markdown) {
      setHtml('')
      return
    }

    timerRef.current = setTimeout(() => renderMarkdown(markdown, enableDeAI), 200)
    return () => clearTimeout(timerRef.current)
  }, [markdown, enableDeAI, renderMarkdown, setHtml])

  return (
    <div className="app-layout">
      <Toolbar />
      <div className="main-content">
        <div className="editor-pane">
          <MarkdownEditor />
        </div>
        <Preview />
      </div>
    </div>
  )
}
