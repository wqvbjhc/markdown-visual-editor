/**
 * 飞书文档导出编排（浏览器侧）。
 *
 * 流程：md → convertMarkdownToFeishu 产 {title, children_id, descendants, images}
 *       → 浏览器把每张图 fetch 成 base64
 *       → POST /api/feishu/export {title, children_id, descendants, images}
 *       → Worker 用 user token：建文档 → descendant 塞块（含空 image block）
 *         → 对每张图 upload_all(parent=image 真实 block_id) → batch_update replace_image 绑回
 *       → 返回 {document_id, url}。
 *
 * 未授权（cookie 无 feishu_token）时 Worker 返 401 + auth_url，这里跳转 OAuth。
 *
 * 图片来源解析（resolveImageSrc）：
 *  - local-media://id → localMediaMap[id].objectUrl（本会话）或 persisted dataUrl（localStorage）
 *  - https:/data:/blob: → 原样 fetch（公网图可能被 CORS 挡，挡则跳过 + warning）
 */

import mermaid from 'mermaid'
import { convertMarkdownToFeishu } from './converter'
import {
  parseLocalMediaId,
  readPersistedLocalMedia,
  blobToDataUrl,
  type LocalMediaRecord,
} from '@/utils/media'

/** 送 Worker 的单张图（base64 字节） */
export interface ImageUploadPayload {
  block_id: string
  file_name: string
  mime: string
  data_base64: string
}

export interface ExportResult {
  ok: boolean
  document_id?: string
  url?: string
  warnings?: string[]
  /** Worker 侧单张图上传失败的明细（不阻断整篇，仅提示） */
  image_errors?: string[]
  /** 未授权时为 true，调用方应跳 auth_url（本函数内部已自动跳转） */
  need_auth?: boolean
}

export interface ExportOptions {
  enableDeAI?: boolean
  /** 本会话本地图映射（local-media://id → record），来自 store */
  localMediaMap?: Record<string, LocalMediaRecord>
}

/** 把 md 里的图源解析成浏览器可 fetch 的 URL。不可解析返 null。persisted 由调用方循环外算一次传入（避免 per-image O(N²) 重读 localStorage）。 */
function resolveImageSrc(
  src: string,
  localMediaMap: Record<string, LocalMediaRecord>,
  persisted: ReturnType<typeof readPersistedLocalMedia>,
): string | null {
  const id = parseLocalMediaId(src)
  if (id) {
    const live = localMediaMap[id]?.objectUrl
    if (live) return live
    return persisted[id]?.dataUrl || null
  }
  return src
}

/** fetch 图 → base64 + mime + 文件名。失败（CORS/不可达）返 null。 */
async function fetchImageBase64(url: string): Promise<Omit<ImageUploadPayload, 'block_id'> | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    const dataUrl = await blobToDataUrl(blob) // "data:image/png;base64,xxxx"
    const commaIdx = dataUrl.indexOf(',')
    if (commaIdx < 0) return null
    const meta = dataUrl.slice(0, commaIdx)
    const data_base64 = dataUrl.slice(commaIdx + 1)
    const mime = /data:([^;]+)/.exec(meta)?.[1] || 'image/png'
    const ext = mime.split('/')[1]?.split('+')[0] || 'png'
    return {
      file_name: `image-${Math.floor(performance.now())}.${ext}`,
      mime,
      data_base64,
    }
  } catch {
    return null
  }
}

let mermaidRenderCounter = 0
let mermaidReady = false
function ensureMermaid(): void {
  if (mermaidReady) return
  mermaid.initialize({
    startOnLoad: false,
    theme: 'default',
    securityLevel: 'loose',
    fontFamily: 'system-ui, sans-serif',
  })
  mermaidReady = true
}

