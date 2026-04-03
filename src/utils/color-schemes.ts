export interface ThemeTokens {
  [key: string]: string
}

export interface ColorScheme {
  id: string
  name: string
  description: string
  preview: [string, string, string]
  light: ThemeTokens
  dark: ThemeTokens
}

export const colorSchemes: ColorScheme[] = [
  {
    id: 'slate-blue',
    name: 'Slate Blue',
    description: '冷静蓝灰，现代生产力工具感',
    preview: ['#2563eb', '#e8eef9', '#0f172a'],
    light: {
      '--bg-primary': '#f6f8fb',
      '--bg-secondary': '#eef2f7',
      '--bg-tertiary': '#e5ebf3',
      '--bg-editor': '#f8fbff',
      '--bg-preview': '#ffffff',
      '--bg-toolbar': '#f4f7fb',
      '--bg-elevated': '#ffffff',
      '--bg-code': '#f2f6fb',
      '--bg-blockquote': '#f3f7fc',
      '--text-primary': '#0f172a',
      '--text-secondary': '#334155',
      '--text-muted': '#64748b',
      '--text-inverse': '#f8fafc',
      '--border-color': '#dbe4ee',
      '--border-light': '#e8eef5',
      '--border-strong': '#c5d2e0',
      '--accent': '#2563eb',
      '--accent-hover': '#1d4ed8',
      '--accent-soft': '#dbeafe',
      '--accent-contrast': '#eff6ff',
      '--link-color': '#1d4ed8',
      '--shadow-sm': '0 1px 2px rgba(15, 23, 42, 0.06)',
      '--shadow-md': '0 8px 24px rgba(15, 23, 42, 0.08)',
      '--shadow-lg': '0 18px 40px rgba(15, 23, 42, 0.10)',
      '--scrollbar-bg': '#e5ebf3',
      '--scrollbar-thumb': '#b8c4d6',
    },
    dark: {
      '--bg-primary': '#0b1220',
      '--bg-secondary': '#111827',
      '--bg-tertiary': '#172033',
      '--bg-editor': '#0f172a',
      '--bg-preview': '#111827',
      '--bg-toolbar': '#0f172a',
      '--bg-elevated': '#162033',
      '--bg-code': '#111a2b',
      '--bg-blockquote': '#101b2d',
      '--text-primary': '#e5edf7',
      '--text-secondary': '#b6c2d2',
      '--text-muted': '#7f8ea3',
      '--text-inverse': '#08111f',
      '--border-color': '#243247',
      '--border-light': '#1b2638',
      '--border-strong': '#33445e',
      '--accent': '#6ea8fe',
      '--accent-hover': '#93c5fd',
      '--accent-soft': '#1d3557',
      '--accent-contrast': '#eff6ff',
      '--link-color': '#8ec5ff',
      '--shadow-sm': '0 1px 2px rgba(0, 0, 0, 0.28)',
      '--shadow-md': '0 10px 28px rgba(0, 0, 0, 0.35)',
      '--shadow-lg': '0 18px 40px rgba(0, 0, 0, 0.42)',
      '--scrollbar-bg': '#172033',
      '--scrollbar-thumb': '#33445e',
    },
  },
  {
    id: 'graphite-cyan',
    name: 'Graphite Cyan',
    description: '石墨青蓝，专业编辑器 / IDE 感',
    preview: ['#06b6d4', '#ddeff2', '#111827'],
    light: {
      '--bg-primary': '#f4f7f8',
      '--bg-secondary': '#eaf0f2',
      '--bg-tertiary': '#dde6e9',
      '--bg-editor': '#f7fbfc',
      '--bg-preview': '#ffffff',
      '--bg-toolbar': '#f3f7f8',
      '--bg-elevated': '#ffffff',
      '--bg-code': '#eef5f7',
      '--bg-blockquote': '#eef7f8',
      '--text-primary': '#111827',
      '--text-secondary': '#374151',
      '--text-muted': '#6b7280',
      '--text-inverse': '#f9fafb',
      '--border-color': '#d5e0e4',
      '--border-light': '#e5ecef',
      '--border-strong': '#b8c9cf',
      '--accent': '#0891b2',
      '--accent-hover': '#0e7490',
      '--accent-soft': '#cffafe',
      '--accent-contrast': '#ecfeff',
      '--link-color': '#0e7490',
      '--shadow-sm': '0 1px 2px rgba(17, 24, 39, 0.05)',
      '--shadow-md': '0 8px 22px rgba(17, 24, 39, 0.08)',
      '--shadow-lg': '0 16px 36px rgba(17, 24, 39, 0.10)',
      '--scrollbar-bg': '#e5ecef',
      '--scrollbar-thumb': '#b9c9cf',
    },
    dark: {
      '--bg-primary': '#0d141b',
      '--bg-secondary': '#131c24',
      '--bg-tertiary': '#1b2832',
      '--bg-editor': '#101922',
      '--bg-preview': '#131c24',
      '--bg-toolbar': '#101922',
      '--bg-elevated': '#18232d',
      '--bg-code': '#12202a',
      '--bg-blockquote': '#10212a',
      '--text-primary': '#e6eef5',
      '--text-secondary': '#b7c5d1',
      '--text-muted': '#8092a3',
      '--text-inverse': '#0b141b',
      '--border-color': '#243543',
      '--border-light': '#1a2934',
      '--border-strong': '#355062',
      '--accent': '#22d3ee',
      '--accent-hover': '#67e8f9',
      '--accent-soft': '#164e63',
      '--accent-contrast': '#ecfeff',
      '--link-color': '#67e8f9',
      '--shadow-sm': '0 1px 2px rgba(0, 0, 0, 0.28)',
      '--shadow-md': '0 10px 28px rgba(0, 0, 0, 0.35)',
      '--shadow-lg': '0 18px 40px rgba(0, 0, 0, 0.42)',
      '--scrollbar-bg': '#1b2832',
      '--scrollbar-thumb': '#355062',
    },
  },
  {
    id: 'mist-violet',
    name: 'Mist Violet',
    description: '雾紫夜色，科技感更强但保持克制',
    preview: ['#8b5cf6', '#efe7ff', '#151226'],
    light: {
      '--bg-primary': '#f7f7fb',
      '--bg-secondary': '#f0eef8',
      '--bg-tertiary': '#e8e4f4',
      '--bg-editor': '#faf9ff',
      '--bg-preview': '#ffffff',
      '--bg-toolbar': '#f6f4fb',
      '--bg-elevated': '#ffffff',
      '--bg-code': '#f4f1fb',
      '--bg-blockquote': '#f5f1ff',
      '--text-primary': '#1f1637',
      '--text-secondary': '#4c3f67',
      '--text-muted': '#7c7391',
      '--text-inverse': '#faf7ff',
      '--border-color': '#e0daf0',
      '--border-light': '#ede8f8',
      '--border-strong': '#cbc1e3',
      '--accent': '#7c3aed',
      '--accent-hover': '#6d28d9',
      '--accent-soft': '#ede9fe',
      '--accent-contrast': '#f5f3ff',
      '--link-color': '#6d28d9',
      '--shadow-sm': '0 1px 2px rgba(31, 22, 55, 0.05)',
      '--shadow-md': '0 8px 22px rgba(31, 22, 55, 0.09)',
      '--shadow-lg': '0 16px 36px rgba(31, 22, 55, 0.12)',
      '--scrollbar-bg': '#ede8f8',
      '--scrollbar-thumb': '#c9bfe2',
    },
    dark: {
      '--bg-primary': '#100d1a',
      '--bg-secondary': '#171326',
      '--bg-tertiary': '#221b36',
      '--bg-editor': '#130f21',
      '--bg-preview': '#171326',
      '--bg-toolbar': '#130f21',
      '--bg-elevated': '#1d1730',
      '--bg-code': '#19132a',
      '--bg-blockquote': '#1a1430',
      '--text-primary': '#eee8ff',
      '--text-secondary': '#cabfe6',
      '--text-muted': '#9f96bb',
      '--text-inverse': '#120f1f',
      '--border-color': '#31264a',
      '--border-light': '#241b38',
      '--border-strong': '#473767',
      '--accent': '#a78bfa',
      '--accent-hover': '#c4b5fd',
      '--accent-soft': '#312e81',
      '--accent-contrast': '#f5f3ff',
      '--link-color': '#c4b5fd',
      '--shadow-sm': '0 1px 2px rgba(0, 0, 0, 0.30)',
      '--shadow-md': '0 10px 28px rgba(0, 0, 0, 0.38)',
      '--shadow-lg': '0 18px 40px rgba(0, 0, 0, 0.45)',
      '--scrollbar-bg': '#221b36',
      '--scrollbar-thumb': '#473767',
    },
  },
  {
    id: 'warm-paper',
    name: 'Warm Paper',
    description: '暖灰米白，更适合长文阅读和预览排版',
    preview: ['#b45309', '#f7efe3', '#3f2d1d'],
    light: {
      '--bg-primary': '#faf8f4',
      '--bg-secondary': '#f5f0e8',
      '--bg-tertiary': '#ede5d9',
      '--bg-editor': '#fcfaf7',
      '--bg-preview': '#fffdf9',
      '--bg-toolbar': '#f8f3eb',
      '--bg-elevated': '#fffdf9',
      '--bg-code': '#f4ede4',
      '--bg-blockquote': '#f7efe5',
      '--text-primary': '#33261a',
      '--text-secondary': '#5b4635',
      '--text-muted': '#8a7663',
      '--text-inverse': '#fffaf2',
      '--border-color': '#e4d8c8',
      '--border-light': '#efe7dc',
      '--border-strong': '#cfbca6',
      '--accent': '#b45309',
      '--accent-hover': '#92400e',
      '--accent-soft': '#ffedd5',
      '--accent-contrast': '#fff7ed',
      '--link-color': '#92400e',
      '--shadow-sm': '0 1px 2px rgba(51, 38, 26, 0.05)',
      '--shadow-md': '0 8px 20px rgba(51, 38, 26, 0.08)',
      '--shadow-lg': '0 16px 34px rgba(51, 38, 26, 0.10)',
      '--scrollbar-bg': '#efe7dc',
      '--scrollbar-thumb': '#ccb79e',
    },
    dark: {
      '--bg-primary': '#17120d',
      '--bg-secondary': '#201913',
      '--bg-tertiary': '#2b2119',
      '--bg-editor': '#1a140f',
      '--bg-preview': '#201913',
      '--bg-toolbar': '#1a140f',
      '--bg-elevated': '#241c15',
      '--bg-code': '#221910',
      '--bg-blockquote': '#261c12',
      '--text-primary': '#f3eadf',
      '--text-secondary': '#d4c3b0',
      '--text-muted': '#a9927f',
      '--text-inverse': '#1a140f',
      '--border-color': '#3b2f24',
      '--border-light': '#2a2119',
      '--border-strong': '#574638',
      '--accent': '#f59e0b',
      '--accent-hover': '#fbbf24',
      '--accent-soft': '#78350f',
      '--accent-contrast': '#fff7ed',
      '--link-color': '#fdba74',
      '--shadow-sm': '0 1px 2px rgba(0, 0, 0, 0.28)',
      '--shadow-md': '0 10px 28px rgba(0, 0, 0, 0.35)',
      '--shadow-lg': '0 18px 40px rgba(0, 0, 0, 0.42)',
      '--scrollbar-bg': '#2b2119',
      '--scrollbar-thumb': '#574638',
    },
  },
]

