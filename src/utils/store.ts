import { create } from 'zustand'
import { sampleMarkdown } from './sample'

export type FormatType = 'default' | 'wechat' | 'toutiao' | 'mobile'
export type ThemeType = 'light' | 'dark'

interface AppState {
  markdown: string
  html: string
  format: FormatType
  theme: ThemeType
  colorSchemeId: string
  customAccent: string
  enableDeAI: boolean
  setMarkdown: (md: string) => void
  setHtml: (html: string) => void
  setFormat: (f: FormatType) => void
  toggleTheme: () => void
  setColorScheme: (id: string) => void
  setCustomAccent: (color: string) => void
  setEnableDeAI: (enable: boolean) => void
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

export const useStore = create<AppState>((set) => ({
  markdown: savedMarkdown || sampleMarkdown,
  html: '',
  format: 'default',
  theme: savedTheme || 'light',
  colorSchemeId: savedScheme || 'geek-blue',
  customAccent: savedCustomAccent || '#6366f1',
  enableDeAI: savedDeAI,
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
}))
