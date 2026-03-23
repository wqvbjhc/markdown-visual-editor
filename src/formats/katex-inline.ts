export type ExportMode = 'wechat' | 'toutiao' | 'default'

export function inlineKatexStyles(html: string, mode: ExportMode = 'default'): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html')
  const root = doc.body.firstElementChild as HTMLElement

  root.querySelectorAll('.katex').forEach((katexEl) => {
    const htmlPart = katexEl.querySelector('.katex-html')
    if (!htmlPart) return
    const semantic = katexToSemantic(htmlPart as HTMLElement, mode)
    const wrapper = doc.createElement('span')
    wrapper.setAttribute('style',
      'font-family:KaTeX_Main,"Times New Roman",serif;font-style:italic;font-size:1.05em;white-space:nowrap;')
    wrapper.innerHTML = semantic
    katexEl.replaceWith(wrapper)
  })

  return root.innerHTML
}

function katexToSemantic(el: HTMLElement, mode: ExportMode): string {
  const parts: string[] = []
  for (const child of Array.from(el.children) as HTMLElement[]) {
    const cls = child.className || ''
    if (cls.includes('base')) {
      parts.push(processBase(child, mode))
    } else if (cls.includes('katex-mathml')) {
      continue
    } else {
      parts.push(processNode(child, mode))
    }
  }
  return parts.join('')
}

function processBase(base: HTMLElement, mode: ExportMode): string {
  const parts: string[] = []
  for (const child of Array.from(base.children) as HTMLElement[]) {
    parts.push(processNode(child, mode))
  }
  return parts.join('')
}

function processNode(node: HTMLElement, mode: ExportMode): string {
  const cls = node.className || ''

  if (cls.includes('strut') || cls.includes('pstrut')) return ''

  if (cls.includes('mbin') || cls.includes('mrel') || cls.includes('mpunct')) {
    const text = node.textContent || ''
    const style = node.getAttribute('style') || ''
    const marginMatch = style.match(/margin-right:\s*([\d.]+)em/)
    const margin = marginMatch ? marginMatch[1] : '0.22'
    return `<span style="font-style:normal;margin:0 ${margin}em;">${escapeHtml(text)}</span>`
  }

  if (cls.includes('mord') && !cls.includes('msupsub') && !node.querySelector('.msupsub')) {
    if (node.children.length === 0) {
      const text = node.textContent || ''
      if (cls.includes('mathnormal')) return `<i>${escapeHtml(text)}</i>`
      return `<span style="font-style:normal;">${escapeHtml(text)}</span>`
    }
    const innerParts: string[] = []
    for (const child of Array.from(node.children) as HTMLElement[]) {
      innerParts.push(processNode(child, mode))
    }
    return innerParts.join('')
  }

  if (cls.includes('mord') && (cls.includes('msupsub') || node.querySelector('.msupsub'))) {
    return processMordWithSubSup(node, mode)
  }

  if (cls.includes('mathnormal')) {
    return `<i>${escapeHtml(node.textContent || '')}</i>`
  }

  if (cls.includes('msupsub')) return processSubSup(node, mode)

  if (cls.includes('mop')) {
    return `<span style="font-style:normal;">${escapeHtml(node.textContent || '')}</span>`
  }

  if (cls.includes('mopen') || cls.includes('mclose')) {
    return `<span style="font-style:normal;">${escapeHtml(node.textContent || '')}</span>`
  }

  if (cls.includes('mspace')) {
    const style = node.getAttribute('style') || ''
    const widthMatch = style.match(/margin-right:\s*([\d.]+)em/)
    if (widthMatch) return `<span style="margin-right:${widthMatch[1]}em;"></span>`
    return ''
  }

  if (cls.includes('mfrac')) return processFrac(node)

  if (cls.includes('sqrt')) {
    return `√(${extractTextContent(node)})`
  }

  if (node.children.length > 0) {
    const innerParts: string[] = []
    for (const child of Array.from(node.children) as HTMLElement[]) {
      innerParts.push(processNode(child, mode))
    }
    return innerParts.join('')
  }

  return escapeHtml(node.textContent || '')
}

function processMordWithSubSup(mord: HTMLElement, mode: ExportMode): string {
  let base = ''
  let sub = ''
  let sup = ''

  for (const child of Array.from(mord.children) as HTMLElement[]) {
    const cls = child.className || ''
    if (cls.includes('msupsub')) {
      const result = extractSubSup(child)
      sub = result.sub
      sup = result.sup
    } else if (cls.includes('strut') || cls.includes('pstrut')) {
      continue
    } else {
      base += processNode(child, mode)
    }
  }

  let result = base
  if (sub) result += renderSub(sub, mode)
  if (sup) result += renderSup(sup, mode)
  return result
}

