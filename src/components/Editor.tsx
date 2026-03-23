import { useEffect, useRef } from 'react'
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { markdown } from '@codemirror/lang-markdown'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search'
import { oneDark } from '@codemirror/theme-one-dark'
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching } from '@codemirror/language'
import { useStore } from '@/utils/store'

const lightTheme = EditorView.theme({
  '&': { height: '100%', fontSize: '14px' },
  '.cm-scroller': { overflow: 'auto', fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace" },
  '.cm-content': { padding: '16px 0' },
  '.cm-gutters': { backgroundColor: 'transparent', borderRight: '1px solid #e5e7eb' },
})

const darkThemeExt = EditorView.theme({
  '&': { height: '100%', fontSize: '14px' },
  '.cm-scroller': { overflow: 'auto', fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace" },
  '.cm-content': { padding: '16px 0' },
})

export function MarkdownEditor() {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const { markdown: md, setMarkdown, theme } = useStore()

  useEffect(() => {
    if (!containerRef.current) return

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        setMarkdown(update.state.doc.toString())
      }
    })

    const extensions = [
      lineNumbers(),
      highlightActiveLine(),
      highlightActiveLineGutter(),
      bracketMatching(),
      highlightSelectionMatches(),
      history(),
      markdown(),
      keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
      updateListener,
      EditorView.lineWrapping,
    ]

    if (theme === 'dark') {
      extensions.push(oneDark, darkThemeExt)
    } else {
      extensions.push(syntaxHighlighting(defaultHighlightStyle), lightTheme)
    }

    const state = EditorState.create({
      doc: md,
      extensions,
    })

    if (viewRef.current) viewRef.current.destroy()
    viewRef.current = new EditorView({ state, parent: containerRef.current })

    return () => { viewRef.current?.destroy() }
  }, [theme]) // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={containerRef} className="h-full overflow-hidden" />
}
