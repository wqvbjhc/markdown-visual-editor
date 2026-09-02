import type { EditorView } from '@codemirror/view'

/**
 * 编辑器（CodeMirror .cm-scroller）与预览面板（.preview-pane）双向同步滚动。
 *
 * 原理：解析层 remark-source-line 给预览块级元素注入 data-source-line（源码起始行），
 * 滚动时把「来源侧视口顶」映射到行号坐标，再经锚点区间线性插值得到
 * 「目标侧滚动位置」，两侧连续对应不跳变。
 *
 * v2 平滑机制（替代时间戳锁）：
 * - 追逐动画：目标侧不瞬移，每帧 cur += (goal-cur)*(1-e^(-dt/τ)) 帧率无关指数趋近，
 *   小步滚动连续自然，源停后 ~200ms 收敛 <1px。
 * - 事件准入四规则：① 源侧事件处理；② 正被自己动画的侧忽略（回声）；
 *   ③ staleUntil 未到忽略（接管后旧源残余动量，250ms，掐断源身份拉锯）；
 *   ④ 其余处理并接管（覆盖 TOC 平滑滚动、滚动条拖拽——首帧即接管）。
 * - 手势接管：wheel/touchstart/pointerdown（两侧）+ keydown（编辑器）立即切源并抑制对侧动量。
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

/** 追逐动画通道：单实例，新 goal 只更新不重启循环 */
interface AnimState {
  targetSide: ScrollSide | null
  goal: number
  rafId: number | null
  lastT: number
  startT: number
  stillFrames: number
}

// 指数趋近时间常数：每 45ms 消除 ~63% 差值；100px 跳变约 5τ≈225ms 收敛
const SMOOTH_TAU = 45
// 收敛判定：残差 <0.75px（一个取整格的一半）连续两帧即停
const CONVERGE_EPS = 0.75
// 残差小于 2px 直接落 goal：scrollTop 写入被浏览器整数量化，渐进 step<0.5 写不进下一格，
// 会卡在 diff≈1 的死区永不收敛（实测 zombie 循环：不动画、不清 targetSide、吞真实输入、按陈旧 goal 回拉）
const SNAP_PX = 2
// 动画强制寿命：兜底防任何未预见死区产生僵尸循环
const ANIM_MAX_MS = 700
// 接管后旧源残余动量抑制窗口
const STALE_MS = 250

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max)
}

class ScrollSync {
  private editor: EditorView | null = null
  private pane: HTMLElement | null = null
  private anchors: Anchor[] = []
  private anchorsDirty = true
  private sourceSide: ScrollSide | null = null
  private staleUntil: Record<ScrollSide, number> = { editor: 0, preview: 0 }
  private anim: AnimState = { targetSide: null, goal: 0, rafId: null, lastT: 0, startT: 0, stillFrames: 0 }
  private rafId: number | null = null

  // ---- 注册 / 注销（组件挂载期成对调用）----

  registerEditor(view: EditorView): void {
    this.unregisterEditor()
    this.editor = view
    const dom = view.scrollDOM
    dom.addEventListener('scroll', this.onEditorScroll, { passive: true })
    this.bindGestures(dom, 'editor')
    // 键盘滚动（方向键/PageDown）与打字时光标 scrollIntoView 也算编辑器侧意图
    view.contentDOM.addEventListener('keydown', this.takeEditor)
  }

  unregisterEditor(): void {
    if (!this.editor) return
    this.editor.scrollDOM.removeEventListener('scroll', this.onEditorScroll)
    this.unbindGestures(this.editor.scrollDOM)
    this.editor.contentDOM.removeEventListener('keydown', this.takeEditor)
    this.editor = null
  }

  registerPreviewPane(pane: HTMLElement): void {
    this.unregisterPreviewPane()
    this.pane = pane
    pane.addEventListener('scroll', this.onPreviewScroll, { passive: true })
    this.bindGestures(pane, 'preview')
  }

  unregisterPreviewPane(): void {
    if (!this.pane) return
    this.pane.removeEventListener('scroll', this.onPreviewScroll)
    this.unbindGestures(this.pane)
    this.pane = null
  }

  /** 手势接管监听：滚轮/触摸/按下（两侧），滚动条拖拽无事件靠准入规则 ④ 兜底 */
  private bindGestures(dom: HTMLElement, side: ScrollSide): void {
    const handler = () => this.takeover(side)
    dom.addEventListener('wheel', handler, { passive: true })
    dom.addEventListener('touchstart', handler, { passive: true })
    dom.addEventListener('pointerdown', handler, { passive: true })
    this.gestureHandlerRef.set(dom, handler)
  }

  private unbindGestures(dom: HTMLElement): void {
    const handler = this.gestureHandlerRef.get(dom)
    if (!handler) return
    dom.removeEventListener('wheel', handler)
    dom.removeEventListener('touchstart', handler)
    dom.removeEventListener('pointerdown', handler)
    this.gestureHandlerRef.delete(dom)
  }

  /** WeakMap 保存同引用便于注销（addEventListener/removeEventListener 须同一函数） */
  private gestureHandlerRef = new WeakMap<HTMLElement, () => void>()

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

  // ---- 事件入口与准入 ----

  private onEditorScroll = (): void => this.handleScroll('editor')
  private onPreviewScroll = (): void => this.handleScroll('preview')
  private takeEditor = (): void => this.takeover('editor')

  /** 手势接管：立即切源，抑制旧源残余动量（防源身份往返拉锯），取消旧动画 */
  private takeover(side: ScrollSide): void {
    if (this.sourceSide === side) return
    this.sourceSide = side
    this.staleUntil[this.other(side)] = performance.now() + STALE_MS
    if (this.anim.targetSide === side) this.cancelAnim() // 新源不再是动画目标
  }

