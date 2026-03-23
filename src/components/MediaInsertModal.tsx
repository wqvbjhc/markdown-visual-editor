import { useEffect, useMemo, useRef, useState } from 'react'

type MediaKind = 'image' | 'video'
type SourceMode = 'url' | 'file'

interface ImageInsertPayload {
  kind: 'image'
  sourceMode: SourceMode
  src: string
  file: File | null
  alt: string
  caption: string
  width: string
}

interface VideoInsertPayload {
  kind: 'video'
  sourceMode: SourceMode
  src: string
  file: File | null
  title: string
  link: string
  posterMode: SourceMode
  posterSrc: string
  posterFile: File | null
}

type MediaInsertPayload = ImageInsertPayload | VideoInsertPayload

interface MediaInsertModalProps {
  kind: MediaKind
  open: boolean
  onClose: () => void
  onSubmit: (payload: MediaInsertPayload) => void | Promise<void>
}

function fileLabel(file: File | null, empty: string): string {
  return file ? file.name : empty
}

export function MediaInsertModal({ kind, open, onClose, onSubmit }: MediaInsertModalProps) {
  const [sourceMode, setSourceMode] = useState<SourceMode>('url')
  const [src, setSrc] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [alt, setAlt] = useState('')
  const [caption, setCaption] = useState('')
  const [width, setWidth] = useState('')
  const [title, setTitle] = useState('')
  const [link, setLink] = useState('')
  const [posterMode, setPosterMode] = useState<SourceMode>('url')
  const [posterSrc, setPosterSrc] = useState('')
  const [posterFile, setPosterFile] = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const firstInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    window.setTimeout(() => firstInputRef.current?.focus(), 0)
  }, [open, kind])

  useEffect(() => {
    if (!open) return
    setSourceMode('url')
    setSrc('')
    setFile(null)
    setAlt('')
    setCaption('')
    setWidth('')
    setTitle('')
    setLink('')
    setPosterMode('url')
    setPosterSrc('')
    setPosterFile(null)
    setIsSubmitting(false)
  }, [open, kind])

  const canSubmit = useMemo(() => {
    if (kind === 'image') {
      return sourceMode === 'url' ? Boolean(src.trim()) : Boolean(file)
    }

    const hasSource = sourceMode === 'url' ? Boolean(src.trim()) : Boolean(file)
    if (!hasSource) return false
    return true
  }, [file, kind, sourceMode, src])

  if (!open) return null

  const submit = async () => {
    if (!canSubmit || isSubmitting) return
    setIsSubmitting(true)
    try {
      if (kind === 'image') {
        await onSubmit({
          kind,
          sourceMode,
          src: src.trim(),
          file,
          alt: alt.trim(),
          caption: caption.trim(),
          width: width.trim(),
        })
      } else {
        await onSubmit({
          kind,
          sourceMode,
          src: src.trim(),
          file,
          title: title.trim(),
          link: link.trim(),
          posterMode,
          posterSrc: posterSrc.trim(),
          posterFile,
        })
      }
      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }

  const headline = kind === 'image' ? '插入图片' : '插入视频'

  return (
    <div className="media-modal-backdrop" onClick={onClose}>
      <div className="media-modal" onClick={(event) => event.stopPropagation()}>
        <div className="media-modal-header">
          <div>
            <h3>{headline}</h3>
            <p>
              {kind === 'image'
                ? '插入到当前光标位置；如果你还没放置光标，就追加到文末。'
                : '默认 / Mobile 显示真实视频；公众号 / 头条号复制时导出为封面卡片。'}
            </p>
          </div>
          <button className="media-modal-close" onClick={onClose} aria-label="关闭">
            关闭
          </button>
        </div>

        <div className="media-modal-body">
          <div className="media-form-block">
            <label>来源</label>
            <div className="media-segmented">
              <button
                type="button"
                className={sourceMode === 'url' ? 'active' : ''}
                onClick={() => setSourceMode('url')}
              >
                网络地址
              </button>
              <button
                type="button"
                className={sourceMode === 'file' ? 'active' : ''}
                onClick={() => setSourceMode('file')}
              >
                本地文件
              </button>
            </div>

            {sourceMode === 'url' ? (
              <label className="media-field">
                <span>{kind === 'image' ? '图片地址' : '预览视频地址'}</span>
                <input
                  ref={firstInputRef}
                  value={src}
                  onChange={(event) => setSrc(event.target.value)}
                  placeholder={kind === 'image' ? 'https://example.com/demo.png' : 'https://example.com/demo.mp4'}
                />
              </label>
            ) : (
              <label className="media-field media-file-field">
                <span>{kind === 'image' ? '选择图片文件' : '选择视频文件'}</span>
                <input
                  ref={firstInputRef}
                  type="file"
                  accept={kind === 'image' ? 'image/*' : 'video/*'}
                  onChange={(event) => setFile(event.target.files?.[0] || null)}
                />
                <small>{fileLabel(file, kind === 'image' ? '尚未选择图片文件' : '尚未选择视频文件')}</small>
              </label>
            )}
          </div>

          {kind === 'image' ? (
            <>
              <label className="media-field">
                <span>图注</span>
                <input value={caption} onChange={(event) => setCaption(event.target.value)} placeholder="图片下方说明，可选" />
              </label>
              <label className="media-field">
                <span>alt 文本</span>
                <input value={alt} onChange={(event) => setAlt(event.target.value)} placeholder="用于无图或无障碍，可选" />
              </label>
              <label className="media-field">
                <span>显示宽度</span>
                <input value={width} onChange={(event) => setWidth(event.target.value)} placeholder="例如 720px 或 80%，可选" />
              </label>
            </>
          ) : (
            <>
              <label className="media-field">
                <span>视频标题</span>
                <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="平台卡片会展示这个标题" />
              </label>
              <label className="media-field">
                <span>平台跳转链接</span>
                <input value={link} onChange={(event) => setLink(event.target.value)} placeholder="公众号 / 头条号点击卡片后打开的链接，建议填写 https://..." />
              </label>
              <div className="media-form-block media-form-subblock">
                <label>平台封面</label>
                <div className="media-segmented">
                  <button
                    type="button"
                    className={posterMode === 'url' ? 'active' : ''}
                    onClick={() => setPosterMode('url')}
                  >
                    封面地址
                  </button>
                  <button
                    type="button"
                    className={posterMode === 'file' ? 'active' : ''}
                    onClick={() => setPosterMode('file')}
                  >
                    本地封面图
                  </button>
                </div>
                {posterMode === 'url' ? (
                  <label className="media-field">
                    <span>封面图片地址</span>
                    <input value={posterSrc} onChange={(event) => setPosterSrc(event.target.value)} placeholder="https://example.com/poster.png" />
                  </label>
                ) : (
                  <label className="media-field media-file-field">
                    <span>选择封面图片</span>
                    <input type="file" accept="image/*" onChange={(event) => setPosterFile(event.target.files?.[0] || null)} />
                    <small>{fileLabel(posterFile, '尚未选择封面图片')}</small>
                  </label>
                )}
              </div>
              <div className="media-callout">
                <strong>行为说明</strong>
                <span>预览视频只用于默认 / Mobile 模式播放。复制到公众号或头条号时，会转成封面 + 标题 + 链接卡片。</span>
              </div>
            </>
          )}
        </div>

        <div className="media-modal-footer">
          <button type="button" className="toolbar-btn" onClick={onClose}>取消</button>
          <button type="button" className="toolbar-btn active" onClick={submit} disabled={!canSubmit || isSubmitting}>
            {isSubmitting ? '插入中' : '插入'}
          </button>
        </div>
      </div>
    </div>
  )
}
