import { useState, useEffect } from 'react'
import { FiImage, FiMoon, FiSun, FiVideo } from 'react-icons/fi'
import { useStore, type FormatType } from '@/utils/store'
import { applyWechatStyles } from '@/formats/wechat'
import { applyToutiaoStyles } from '@/formats/toutiao'
import { applyFeishuStyles, countFeishuImagePlaceholders } from '@/formats/feishu'
import { exportToFeishuDoc } from '@/feishu-blocks/export'
import { colorSchemes, getCurrentAccent } from '@/utils/color-schemes'
import { exportCurrentPreviewAsPdf } from '@/utils/pdf'
import { buildImageDirective, buildVideoDirective } from '@/utils/media'
import { prepareClipboardHtml, validateVideoExport } from '@/utils/media-export'
import { MediaInsertModal } from './MediaInsertModal'

const formats: { value: FormatType; label: string }[] = [
  { value: 'default', label: '默认' },
  { value: 'wechat', label: '公众号' },
  { value: 'toutiao', label: '头条号' },
  { value: 'feishu', label: '飞书' },
  { value: 'mobile', label: 'Mobile' },
]

type InsertKind = 'image' | 'video'

type ImagePayload = {
  kind: 'image'
  sourceMode: 'url' | 'file'
  src: string
  file: File | null
  alt: string
  caption: string
  width: string
}

type VideoPayload = {
  kind: 'video'
  sourceMode: 'url' | 'file'
  src: string
  file: File | null
  title: string
  link: string
  posterMode: 'url' | 'file'
  posterSrc: string
  posterFile: File | null
}

function wrapBlock(snippet: string): string {
  return `\n\n${snippet.trim()}\n\n`
}

function buildImageSnippet(payload: ImagePayload, src: string): string {
  const alt = payload.alt || payload.file?.name.replace(/\.[^.]+$/, '') || 'image'
  if (payload.sourceMode === 'url' && !payload.caption && !payload.width) {
    return wrapBlock(`![${alt}](${src})`)
  }

  return wrapBlock(buildImageDirective({
    src,
    alt,
    caption: payload.caption,
    width: payload.width,
  }))
}

function buildVideoSnippet(payload: VideoPayload, src: string, poster: string): string {
  const title = payload.title || payload.file?.name.replace(/\.[^.]+$/, '') || 'Video'

  return wrapBlock(buildVideoDirective({
    src,
    poster,
    title,
    href: payload.link || src,
  }))
}

