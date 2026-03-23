import { useState } from 'react'
import { FiImage, FiMoon, FiSun, FiVideo } from 'react-icons/fi'
import { useStore, type FormatType } from '@/utils/store'
import { applyWechatStyles } from '@/formats/wechat'
import { applyToutiaoStyles } from '@/formats/toutiao'
import { colorSchemes, getCurrentAccent } from '@/utils/color-schemes'
import { exportCurrentPreviewAsPdf } from '@/utils/pdf'
import { buildImageDirective, escapeDirectiveValue } from '@/utils/media'
import { prepareClipboardHtml, validateVideoExport } from '@/utils/media-export'
import { MediaInsertModal } from './MediaInsertModal'

const formats: { value: FormatType; label: string }[] = [
  { value: 'default', label: '默认' },
  { value: 'wechat', label: '公众号' },
  { value: 'toutiao', label: '头条号' },
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
  const attrs = [
    `controls`,
    `preload="metadata"`,
    `playsinline`,
    `title="${escapeDirectiveValue(title)}"`,
    `data-media-link="${escapeDirectiveValue(payload.link || src)}"`,
    `src="${escapeDirectiveValue(src)}"`,
  ]

  if (poster) {
    attrs.push(`poster="${escapeDirectiveValue(poster)}"`)
  }

  return wrapBlock(`<video ${attrs.join(' ')}></video>`)
}

export function Toolbar() {
  const {
    format,
    setFormat,
    theme,
    toggleTheme,
    html,
    colorSchemeId,
    setColorScheme,
    customAccent,
    setCustomAccent,
    enableDeAI,
    setEnableDeAI,
    insertSnippet,
    registerLocalMedia,
    localMediaMap,
  } = useStore()
  const [copyTip, setCopyTip] = useState('')
  const [pdfTip, setPdfTip] = useState('')
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
      setTransientTip(setCopyTip, prepared.warnings[0] || '已复制')
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
          <button onClick={handleCopy} className="toolbar-btn" title="复制内容">
            {copyTip || '复制'}
          </button>
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
                    <span
                      className="palette-dot"
                      style={{ background: s.light['--accent'] }}
                    />
                    {s.name}
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

