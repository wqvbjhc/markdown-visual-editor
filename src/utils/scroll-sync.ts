import type { EditorView } from '@codemirror/view'

/**
 * 编辑器（CodeMirror .cm-scroller）与预览面板（.preview-pane）双向同步滚动。
 *
 * 原理：解析层 remark-source-line 给预览块级元素注入 data-source-line（源码起始行），
 * 滚动时把「来源侧视口顶」映射到行号坐标，再经锚点区间线性插值得到
 * 「目标侧滚动位置」，两侧连续对应不跳变。
 *
 * 防回环：程序化写目标侧 scrollTop 前置 lockUntil 时间戳（120ms），
 * 目标侧回声 scroll 事件在锁窗口内且非来源侧 → 忽略；
 * 用户 wheel/touchstart 立即清锁（用户意图优先，不出现"顶死"）。
 *
 * 与 React 解耦：组件只 register/unregister，预览重渲染后调 onPreviewRendered()
 * 重建锚点缓存并按最近来源侧重对齐（innerHTML 整棵替换后内容高度变化会漂移）。
 */

type ScrollSide = 'editor' | 'preview'

/** 预览锚点：元素在 pane 内容坐标的顶部位置 + 源码行号（0 基，参与插值） */
interface Anchor {
  top: number
  line: number
}

const LOCK_MS = 120

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max)
}

class ScrollSync {
  private editor: EditorView | null = null
  private pane: HTMLElement | null = null
  private anchors: Anchor[] = []
  private anchorsDirty = true
  private lockUntil = 0
  private sourceSide: ScrollSide | null = null
  private rafId: number | null = null

  // ---- 注册 / 注销（组件挂载期成对调用）----

  registerEditor(view: EditorView): void {
    this.unregisterEditor()
    this.editor = view
    view.scrollDOM.addEventListener('scroll', this.onEditorScroll, { passive: true })
    view.scrollDOM.addEventListener('wheel', this.clearLock, { passive: true })
    view.scrollDOM.addEventListener('touchstart', this.clearLock, { passive: true })
  }

  unregisterEditor(): void {
    if (!this.editor) return
    this.editor.scrollDOM.removeEventListener('scroll', this.onEditorScroll)
    this.editor.scrollDOM.removeEventListener('wheel', this.clearLock)
    this.editor.scrollDOM.removeEventListener('touchstart', this.clearLock)
    this.editor = null
  }

  registerPreviewPane(pane: HTMLElement): void {
    this.unregisterPreviewPane()
    this.pane = pane
    pane.addEventListener('scroll', this.onPreviewScroll, { passive: true })
    pane.addEventListener('wheel', this.clearLock, { passive: true })
    pane.addEventListener('touchstart', this.clearLock, { passive: true })
  }

  unregisterPreviewPane(): void {
    if (!this.pane) return
    this.pane.removeEventListener('scroll', this.onPreviewScroll)
    this.pane.removeEventListener('wheel', this.clearLock)
    this.pane.removeEventListener('touchstart', this.clearLock)
    this.pane = null
  }

