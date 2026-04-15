import { create } from 'zustand'
import { sampleMarkdown } from './sample'
import type { LocalMediaKind, LocalMediaRecord, PersistedLocalMediaRecord, RelativeMediaEntry } from './media'
import { blobToDataUrl, buildLocalMediaSrc, LOCAL_MEDIA_STORAGE_KEY, RELATIVE_MEDIA_STORAGE_KEY } from './media'

export type FormatType = 'default' | 'wechat' | 'toutiao' | 'mobile'
export type ThemeType = 'light' | 'dark'

export interface InsertResult {
  line: number
  insertedAt: 'cursor' | 'end'
}

type EditorInsertHandler = ((snippet: string) => InsertResult | null) | null

interface AppState {
  markdown: string
  html: string
  format: FormatType
  theme: ThemeType
  colorSchemeId: string
  customAccent: string
  enableDeAI: boolean
  localMediaMap: Record<string, LocalMediaRecord>
  relativeMediaMap: Record<string, RelativeMediaEntry>
  setMarkdown: (md: string) => void
  setHtml: (html: string) => void
  setFormat: (f: FormatType) => void
  toggleTheme: () => void
  setColorScheme: (id: string) => void
  setCustomAccent: (color: string) => void
  setEnableDeAI: (enable: boolean) => void
  setEditorInsertHandler: (handler: EditorInsertHandler) => void
  insertSnippet: (snippet: string) => InsertResult | null
  registerLocalMedia: (file: File, kind: LocalMediaKind) => LocalMediaRecord
  setRelativeMediaEntries: (entries: RelativeMediaEntry[]) => void
}

const savedTheme = (typeof window !== 'undefined'
  ? localStorage.getItem('md-theme')
  : null) as ThemeType | null

const savedMarkdown = typeof window !== 'undefined'
  ? localStorage.getItem('md-content')
  : null

const savedScheme = typeof window !== 'undefined'
  ? localStorage.getItem('md-color-scheme')
  : null

const savedCustomAccent = typeof window !== 'undefined'
  ? localStorage.getItem('md-custom-accent')
  : null

const savedDeAI = typeof window !== 'undefined'
  ? localStorage.getItem('md-deai') === 'true'
  : false

let editorInsertHandler: EditorInsertHandler = null

function readRelativeMediaEntries(): Record<string, RelativeMediaEntry> {
  if (typeof localStorage === 'undefined') return {}

  try {
    const raw = localStorage.getItem(RELATIVE_MEDIA_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as RelativeMediaEntry[]
    return Object.fromEntries(parsed.map((entry) => [entry.path, entry]))
  } catch {
    return {}
  }
}

async function persistLocalMedia(record: LocalMediaRecord) {
  if (typeof localStorage === 'undefined') return

  try {
    const dataUrl = await blobToDataUrl(record.file)
    const raw = localStorage.getItem(LOCAL_MEDIA_STORAGE_KEY)
    const existing = raw ? JSON.parse(raw) as PersistedLocalMediaRecord[] : []
    const next = [
      ...existing.filter((item) => item.id !== record.id),
      {
        id: record.id,
        kind: record.kind,
        name: record.name,
        type: record.type,
        size: record.size,
        dataUrl,
      },
    ]
    localStorage.setItem(LOCAL_MEDIA_STORAGE_KEY, JSON.stringify(next))
  } catch {
    // ignore persistence failures; in-session preview still works
  }
}

export const useStore = create<AppState>((set) => ({
  markdown: savedMarkdown || sampleMarkdown,
  html: '',
  format: 'default',
  theme: savedTheme || 'light',
  colorSchemeId: savedScheme || 'geek-blue',
  customAccent: savedCustomAccent || '#6366f1',
  enableDeAI: savedDeAI,
  localMediaMap: {},
  relativeMediaMap: readRelativeMediaEntries(),
  setMarkdown: (md) => {
    localStorage.setItem('md-content', md)
    set({ markdown: md })
  },
  setHtml: (html) => set({ html }),
  setFormat: (f) => set({ format: f }),
  toggleTheme: () =>
    set((s) => {
      const next = s.theme === 'light' ? 'dark' : 'light'
      localStorage.setItem('md-theme', next)
      return { theme: next }
    }),
  setColorScheme: (id) => {
    localStorage.setItem('md-color-scheme', id)
    set({ colorSchemeId: id })
  },
  setCustomAccent: (color) => {
    localStorage.setItem('md-custom-accent', color)
    set({ customAccent: color, colorSchemeId: 'custom' })
    localStorage.setItem('md-color-scheme', 'custom')
  },
  setEnableDeAI: (enable) => {
    localStorage.setItem('md-deai', String(enable))
    set({ enableDeAI: enable })
  },
  setEditorInsertHandler: (handler) => {
    editorInsertHandler = handler
  },
  insertSnippet: (snippet) => editorInsertHandler ? editorInsertHandler(snippet) : null,
  registerLocalMedia: (file, kind) => {
    const id = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${kind}-${Date.now()}`
    const record: LocalMediaRecord = {
      id,
      kind,
      name: file.name,
      type: file.type,
      size: file.size,
      objectUrl: URL.createObjectURL(file),
      file,
    }

    set((state) => ({
      localMediaMap: {
        ...state.localMediaMap,
        [record.id]: record,
      },
    }))

    void persistLocalMedia(record)

    return {
      ...record,
      objectUrl: buildLocalMediaSrc(record.id),
    }
  },
  setRelativeMediaEntries: (entries) => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(RELATIVE_MEDIA_STORAGE_KEY, JSON.stringify(entries))
    }
    set({
      relativeMediaMap: Object.fromEntries(entries.map((entry) => [entry.path, entry])),
    })
  },
}))