export function Toolbar() {
  const {
    format,
    setFormat,
    theme,
    toggleTheme,
    html,
    markdown,
    colorSchemeId,
    setColorScheme,
    customAccent,
    setCustomAccent,
    enableDeAI,
    setEnableDeAI,
    insertSnippet,
    registerLocalMedia,
    setRelativeMediaEntries,
    localMediaMap,
  } = useStore()
  const [copyTip, setCopyTip] = useState('')
  const [pdfTip, setPdfTip] = useState('')
  const [feishuTip, setFeishuTip] = useState('')
  const [feishuBusy, setFeishuBusy] = useState(false)
  // 创建飞书文档按钮需 Workers 后端（/api/feishu/*）。纯静态部署（HF / 静态站）无后端 → 隐藏按钮。
  // 探测 /api/feishu/status：返 200 = Worker 在；返 404/异常 = 无后端，隐藏。
  const [feishuBackendAvailable, setFeishuBackendAvailable] = useState(false)
  useEffect(() => {
    let cancelled = false
    fetch('/api/feishu/status', { headers: { Accept: 'application/json' } })
      .then((res) => {
        if (cancelled) return
        setFeishuBackendAvailable(res.ok)
      })
      .catch(() => {
        if (!cancelled) setFeishuBackendAvailable(false)
      })
    return () => {
      cancelled = true
    }
  }, [])
  const [showPalette, setShowPalette] = useState(false)
  const [modalKind, setModalKind] = useState<InsertKind | null>(null)

  const setTransientTip = (setter: (value: string) => void, value: string) => {
    setter(value)
    window.setTimeout(() => setter(''), 2800)
  }

  const finishInsert = (snippet: string, label: string) => {
    const result = insertSnippet(snippet)
    if (!result) {
      setTransientTip(setCopyTip, '未找到编辑器插入位置')
      return
    }

    const where = result.insertedAt === 'cursor' ? `第 ${result.line} 行附近` : '文末'
    setTransientTip(setCopyTip, `${label}已插入到${where}`)
  }

  const handleImageInsert = async (payload: ImagePayload) => {
    const src = payload.sourceMode === 'url'
      ? payload.src
      : payload.file
        ? registerLocalMedia(payload.file, 'image').objectUrl
        : ''

    if (!src) return

    finishInsert(buildImageSnippet(payload, src), '图片')
  }

  const handleVideoInsert = async (payload: VideoPayload) => {
    const src = payload.sourceMode === 'url'
      ? payload.src
      : payload.file
        ? registerLocalMedia(payload.file, 'video').objectUrl
        : ''

    const poster = payload.posterMode === 'url'
      ? payload.posterSrc
      : payload.posterFile
        ? registerLocalMedia(payload.posterFile, 'image').objectUrl
        : ''

    if (!src) return

    finishInsert(buildVideoSnippet(payload, src, poster), '视频')
  }

  const handlePickImageDirectory = async () => {
    const picker = (window as Window & { showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker
    if (!picker) {
      setTransientTip(setCopyTip, '当前浏览器不支持目录授权')
      return
    }

    try {
      const handle = await picker.call(window)
      const entries: Array<{ path: string; dataUrl: string }> = []
      const iterator = (handle as unknown as { entries: () => AsyncIterable<[string, FileSystemHandle]> }).entries()

      for await (const [name, entry] of iterator) {
        if (entry.kind !== 'file') continue
        const fileHandle = entry as FileSystemFileHandle
        const file = await fileHandle.getFile()
        if (!file.type.startsWith('image/')) continue
        const reader = new FileReader()
        const dataUrl = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(String(reader.result || ''))
          reader.onerror = () => reject(reader.error || new Error('Failed to read image file'))
          reader.readAsDataURL(file)
        })
        entries.push({ path: name, dataUrl })
      }

      setRelativeMediaEntries(entries)
      setTransientTip(setCopyTip, entries.length > 0 ? `已载入 ${entries.length} 张本地图片` : '目录中未找到图片文件')
    } catch (e) {
      const err = e as { name?: string; message?: string }
      if (err?.name === 'AbortError') {
        setTransientTip(setCopyTip, '目录授权已取消')
      } else {
        console.error('Pick image directory failed:', e)
        setTransientTip(setCopyTip, `读取目录失败: ${err?.message || '未知错误'}`)
      }
    }
  }

  const handleCopy = async () => {
    const accent = getCurrentAccent(colorSchemeId, theme, customAccent)

    const videoErrors = validateVideoExport(html, localMediaMap)
    if ((format === 'wechat' || format === 'toutiao') && videoErrors.length > 0) {
      setTransientTip(setCopyTip, '视频卡片需要封面和公开跳转链接')
      console.error(videoErrors.join('\n'))
      return
    }

    let content = html
    if (format === 'wechat') content = applyWechatStyles(html, accent)
    else if (format === 'toutiao') content = applyToutiaoStyles(html, accent)
    else if (format === 'feishu') content = applyFeishuStyles(html)

    // 飞书格式：图片占位数（本地图/相对图转了占位，提示用户手动插）
    const feishuImagePlaceholders = format === 'feishu' ? countFeishuImagePlaceholders(content) : 0

    try {
      const prepared = await prepareClipboardHtml(content, localMediaMap)
      const itemData: Record<string, Blob> = {
        'text/html': new Blob([prepared.html], { type: 'text/html' }),
        'text/plain': new Blob([prepared.text || prepared.html], { type: 'text/plain' }),
      }
      if (prepared.imageItem) {
        itemData[prepared.imageItem.type] = prepared.imageItem.blob
      }

      await navigator.clipboard.write([new ClipboardItem(itemData)])
      // 飞书格式不依赖剪贴板图片项（占位提示为主），单独凑提示
      if (format === 'feishu') {
        const tip = feishuImagePlaceholders > 0
          ? `已复制（飞书公式用 LaTeX 源码，${feishuImagePlaceholders} 张图需手动插入）`
          : '已复制（粘到飞书文档，公式自动识别）'
        setTransientTip(setCopyTip, tip)
      } else {
        setTransientTip(setCopyTip, prepared.warnings[0] || '已复制')
      }
    } catch (error) {
      console.error('Copy failed:', error)
      const el = document.querySelector('.prose-container')
      if (el) {
        const selection = window.getSelection()
        const range = document.createRange()
        range.selectNodeContents(el)
        selection?.removeAllRanges()
        selection?.addRange(range)
        document.execCommand('copy')
        selection?.removeAllRanges()
        setTransientTip(setCopyTip, '已复制（降级）')
      } else {
        setTransientTip(setCopyTip, '复制失败')
      }
    }
  }

  const handleExportPdf = async () => {
    try {
      await exportCurrentPreviewAsPdf(format)
      setTransientTip(setPdfTip, 'PDF 准备中')
    } catch (error) {
      console.error('PDF export failed:', error)
      setTransientTip(setPdfTip, '导出失败')
    }
  }

  // 飞书文档：md → block 树 → Worker 用 user token 建文档 + 塞块 → 开新窗。
  // 首次未授权会自动跳飞书 OAuth；回来后 cookie 已种，再点一次。
  const handleExportFeishu = async () => {
    if (feishuBusy) return
    setFeishuBusy(true)
    setTransientTip(setFeishuTip, '生成中…')
    // 同步预开 tab（user gesture 内），避免长异步（图 fetch + 飞书上传）后 window.open 被弹窗拦截
    const popup = window.open('about:blank', '_blank')
    try {
      const result = await exportToFeishuDoc(markdown, { enableDeAI, localMediaMap })
      if (result.need_auth) {
        popup?.close()
        setTransientTip(setFeishuTip, '跳转飞书授权…')
        return
      }
      if (result.url && popup) {
        popup.location.href = result.url
      } else if (result.url) {
        window.open(result.url, '_blank', 'noopener,noreferrer')
      }
      const warn = result.warnings && result.warnings.length > 0 ? `（${result.warnings.length} 项降级）` : ''
      const imgErr = result.image_errors && result.image_errors.length > 0
        ? `，${result.image_errors.length} 张图上传失败`
        : ''
      setTransientTip(setFeishuTip, `已创建飞书文档${warn}${imgErr}`)
    } catch (error) {
      popup?.close()
      console.error('Feishu export failed:', error)
      setTransientTip(setFeishuTip, error instanceof Error ? error.message : '飞书导出失败')
    } finally {
      setFeishuBusy(false)
    }
  }

  return (
    <>
      <div className="toolbar">
        <div className="toolbar-left">
          <span className="toolbar-logo">MD</span>
          <span className="toolbar-title">Markdown 可视化</span>
        </div>
        <div className="toolbar-center">
          {formats.map((f) => (
            <button
              key={f.value}
              onClick={() => setFormat(f.value)}
              className={`toolbar-btn ${format === f.value ? 'active' : ''}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="toolbar-right">
          <button onClick={() => setModalKind('image')} className="toolbar-btn toolbar-inline" title="插入图片">
            <FiImage size={14} />
            <span>图片</span>
          </button>
          <button onClick={() => setModalKind('video')} className="toolbar-btn toolbar-inline" title="插入视频">
            <FiVideo size={14} />
            <span>视频</span>
          </button>
          <button onClick={handlePickImageDirectory} className="toolbar-btn toolbar-inline" title="选择图片目录">
            <FiImage size={14} />
            <span>图片目录</span>
          </button>
          <button onClick={handleCopy} className="toolbar-btn" title="复制内容">
            {copyTip || '复制'}
          </button>
          {feishuBackendAvailable && (
            <button
              onClick={handleExportFeishu}
              disabled={feishuBusy}
              className="toolbar-btn"
              title="把当前 Markdown 转成飞书云文档（原生结构 + 公式 + 图片）。仅 Workers 环境可用"
            >
              {feishuTip || '创建飞书文档'}
            </button>
          )}
          <button onClick={handleExportPdf} className="toolbar-btn" title="导出当前预览为 PDF">
            {pdfTip || '导出 PDF'}
          </button>
          <label
            className={`toolbar-btn ${enableDeAI ? 'active' : ''}`}
            style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '4px' }}
            title="去除常见的 AI 味词汇和句式"
          >
            <input
              type="checkbox"
              checked={enableDeAI}
              onChange={(e) => setEnableDeAI(e.target.checked)}
              style={{ margin: 0, cursor: 'pointer' }}
            />
            去 AI 味
          </label>
          <div className="palette-wrapper">
            <button
              onClick={() => setShowPalette(!showPalette)}
              className="toolbar-btn"
              title="配色方案"
            >
              调色
            </button>
            {showPalette && (
              <div className="palette-dropdown">
                {colorSchemes.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setColorScheme(s.id)
                      setShowPalette(false)
                    }}
                    className={`palette-item ${colorSchemeId === s.id ? 'active' : ''}`}
                  >
                    <span className="palette-swatch-group" aria-hidden="true">
                      {s.preview.map((color) => (
                        <span
                          key={color}
                          className="palette-swatch"
                          style={{ background: color }}
                        />
                      ))}
                    </span>
                    <span className="palette-copy">
                      <span className="palette-name">{s.name}</span>
                      <span className="palette-desc">{s.description}</span>
                    </span>
                  </button>
                ))}
                <label className={`palette-item ${colorSchemeId === 'custom' ? 'active' : ''}`}>
                  <input
                    type="color"
                    value={customAccent}
                    onChange={(e) => setCustomAccent(e.target.value)}
                    style={{ width: 18, height: 18, border: 'none', padding: 0, cursor: 'pointer', borderRadius: '50%' }}
                  />
                  <span style={{ marginLeft: 8 }}>自定义</span>
                </label>
              </div>
            )}
          </div>
          <button onClick={toggleTheme} className="toolbar-btn" title="切换主题" aria-label="切换主题">
            {theme === 'light' ? <FiMoon size={14} /> : <FiSun size={14} />}
          </button>
        </div>
      </div>

      <MediaInsertModal
        kind="image"
        open={modalKind === 'image'}
        onClose={() => setModalKind(null)}
        onSubmit={(payload) => handleImageInsert(payload as ImagePayload)}
      />
      <MediaInsertModal
        kind="video"
        open={modalKind === 'video'}
        onClose={() => setModalKind(null)}
        onSubmit={(payload) => handleVideoInsert(payload as VideoPayload)}
      />
    </>
  )
}


