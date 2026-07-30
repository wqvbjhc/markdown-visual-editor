import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { useMermaidSvg } from '@/hooks/useMermaidSvg'
import { renderMermaidToDataUrl } from '@/utils/mermaid-png'
import {
  fitToScreen,
  zoomAtPoint,
  type Transform,
  type Limits,
} from '@/utils/mermaid-zoom-math'

const MIN_SCALE = 0.2
const MAX_SCALE = 5
const LIMITS: Limits = { min: MIN_SCALE, max: MAX_SCALE }
const ZOOM_STEP = 1.2

interface Props {
  code: string
  isDark: boolean
  onClose: () => void
}

/**
 * 全屏放大 modal：portal 到 body，覆盖层展示单张 mermaid SVG。
 * 滚轮缩放（以光标为锚）+ 拖拽平移 + 工具栏按钮 + ESC/背板关闭 + 下载 PNG。
 */
export function MermaidZoomModal({ code, isDark, onClose }: Props) {
  const { svg, error } = useMermaidSvg(code, isDark, { useMaxWidth: false })
  const stageRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const [transform, setTransform] = useState<Transform>({ scale: 1, tx: 0, ty: 0 })
  const [dragging, setDragging] = useState(false)
  const dragStart = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null)

  // 量未变换的 svg 自然尺寸 → fit-to-screen 居中
  function applyFit() {
    const stage = stageRef.current
    const canvas = canvasRef.current
    if (!stage || !canvas) return
    const svgEl = canvas.querySelector('svg')
    if (!svgEl) return
    const stageRect = stage.getBoundingClientRect()
    // 临时剥 transform 量真实自然尺寸，量完还原
    const prev = canvas.style.transform
    canvas.style.transform = 'none'
    const r = svgEl.getBoundingClientRect()
    canvas.style.transform = prev
    setTransform(
      fitToScreen(
        { w: r.width || 1, h: r.height || 1 },
        { w: stageRect.width || 1, h: stageRect.height || 1 },
        MIN_SCALE,
      ),
    )
  }

  // SVG 就绪 → fit 初值
  useEffect(() => {
    if (!svg) return
    applyFit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [svg])

  // 滚轮缩放必须用原生非被动监听：React onWheel 默认被动，preventDefault 无效且告警
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = stage.getBoundingClientRect()
      const cursor = { x: e.clientX - rect.left, y: e.clientY - rect.top }
      const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP
      setTransform((t) => zoomAtPoint(t, cursor, factor, LIMITS))
    }
    stage.addEventListener('wheel', onWheel, { passive: false })
    return () => stage.removeEventListener('wheel', onWheel)
  }, [])

  // 锁背景滚 + 键盘快捷键
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  useEffect(() => {
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current()
      else if (e.key === '+' || e.key === '=') zoomCentered(ZOOM_STEP)
      else if (e.key === '-' || e.key === '_') zoomCentered(1 / ZOOM_STEP)
      else if (e.key === '0') applyFit()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function zoomCentered(factor: number) {
    const stage = stageRef.current
    if (!stage) return
    const rect = stage.getBoundingClientRect()
    setTransform((t) =>
      zoomAtPoint(t, { x: rect.width / 2, y: rect.height / 2 }, factor, LIMITS),
    )
  }

  // 拖拽平移（pointer + setPointerCapture，鼠标/触控统一）
  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return
    setDragging(true)
    dragStart.current = { x: e.clientX, y: e.clientY, tx: transform.tx, ty: transform.ty }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const s = dragStart.current
    if (!s || !dragging) return
    setTransform((t) => ({ ...t, tx: s.tx + (e.clientX - s.x), ty: s.ty + (e.clientY - s.y) }))
  }
  function onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    setDragging(false)
    dragStart.current = null
    e.currentTarget.releasePointerCapture(e.pointerId)
  }

  async function downloadPng() {
    const url = await renderMermaidToDataUrl(code)
    if (!url) {
      console.warn('[mermaid] renderMermaidToDataUrl 返 null，下载失败')
      return
    }
    const a = document.createElement('a')
    a.href = url
    a.download = 'mermaid.png'
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  return createPortal(
    <div
      className="mermaid-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Mermaid 图放大查看"
      onMouseDown={onClose}
    >
      <div className="mermaid-modal-toolbar" onMouseDown={(e) => e.stopPropagation()}>
        <button type="button" onClick={() => zoomCentered(ZOOM_STEP)} aria-label="放大">＋</button>
        <button type="button" onClick={() => zoomCentered(1 / ZOOM_STEP)} aria-label="缩小">－</button>
        <button type="button" onClick={applyFit} aria-label="重置适应">重置</button>
        <button type="button" onClick={() => void downloadPng()} aria-label="下载 PNG">下载 PNG</button>
        <button type="button" onClick={onClose} aria-label="关闭" autoFocus>×</button>
      </div>
      <div
        ref={stageRef}
        className={`mermaid-modal-stage${dragging ? ' dragging' : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {error ? (
          <div className="mermaid-modal-error">渲染失败：{error}</div>
        ) : (
          <div
            ref={canvasRef}
            className="mermaid-modal-canvas"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              transformOrigin: '0 0',
              transform: `translate(${transform.tx}px, ${transform.ty}px) scale(${transform.scale})`,
            }}
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        )}
      </div>
    </div>,
    document.body,
  )
}