  /** 预览 innerHTML 重渲染完成后调用：失效锚点缓存并按最近来源侧重对齐 */
  onPreviewRendered(): void {
    this.anchorsDirty = true
    // 双 rAF：等 CodeBlock/Mermaid 替换与布局稳定后再重建锚点
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (this.sourceSide === 'editor') this.applySync('editor')
        else if (this.sourceSide === 'preview') this.applySync('preview')
      })
    })
  }

  // ---- 事件入口 ----

  private onEditorScroll = (): void => this.handleScroll('editor')
  private onPreviewScroll = (): void => this.handleScroll('preview')

  /** 用户直接操作（滚轮/触摸）立即清锁：目标侧回声与真用户输入不可分辨时，让位用户 */
  private clearLock = (): void => {
    this.lockUntil = 0
  }

  private handleScroll(side: ScrollSide): void {
    const now = performance.now()
    // 锁窗口内的对侧事件 = 程序化滚动的回声，忽略
    if (now < this.lockUntil && side !== this.sourceSide) return
    this.sourceSide = side
    if (this.rafId !== null) return
    this.rafId = requestAnimationFrame(() => {
      this.rafId = null
      this.applySync(side)
    })
  }

  // ---- 同步主流程 ----

  private applySync(side: ScrollSide): void {
    if (!this.editor || !this.pane) return
    if (this.anchorsDirty) this.rebuildAnchors()
    if (side === 'editor') this.syncEditorToPreview()
    else this.syncPreviewToEditor()
  }

  /** 编辑器 → 预览：视口顶源码位置（行 + 块内小数）→ 锚点行区间插值 → pane.scrollTop */
  private syncEditorToPreview(): void {
    const view = this.editor!
    const pane = this.pane!
    const scroller = view.scrollDOM
    const pad = this.contentPadTop(view)

    if (this.anchors.length < 2) {
      // 降级：无锚点（空文档/纯 HTML）按比例同步
      this.applyProportional(scroller, pane)
      return
    }

    // lineBlockAtHeight 的输入是相对 documentTop 的文档坐标高度；
    // 视口顶 = scrollTop - 内容 padding（推导见方案 §2）
    const h = clamp(scroller.scrollTop - pad, 0, Math.max(0, view.contentHeight))
    const block = view.lineBlockAtHeight(h)
    const line = view.state.doc.lineAt(block.from)
    const frac = block.height > 0 ? clamp((h - block.top) / block.height, 0, 1) : 0
    const srcLine = line.number - 1 + frac

    const [a1, a2] = this.searchByLine(srcLine)
    const span = a2.line - a1.line
    const t = span > 0 ? clamp((srcLine - a1.line) / span, 0, 1) : 0
    const targetTop = a1.top + t * (a2.top - a1.top)

    this.lockUntil = performance.now() + LOCK_MS
    pane.scrollTop = clamp(targetTop, 0, Math.max(0, pane.scrollHeight - pane.clientHeight))
  }

  /** 预览 → 编辑器：视口顶锚点区间像素比例 → 反推行号小数 → 编辑器该行对齐视口顶 */
  private syncPreviewToEditor(): void {
    const view = this.editor!
    const pane = this.pane!

    if (this.anchors.length < 2) {
      this.applyProportional(pane, view.scrollDOM)
      return
    }

    const vTop = pane.scrollTop
    const [a1, a2] = this.searchByTop(vTop)
    const span = a2.top - a1.top
    const t = span > 0 ? clamp((vTop - a1.top) / span, 0, 1) : 0
    const srcLine = a1.line + t * (a2.line - a1.line)

    const lineNo = clamp(Math.floor(srcLine) + 1, 1, view.state.doc.lines)
    const pos = view.state.doc.line(lineNo).from
    const block = view.lineBlockAt(pos)
    const pad = this.contentPadTop(view)
    const scroller = view.scrollDOM

    this.lockUntil = performance.now() + LOCK_MS
    scroller.scrollTop = clamp(block.top + pad, 0, Math.max(0, scroller.scrollHeight - scroller.clientHeight))
  }

  /** 比例降级：无锚点时按滚动进度百分比对应（长文档会漂，仅保不失效） */
  private applyProportional(from: HTMLElement, to: HTMLElement): void {
    const fromMax = from.scrollHeight - from.clientHeight
    const toMax = to.scrollHeight - to.clientHeight
    if (fromMax <= 0 || toMax <= 0) return
    this.lockUntil = performance.now() + LOCK_MS
    to.scrollTop = clamp((from.scrollTop / fromMax) * toMax, 0, toMax)
  }

  // ---- 锚点索引 ----

  /**
   * 重建锚点：pane 内全部 [data-source-line]，top 用 rect 差值换算
   * （不依赖 offsetParent，容器未设 position 时 offsetTop 不可靠）。
   * 嵌套同锚（ul 与首个 li 同行同 top）与乱序行号都收敛为行号严格递增序列，
   * 保证两个方向的二分查找单调性。
   */
  private rebuildAnchors(): void {
    this.anchorsDirty = false
    const pane = this.pane
    if (!pane) {
      this.anchors = []
      return
    }
    const paneRect = pane.getBoundingClientRect()
    const list: Anchor[] = []
    pane.querySelectorAll<HTMLElement>('[data-source-line]').forEach((el) => {
      const line = parseInt(el.getAttribute('data-source-line') || '', 10)
      if (!Number.isFinite(line)) return
      list.push({ top: el.getBoundingClientRect().top - paneRect.top + pane.scrollTop, line: line - 1 })
    })
    list.sort((a, b) => a.top - b.top || a.line - b.line)
    const dedup: Anchor[] = []
    for (const a of list) {
      const last = dedup[dedup.length - 1]
      // 同行号取最靠顶者（外层块）；行号不递增（异常 position）丢弃，维持严格递增
      if (last && a.line <= last.line) continue
      dedup.push(a)
    }
    this.anchors = dedup
  }

  /** 行号坐标二分：返回 srcLine 所在的相邻锚点区间 */
  private searchByLine(srcLine: number): [Anchor, Anchor] {
    const arr = this.anchors
    if (srcLine <= arr[0].line) return [arr[0], arr[Math.min(1, arr.length - 1)]]
    if (srcLine >= arr[arr.length - 1].line) return [arr[arr.length - 2], arr[arr.length - 1]]
    let lo = 0
    let hi = arr.length - 1
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1
      if (arr[mid].line <= srcLine) lo = mid
      else hi = mid
    }
    return [arr[lo], arr[hi]]
  }

  /** 像素坐标二分：返回 pane scrollTop 所在的相邻锚点区间 */
  private searchByTop(vTop: number): [Anchor, Anchor] {
    const arr = this.anchors
    if (vTop <= arr[0].top) return [arr[0], arr[Math.min(1, arr.length - 1)]]
    if (vTop >= arr[arr.length - 1].top) return [arr[arr.length - 2], arr[arr.length - 1]]
    let lo = 0
    let hi = arr.length - 1
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1
      if (arr[mid].top <= vTop) lo = mid
      else hi = mid
    }
    return [arr[lo], arr[hi]]
  }

  /** cm-content 的 padding-top（滚动坐标与文档坐标差，随主题重建可能变化，不缓存） */
  private contentPadTop(view: EditorView): number {
    return parseFloat(getComputedStyle(view.contentDOM).paddingTop) || 0
  }
}

export const scrollSync = new ScrollSync()
