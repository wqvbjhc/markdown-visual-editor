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
  const lastAnchorRef = useRef<number | null>(null)
  const { markdown: md, setMarkdown, theme, setEditorInsertHandler } = useStore()

  useEffect(() => {
    if (!containerRef.current) return

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        setMarkdown(update.state.doc.toString())
      }

      if (update.selectionSet) {
        lastAnchorRef.current = update.state.selection.main.head
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

    setEditorInsertHandler((snippet: string) => {
      const view = viewRef.current
      if (!view) return null

      const lastAnchor = lastAnchorRef.current
      const shouldAppend = lastAnchor === null
      const selection = shouldAppend
        ? { from: view.state.doc.length, to: view.state.doc.length }
        : view.state.selection.main
      const insertFrom = selection.from
      const line = view.state.doc.lineAt(insertFrom).number

      view.dispatch({
        changes: {
          from: selection.from,
          to: selection.to,
          insert: snippet,
        },
        selection: {
          anchor: selection.from,
          head: selection.from + snippet.length,
        },
        effects: EditorView.scrollIntoView(selection.from, { y: 'center' }),
      })

      lastAnchorRef.current = selection.from + snippet.length
      view.focus()

      return {
        line,
        insertedAt: shouldAppend ? 'end' : 'cursor',
      }
    })

    return () => {
      setEditorInsertHandler(null)
      viewRef.current?.destroy()
    }
  }, [theme]) // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={containerRef} className="h-full overflow-hidden" />
}
