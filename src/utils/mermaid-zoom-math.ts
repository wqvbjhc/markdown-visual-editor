/**
 * Mermaid 缩放/平移纯数学。无 DOM 依赖，便于 node 单测。
 *
 * 坐标系：stage（舞台）坐标系。canvas 用 CSS transform: translate(tx,ty) scale(s)，
 * transform-origin: 0 0。stage 上内容点 (px,py) 显示在 (px*s+tx, py*s+ty)。
 */

export interface Transform {
  scale: number
  tx: number
  ty: number
}

export interface Point { x: number; y: number }
export interface Limits { min: number; max: number }
export interface Size { w: number; h: number }

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}

/**
 * 滚轮缩放，以光标点为锚保持不动。
 * 推导：变换前光标下内容点 P=(cursor-t)/s（由 P*s+t=cursor 解出）。
 *   scale 变 s' 后仍要 P*s'+t'=cursor → t'=cursor-(cursor-t)*(s'/s)。
 * factor>1 放大。s' 钳到 [min,max]；若 s'==s（贴边界）平移不动。
 */
export function zoomAtPoint(
  prev: Transform,
  cursor: Point,
  factor: number,
  limits: Limits,
): Transform {
  const newScale = clamp(prev.scale * factor, limits.min, limits.max)
  if (newScale === prev.scale) return { ...prev }
  const ratio = newScale / prev.scale
  return {
    scale: newScale,
    tx: cursor.x - (cursor.x - prev.tx) * ratio,
    ty: cursor.y - (cursor.y - prev.ty) * ratio,
  }
}

/** 钳 scale 到 [min,max]，scale 未变时平移不动。 */
export function clampScale(prev: Transform, limits: Limits): Transform {
  const s = clamp(prev.scale, limits.min, limits.max)
  return s === prev.scale ? { ...prev } : { ...prev, scale: s }
}

/**
 * fit-to-screen：整张可见并居中。fit=min(stageW/svgW, stageH/svgH, 1)，
 * scale=max(fit,min)（不小于 min）；tx=(stageW-svgW*scale)/2 居中。
 * 大图 → scale<1 缩到整张可见；小图 → scale=1 原样居中。
 * svg 尺寸非正 → 退化 scale=min 居中(0,0)。
 */
export function fitToScreen(svgSize: Size, stageSize: Size, min: number): Transform {
  if (svgSize.w <= 0 || svgSize.h <= 0) return { scale: min, tx: 0, ty: 0 }
  const fit = Math.min(stageSize.w / svgSize.w, stageSize.h / svgSize.h, 1)
  const scale = Math.max(fit, min)
  return {
    scale,
    tx: (stageSize.w - svgSize.w * scale) / 2,
    ty: (stageSize.h - svgSize.h * scale) / 2,
  }
}