export function applyColorScheme(scheme: ColorScheme, theme: 'light' | 'dark') {
  const vars = theme === 'dark' ? scheme.dark : scheme.light
  const root = document.documentElement
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value)
  }
}

export function applyCustomColor(hex: string, theme: 'light' | 'dark') {
  const root = document.documentElement
  const hoverHex = darken(hex, 12)
  const softHex = theme === 'dark' ? darken(hex, 55) : lighten(hex, 86)
  const contrastHex = theme === 'dark' ? '#f8fafc' : '#eff6ff'
  root.style.setProperty('--accent', hex)
  root.style.setProperty('--accent-hover', hoverHex)
  root.style.setProperty('--accent-soft', softHex)
  root.style.setProperty('--accent-contrast', contrastHex)
  root.style.setProperty('--link-color', theme === 'dark' ? lighten(hex, 18) : hoverHex)
}

function hexToRgb(hex: string) {
  const h = hex.replace('#', '')
  return { r: parseInt(h.substring(0, 2), 16), g: parseInt(h.substring(2, 4), 16), b: parseInt(h.substring(4, 6), 16) }
}

function rgbToHex(r: number, g: number, b: number) {
  return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')
}

function darken(hex: string, pct: number) {
  const { r, g, b } = hexToRgb(hex)
  const f = 1 - pct / 100
  return rgbToHex(r * f, g * f, b * f)
}

function lighten(hex: string, pct: number) {
  const { r, g, b } = hexToRgb(hex)
  const f = pct / 100
  return rgbToHex(r + (255 - r) * f, g + (255 - g) * f, b + (255 - b) * f)
}

export function getSchemeById(id: string): ColorScheme {
  const legacySchemeMap: Record<string, string> = {
    'geek-blue': 'slate-blue',
    'wechat-green': 'graphite-cyan',
    'zhihu-blue': 'mist-violet',
    'juejin-blue': 'warm-paper',
    'github-dark': 'slate-blue',
    'elegant-purple': 'mist-violet',
    'warm-orange': 'warm-paper',
    'rose-red': 'mist-violet',
    'ink-grey': 'slate-blue',
    'forest-green': 'graphite-cyan',
  }
  const normalizedId = legacySchemeMap[id] || id
  return colorSchemes.find((s) => s.id === normalizedId) || colorSchemes[0]
}

export function getCurrentAccent(schemeId: string, theme: 'light' | 'dark', customAccent: string): string {
  if (schemeId === 'custom') return customAccent
  const scheme = getSchemeById(schemeId)
  const vars = theme === 'dark' ? scheme.dark : scheme.light
  return vars['--accent'] || '#2563eb'
}