function processSubSup(node: HTMLElement, mode: ExportMode): string {
  const result = extractSubSup(node)
  let out = ''
  if (result.sub) out += renderSub(result.sub, mode)
  if (result.sup) out += renderSup(result.sup, mode)
  return out
}

function renderSub(text: string, mode: ExportMode): string {
  if (mode === 'toutiao') {
    return toUnicodeSubBestEffort(text)
  }
  return `<span style="font-size:0.75em;vertical-align:sub;line-height:0;font-style:italic;">${text}</span>`
}

function renderSup(text: string, mode: ExportMode): string {
  if (mode === 'toutiao') {
    return toUnicodeSupBestEffort(text)
  }
  return `<span style="font-size:0.75em;vertical-align:super;line-height:0;font-style:italic;">${text}</span>`
}

const SUB_MAP: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
  '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
  'a': 'ₐ', 'e': 'ₑ', 'h': 'ₕ', 'i': 'ᵢ', 'j': 'ⱼ',
  'k': 'ₖ', 'l': 'ₗ', 'm': 'ₘ', 'n': 'ₙ', 'o': 'ₒ',
  'p': 'ₚ', 'r': 'ᵣ', 's': 'ₛ', 't': 'ₜ', 'u': 'ᵤ',
  'v': 'ᵥ', 'x': 'ₓ',
  '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎',
}

const SUP_MAP: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  'a': 'ᵃ', 'b': 'ᵇ', 'c': 'ᶜ', 'd': 'ᵈ', 'e': 'ᵉ',
  'f': 'ᶠ', 'g': 'ᵍ', 'h': 'ʰ', 'i': 'ⁱ', 'j': 'ʲ',
  'k': 'ᵏ', 'l': 'ˡ', 'm': 'ᵐ', 'n': 'ⁿ', 'o': 'ᵒ',
  'p': 'ᵖ', 'r': 'ʳ', 's': 'ˢ', 't': 'ᵗ', 'u': 'ᵘ',
  'v': 'ᵛ', 'w': 'ʷ', 'x': 'ˣ', 'y': 'ʸ', 'z': 'ᶻ',
  '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾',
}

function toUnicodeSubBestEffort(text: string): string {
  return text.split('').map(c => SUB_MAP[c.toLowerCase()] || c).join('')
}

function toUnicodeSupBestEffort(text: string): string {
  return text.split('').map(c => SUP_MAP[c.toLowerCase()] || c).join('')
}

function extractSubSup(msupsub: HTMLElement): { sub: string; sup: string } {
  let sub = ''
  let sup = ''

  const entries: { top: number; text: string }[] = []
  const vlistSpans = msupsub.querySelectorAll('.vlist-t .vlist > span[style]')
  vlistSpans.forEach((span) => {
    const style = (span as HTMLElement).getAttribute('style') || ''
    const topMatch = style.match(/top:\s*(-?[\d.]+)em/)
    if (!topMatch) return
    const text = extractCleanText(span as HTMLElement)
    if (!text) return
    entries.push({ top: parseFloat(topMatch[1]), text })
  })

  if (entries.length === 1) {
    if (entries[0].top < -2.8) sup = entries[0].text
    else sub = entries[0].text
  } else if (entries.length >= 2) {
    entries.sort((a, b) => a.top - b.top)
    sup = entries[0].text
    sub = entries[entries.length - 1].text
  }

  return { sub, sup }
}

function extractCleanText(el: HTMLElement): string {
  const parts: string[] = []
  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === 3) {
      const t = (child as Text).textContent || ''
      if (t.trim()) parts.push(t.trim())
    } else if (child.nodeType === 1) {
      const htmlChild = child as HTMLElement
      const cls = htmlChild.className || ''
      if (cls.includes('pstrut') || cls.includes('strut') || cls.includes('vlist-s')) continue
      parts.push(extractCleanText(htmlChild))
    }
  }
  return parts.join('')
}

function extractTextContent(el: HTMLElement): string {
  const parts: string[] = []
  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === 3) {
      parts.push((child as Text).textContent || '')
    } else if (child.nodeType === 1) {
      const cls = (child as HTMLElement).className || ''
      if (cls.includes('strut') || cls.includes('pstrut') || cls.includes('vlist-s')) continue
      parts.push(extractTextContent(child as HTMLElement))
    }
  }
  return parts.join('')
}

function processFrac(node: HTMLElement): string {
  const nums: string[] = []
  const dens: string[] = []
  let isNumerator = true

  node.querySelectorAll('.vlist > span').forEach((span) => {
    const cls = (span as HTMLElement).className || ''
    if (cls.includes('frac-line')) {
      isNumerator = false
      return
    }
    const text = extractCleanText(span as HTMLElement)
    if (!text) return
    if (isNumerator) nums.push(text)
    else dens.push(text)
  })

  if (nums.length && dens.length) {
    return `(${nums.join('')})/(${dens.join('')})`
  }
  return extractCleanText(node)
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