/** SVG string → PNG data URL（canvas 2x 绘制，白底防透明）。优先显式 width/height，缺失从 viewBox 推，避免 mermaid 无宽高 SVG 被默认 300x150 压扁。 */
function svgToPngDataUrl(svg: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const wMatch = /\swidth=["']?(\d+(?:\.\d+)?)/i.exec(svg)
    const hMatch = /\sheight=["']?(\d+(?:\.\d+)?)/i.exec(svg)
    let w = wMatch ? Number(wMatch[1]) : 0
    let h = hMatch ? Number(hMatch[1]) : 0
    if (!w || !h) {
      const vb = /viewBox=["']?\s*[\d.\-]+\s+[\d.\-]+\s+([\d.]+)\s+([\d.]+)/i.exec(svg)
      if (vb) { w = w || Number(vb[1]); h = h || Number(vb[2]) }
    }
    if (!w || !h) { w = 800; h = 600 }
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
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

/** mermaid 源码 → PNG base64（送 Worker 上传）。渲染或转 PNG 失败返 null。 */
async function renderMermaidPng(
  code: string,
): Promise<Omit<ImageUploadPayload, 'block_id'> | null> {
  try {
    ensureMermaid()
    const id = `feishu-m-${++mermaidRenderCounter}`
    const { svg } = await mermaid.render(id, code.trim())
    // mermaid v10+ 临时 svg 用 id 自身；v9 用 d{id}。两者都清，防 DOM 残留
    document.getElementById(id)?.remove()
    document.getElementById(`d${id}`)?.remove()
    const dataUrl = await svgToPngDataUrl(svg)
    const commaIdx = dataUrl.indexOf(',')
    if (commaIdx < 0) return null
    return {
      file_name: `${id}.png`,
      mime: 'image/png',
      data_base64: dataUrl.slice(commaIdx + 1),
    }
  } catch {
    return null
  }
}

export async function exportToFeishuDoc(
  md: string,
  opts: ExportOptions = {},
): Promise<ExportResult> {
  const { enableDeAI = false, localMediaMap = {} } = opts
  const { payload, title, warnings, images } = convertMarkdownToFeishu(md, { enableDeAI })

  // 浏览器侧预取每张图字节：普通图 fetch URL，mermaid 渲染 PNG。失败的不送（Worker 侧该 image block 保持空）。
  const persisted = readPersistedLocalMedia()
  const imagePayloads: ImageUploadPayload[] = []
  for (const img of images) {
    let fetched: Omit<ImageUploadPayload, 'block_id'> | null = null
    if (img.kind === 'mermaid' && img.mermaidCode) {
      fetched = await renderMermaidPng(img.mermaidCode)
      if (!fetched) warnings.push(`Mermaid 渲染失败，已跳过: ${img.mermaidCode.slice(0, 40)}`)
    } else {
      const resolved = resolveImageSrc(img.src, localMediaMap, persisted)
      if (!resolved) {
        warnings.push(`图片无法解析（local-media 未找到），已跳过: ${img.src}`)
      } else {
        fetched = await fetchImageBase64(resolved)
        if (!fetched) warnings.push(`图片获取失败（CORS/不可达），已跳过: ${img.src}`)
      }
    }
    if (!fetched) continue
    imagePayloads.push({ block_id: img.block_id, ...fetched })
  }

  const res = await fetch('/api/feishu/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title,
      children_id: payload.children_id,
      descendants: payload.descendants,
      images: imagePayloads,
    }),
  })

  const data = (await res.json()) as ExportResult & { error?: string; auth_url?: string }

  if (!res.ok || !data.ok) {
    if (data.need_auth) {
      // 先试 refresh（HttpOnly cookie 自动带），成功重试一次；refresh 也失效才跳完整 OAuth
      try {
        const refreshRes = await fetch('/api/feishu/oauth/refresh', { method: 'POST' })
        const refreshData = (await refreshRes.json()) as { ok?: boolean }
        if (refreshData.ok) {
          const retryRes = await fetch('/api/feishu/export', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title,
              children_id: payload.children_id,
              descendants: payload.descendants,
              images: imagePayloads,
            }),
          })
          const retryData = (await retryRes.json()) as ExportResult & { error?: string; auth_url?: string }
          if (retryRes.ok && retryData.ok) {
            return { ...retryData, warnings }
          }
          if (retryData.need_auth) {
            window.location.href = retryData.auth_url || '/api/feishu/oauth/start'
            return { ok: false, need_auth: true, warnings }
          }
          throw new Error(retryData.error || `导出失败 (HTTP ${retryRes.status})`)
        }
      } catch (e) {
        // 重试已抛的导出错误继续向上抛；refresh 失败则走 OAuth
        if (e instanceof Error && /导出失败/.test(e.message)) throw e
      }
      window.location.href = data.auth_url || '/api/feishu/oauth/start'
      return { ok: false, need_auth: true, warnings }
    }
    throw new Error(data.error || `导出失败 (HTTP ${res.status})`)
  }

  return { ...data, warnings }
}