  private handleScroll(side: ScrollSide): void {
    const now = performance.now()
    // 规则②：自己动画产生的回声
    if (this.anim.targetSide === side) return
    // 规则③：接管后旧源残余动量
    if (now < this.staleUntil[side]) return
    // 规则①/④：源侧直接处理；非源侧（TOC 平滑滚动、滚动条拖拽等真实输入）接管
    this.sourceSide = side

    if (this.rafId !== null) return
    this.rafId = requestAnimationFrame(() => {
      this.rafId = null
      // 用当前源侧而非闭包 side：同帧内可能发生源切换（如双侧事件竞速）
      if (this.sourceSide) this.applySync(this.sourceSide)
    })
  }

  private other(side: ScrollSide): ScrollSide {
    return side === 'editor' ? 'preview' : 'editor'
  }

  // ---- 同步主流程：算 goal，交追逐动画 ----

  private applySync(side: ScrollSide): void {
    if (!this.editor || !this.pane) return
    if (this.anchorsDirty) this.rebuildAnchors()
    if (side === 'editor') this.syncEditorToPreview()
    else this.syncPreviewToEditor()
  }

  /** 编辑器 → 预览：视口顶源码位置（行 + 块内小数）→ 锚点行区间插值 → 动画到 goal */
  private syncEditorToPreview(): void {
    const view = this.editor!
    const pane = this.pane!
    const scroller = view.scrollDOM
    const pad = this.contentPadTop(view)

    if (this.anchors.length < 2) {
      // 降级：无锚点（空文档/纯 HTML）按比例同步
      this.animateTo('preview', this.proportionalGoal(scroller, pane))
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

    this.animateTo('preview', clamp(targetTop, 0, Math.max(0, pane.scrollHeight - pane.clientHeight)))
  }

  /** 预览 → 编辑器：视口顶锚点区间像素比例 → 反推行号小数 → 编辑器该行动画对齐视口顶 */
  private syncPreviewToEditor(): void {
    const view = this.editor!
    const pane = this.pane!

    if (this.anchors.length < 2) {
      this.animateTo('editor', this.proportionalGoal(pane, view.scrollDOM))
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

    this.animateTo('editor', clamp(block.top + pad, 0, Math.max(0, scroller.scrollHeight - scroller.clientHeight)))
  }

  /** 比例降级的 goal（不直接 set，走同一动画通道保持视觉一致） */
  private proportionalGoal(from: HTMLElement, to: HTMLElement): number {
    const fromMax = from.scrollHeight - from.clientHeight
    const toMax = to.scrollHeight - to.clientHeight
    if (fromMax <= 0 || toMax <= 0) return to.scrollTop
    return clamp((from.scrollTop / fromMax) * toMax, 0, toMax)
  }

  // ---- 追逐动画：每帧指数趋近 goal，帧率无关，收敛自停 ----

  private animateTo(targetSide: ScrollSide, goal: number): void {
    const changed = this.anim.targetSide !== targetSide
    if (changed) this.cancelAnim()
    this.anim.targetSide = targetSide
    this.anim.goal = goal
    if (this.anim.rafId !== null) return // 循环进行中，仅更新 goal
    this.anim.lastT = performance.now()
    this.anim.startT = this.anim.lastT
    this.anim.stillFrames = 0
    this.anim.rafId = requestAnimationFrame(this.stepAnim)
  }

  private stepAnim = (): void => {
    this.anim.rafId = null
    const target = this.anim.targetSide === 'editor' ? this.editor?.scrollDOM : this.pane
    if (!target || this.anim.targetSide === null) {
      this.cancelAnim()
      return
    }
    const now = performance.now()
    const dt = Math.max(1, now - this.anim.lastT)
    this.anim.lastT = now

    // 兜底寿命：任何未预见死区不得产生僵尸循环（僵尸态会吞真实输入并按陈旧 goal 回拉）
    if (now - this.anim.startT > ANIM_MAX_MS) {
      target.scrollTop = this.anim.goal
      this.finishAnim(target)
      return
    }

    const cur = target.scrollTop
    const diff = this.anim.goal - cur
    if (Math.abs(diff) < SNAP_PX) {
      // 残差小：直接落 goal（浏览器自行取整到最近格），跨过渐进写入的取整死区
      target.scrollTop = this.anim.goal
    } else {
      // 帧率无关指数趋近：每 τ 时间消除 63% 残差
      target.scrollTop = cur + diff * (1 - Math.exp(-dt / SMOOTH_TAU))
    }

    if (Math.abs(this.anim.goal - target.scrollTop) < CONVERGE_EPS) {
      this.anim.stillFrames += 1
      if (this.anim.stillFrames >= 2) this.finishAnim(target)
    } else {
      this.anim.stillFrames = 0
    }
    if (this.anim.rafId === null && this.anim.targetSide !== null) {
      this.anim.rafId = requestAnimationFrame(this.stepAnim)
    }
  }

  /** 收敛/终止出口：清动画身份并置陈旧窗吞末帧回声（防被动侧凭回声误接管源身份反向回拉） */
  private finishAnim(target: HTMLElement): void {
    const finishedSide = this.anim.targetSide
    target.scrollTop = this.anim.goal
    this.cancelAnim()
    if (finishedSide) this.staleUntil[finishedSide] = performance.now() + STALE_MS
  }

  private cancelAnim(): void {
    if (this.anim.rafId !== null) {
      cancelAnimationFrame(this.anim.rafId)
      this.anim.rafId = null
    }
    this.anim.targetSide = null
    this.anim.stillFrames = 0
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
