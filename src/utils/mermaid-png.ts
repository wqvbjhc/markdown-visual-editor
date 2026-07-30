/**
 * Mermaid → PNG（浏览器侧栅格化）。
 *
 * 用途：飞书文档导出（PNG 上传绑定 image block）+ 复制到公众号/头条/飞书（PNG data URL <img>）。
 *
 * 核心：mermaid v11 默认 look:'neo' + htmlLabels:true 用 <foreignObject> 渲 HTML 标签。
 *   SVG 经 <img> 画 canvas 时，foreignObject 依 HTML 规范**必 tainted**，toDataURL 抛 SecurityError。
 *   修：顶层 htmlLabels:false（v11 主键，flowchart.htmlLabels 已 deprecated 仅 fallback，实测不够）
 *   + look:'classic'（原生 SVG <text> 标签，无 foreignObject）+ useMaxWidth:false（出显式 px 宽，
 *   默认 width="100%" 会被 <img> 用默认小尺寸压扁）。
 *
 * mermaid 单例坑：Preview 的 MermaidBlock 每次渲染都 mermaid.initialize 重置成默认 neo look，
 *   故导出/复制每次 render 前必须强制重设本配置，不能缓存「已 init」标志。
 *
 * PNG 输出固定白底（防透明背景在公众号/飞书显示成黑底）。
 */
import mermaid from 'mermaid'

let renderCounter = 0

/** 强制设导出/复制专用配置（去 foreignObject 防 tainted，去 100% 宽防压扁）。每次 render 前调。 */
export function ensureMermaidExportConfig(): void {
  mermaid.initialize({
    startOnLoad: false,
    theme: 'default',
    securityLevel: 'loose',
    fontFamily: 'system-ui, sans-serif',
    look: 'classic',
    htmlLabels: false,
    flowchart: { htmlLabels: false, useMaxWidth: false },
  })
}

/**
 * 把边标签底色改不透明白底，作为 <style> 注入 SVG 内部。
 *
 * 为何要注入：SVG 经 <img> 画 canvas 时，外部 CSS（index.css 的 !important 规则）不进 <img> 文档，
 * mermaid 自带 .edgeLabel{background-color:rgba(232,232,232,.8)} 半透明底原样保留 → 线穿字。
 * 把 <style> 塞进 SVG 自身文档才被 <img> 认。!important 压过 mermaid 的 #id scope 规则。
 * 覆盖 classic（rect/fill）+ neo（div/background-color）两种标签渲染。
 */
function injectOpaqueEdgeLabels(svg: string): string {
  const style =
    '<style>.edgeLabel,.edgeLabel p,.labelBkg{background-color:#fff!important;fill:#fff!important;opacity:1!important}.edgeLabel rect{fill:#fff!important;background-color:#fff!important;opacity:1!important}</style>'
  return /<svg[^>]*>/.test(svg) ? svg.replace(/(<svg[^>]*>)/, `$1${style}`) : svg
}

/**
 * SVG string → PNG data URL（canvas 2x 绘制，白底防透明）。
 * 优先显式 width/height；width="100%"（百分号）落 viewBox 兜底；都没则 800×600。
 */
export function svgToPngDataUrl(svg: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // 负前瞻 (?!%) 排除 width="100%"（百分号宽不是 px，压扁图，落 viewBox 兜底）
    const wMatch = /\swidth=["']?(\d+(?:\.\d+)?)(?!%)/i.exec(svg)
    const hMatch = /\sheight=["']?(\d+(?:\.\d+)?)(?!%)/i.exec(svg)
    let w = wMatch ? Number(wMatch[1]) : 0
    let h = hMatch ? Number(hMatch[1]) : 0
    if (!w || !h) {
      const vb = /viewBox=["']?\s*[\d.-]+\s+[\d.-]+\s+([\d.]+)\s+([\d.]+)/i.exec(svg)
      if (vb) { w = w || Number(vb[1]); h = h || Number(vb[2]) }
    }
    if (!w || !h) { w = 800; h = 600 }
    // 边标签遮线注入（外部 CSS 不入 <img>，见 injectOpaqueEdgeLabels 注释）
    const styledSvg = injectOpaqueEdgeLabels(svg)
    const blob = new Blob([styledSvg], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = w * 2
        canvas.height = h * 2
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('no 2d ctx')
        ctx.fillStyle = '#fff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.scale(2, 2)
        ctx.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/png'))
      } catch (e) {
        reject(e)
      } finally {
        URL.revokeObjectURL(url)
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('svg to png load fail'))
    }
    img.src = url
  })
}

/**
 * mermaid 源码 → PNG data URL（`data:image/png;base64,...`）。
 * 渲染或转 PNG 失败返 null（调用方按需降级）。
 */
export async function renderMermaidToDataUrl(code: string): Promise<string | null> {
  try {
    ensureMermaidExportConfig()
    const id = `mmd-png-${++renderCounter}`
    const { svg } = await mermaid.render(id, code.trim())
    // mermaid v10+ 临时 svg 用 id 自身；v9 用 d{id}。两者都清，防 DOM 残留
    document.getElementById(id)?.remove()
    document.getElementById(`d${id}`)?.remove()
    return await svgToPngDataUrl(svg)
  } catch {
    return null
  }
}
