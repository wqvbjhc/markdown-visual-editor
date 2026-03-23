export interface ColorScheme {
  id: string
  name: string
  light: Record<string, string>
  dark: Record<string, string>
}

export const colorSchemes: ColorScheme[] = [
  {
    id: 'geek-blue',
    name: '极客蓝',
    light: {
      '--accent': '#2563eb',
      '--accent-hover': '#1d4ed8',
      '--accent-light': '#dbeafe',
      '--link-color': '#1d4ed8',
    },
    dark: {
      '--accent': '#60a5fa',
      '--accent-hover': '#93bbfd',
      '--accent-light': '#172554',
      '--link-color': '#60a5fa',
    },
  },
  {
    id: 'wechat-green',
    name: '微信绿',
    light: {
      '--accent': '#07c160',
      '--accent-hover': '#06ae56',
      '--accent-light': '#d5f5e3',
      '--link-color': '#06ae56',
    },
    dark: {
      '--accent': '#2dc76d',
      '--accent-hover': '#5dd692',
      '--accent-light': '#052e16',
      '--link-color': '#2dc76d',
    },
  },
  {
    id: 'zhihu-blue',
    name: '知乎蓝',
    light: {
      '--accent': '#0066ff',
      '--accent-hover': '#0052cc',
      '--accent-light': '#e6f0ff',
      '--link-color': '#0052cc',
    },
    dark: {
      '--accent': '#4d94ff',
      '--accent-hover': '#80b3ff',
      '--accent-light': '#001a4d',
      '--link-color': '#4d94ff',
    },
  },
  {
    id: 'juejin-blue',
    name: '掘金蓝',
    light: {
      '--accent': '#1e80ff',
      '--accent-hover': '#0066e6',
      '--accent-light': '#e0f0ff',
      '--link-color': '#0066e6',
    },
    dark: {
      '--accent': '#4e9fff',
      '--accent-hover': '#7fb8ff',
      '--accent-light': '#0a1929',
      '--link-color': '#4e9fff',
    },
  },
  {
    id: 'github-dark',
    name: 'GitHub',
    light: {
      '--accent': '#0969da',
      '--accent-hover': '#0550ae',
      '--accent-light': '#ddf4ff',
      '--link-color': '#0550ae',
    },
    dark: {
      '--accent': '#58a6ff',
      '--accent-hover': '#79c0ff',
      '--accent-light': '#0d1117',
      '--link-color': '#58a6ff',
    },
  },
  {
    id: 'elegant-purple',
    name: '优雅紫',
    light: {
      '--accent': '#7c3aed',
      '--accent-hover': '#6d28d9',
      '--accent-light': '#ede9fe',
      '--link-color': '#6d28d9',
    },
    dark: {
      '--accent': '#a78bfa',
      '--accent-hover': '#c4b5fd',
      '--accent-light': '#1e1b4b',
      '--link-color': '#a78bfa',
    },
  },
  {
    id: 'warm-orange',
    name: '暖阳橙',
    light: {
      '--accent': '#ea580c',
      '--accent-hover': '#c2410c',
      '--accent-light': '#fff7ed',
      '--link-color': '#c2410c',
    },
    dark: {
      '--accent': '#fb923c',
      '--accent-hover': '#fdba74',
      '--accent-light': '#431407',
      '--link-color': '#fb923c',
    },
  },
  {
    id: 'rose-red',
    name: '玫瑰红',
    light: {
      '--accent': '#e11d48',
      '--accent-hover': '#be123c',
      '--accent-light': '#ffe4e6',
      '--link-color': '#be123c',
    },
    dark: {
      '--accent': '#fb7185',
      '--accent-hover': '#fda4af',
      '--accent-light': '#4c0519',
      '--link-color': '#fb7185',
    },
  },
  {
    id: 'ink-grey',
    name: '水墨灰',
    light: {
      '--accent': '#475569',
      '--accent-hover': '#334155',
      '--accent-light': '#f1f5f9',
      '--link-color': '#334155',
    },
    dark: {
      '--accent': '#94a3b8',
      '--accent-hover': '#cbd5e1',
      '--accent-light': '#1e293b',
      '--link-color': '#94a3b8',
    },
  },
  {
    id: 'forest-green',
    name: '森林绿',
    light: {
      '--accent': '#059669',
      '--accent-hover': '#047857',
      '--accent-light': '#d1fae5',
      '--link-color': '#047857',
    },
    dark: {
      '--accent': '#34d399',
      '--accent-hover': '#6ee7b7',
      '--accent-light': '#064e3b',
      '--link-color': '#34d399',
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
  const hoverHex = darken(hex, 15)
  const lightHex = theme === 'dark' ? darken(hex, 60) : lighten(hex, 85)
  root.style.setProperty('--accent', hex)
  root.style.setProperty('--accent-hover', hoverHex)
  root.style.setProperty('--accent-light', lightHex)
  root.style.setProperty('--link-color', theme === 'dark' ? hex : hoverHex)
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
  return colorSchemes.find((s) => s.id === id) || colorSchemes[0]
}

export function getCurrentAccent(schemeId: string, theme: 'light' | 'dark', customAccent: string): string {
  if (schemeId === 'custom') return customAccent
  const scheme = getSchemeById(schemeId)
  const vars = theme === 'dark' ? scheme.dark : scheme.light
  return vars['--accent'] || '#2563eb'
}
