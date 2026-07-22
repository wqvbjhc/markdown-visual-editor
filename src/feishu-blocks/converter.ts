/**
 * mdast → 飞书 docx block 转换器。
 *
 * 跑在浏览器（复用 remark parse pipeline，worker 不背 remark 依赖）。
 * 产 `{ children_id, descendants }`（descendant API 一次建整棵树），POST 给 Worker。
 *
 * Phase 2 覆盖：heading / paragraph / list(含 todo、嵌套) / code / blockquote / thematicBreak /
 *   table / inline(text/strong/em/delete/inlineCode/link/break)。
 * 公式(math/inlineMath)：equation element（飞书原生 LaTeX，自动渲染，content 不带 $）。
 * 图片（Phase 4）/ Mermaid（Phase 5 浏览器渲染 PNG）：产空 image block + 收集到 images 清单。
 *
 * 对照 huandu `transformer.ts`，但我们用 descendant 单次建树（huandu 也是），且自带公式支持。
 */

import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkCjkFriendly from 'remark-cjk-friendly'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkBreaks from 'remark-breaks'
import remarkDirective from 'remark-directive'
import type {
  Blockquote,
  Code,
  Heading,
  Image,
  List,
  ListItem,
  Nodes,
  Paragraph,
  PhrasingContent,
  Root,
  RootContent,
  Table,
  TableCell,
} from 'mdast'
import { remarkDeAI } from '../pipeline/plugins/remark-deai'
import {
  BlockType,
  type DescendantPayload,
  type FeishuBlock,
  type TextBlockData,
  type TextElement,
  type TextElementStyle,
  mapCodeLanguage,
} from './types'

/** heading level → block_type */
const HEADING_BLOCK_TYPE: Record<1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9, number> = {
  1: BlockType.Heading1, 2: BlockType.Heading2, 3: BlockType.Heading3,
  4: BlockType.Heading4, 5: BlockType.Heading5, 6: BlockType.Heading6,
  7: BlockType.Heading7, 8: BlockType.Heading8, 9: BlockType.Heading9,
}

export interface ConvertOptions {
  enableDeAI?: boolean
}

/** 待上传图片（block_id 是临时 id，src 待浏览器解析+fetch 字节） */
export interface ImageUpload {
  block_id: string
  src: string
  /** 'image'=普通图（src 解析 fetch）；'mermaid'=浏览器渲染 PNG（mermaidCode 出图） */
  kind?: 'image' | 'mermaid'
  /** mermaid 源码（kind='mermaid' 时） */
  mermaidCode?: string
}

export interface ConvertResult {
  payload: DescendantPayload
  title: string
  warnings: string[]
  images: ImageUpload[]
}

interface ConvertContext {
  descendants: FeishuBlock[]
  warnings: string[]
  images: ImageUpload[]
}

/** 临时 block_id：客户端自定义，飞书经 block_id_relations 回映射。非 secure context（http 非 localhost）crypto.randomUUID 缺失时 fallback */
function genId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `b-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/** 构建只做 parse 的 processor（缓存两变体，避免每次 export 重建插件链） */
const parserCache = new Map<boolean, ReturnType<typeof unified>>()
function buildParser(enableDeAI: boolean) {
  const cached = parserCache.get(enableDeAI)
  if (cached) return cached
  const p = unified()
    .use(remarkParse)
    .use(remarkCjkFriendly)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkBreaks)
    .use(remarkDirective)
  if (enableDeAI) p.use(remarkDeAI)
  parserCache.set(enableDeAI, p as unknown as ReturnType<typeof unified>)
  return p
}

/**
 * Markdown → 飞书 descendant payload + 文档标题。
 */
export function convertMarkdownToFeishu(md: string, opts: ConvertOptions = {}): ConvertResult {
  const { enableDeAI = false } = opts
  const tree = buildParser(enableDeAI).parse(md) as Root
  const ctx: ConvertContext = { descendants: [], warnings: [], images: [] }
  const childrenId: string[] = []

  // title 优先取首个 heading 文本；无 heading 再回退首个产 id 的块（不再把首段当前言当标题）
  let title = ''
  const firstHeading = tree.children.find((c) => c.type === 'heading')
  if (firstHeading) {
    const t = extractPlainText(firstHeading)
    if (t) title = clipTitle(t)
  }

  for (const node of tree.children) {
    const ids = emitNode(node, ctx)
    for (const id of ids) {
      childrenId.push(id)
      if (!title) {
        const t = extractPlainText(node)
        if (t) title = clipTitle(t)
      }
    }
  }

  return {
    payload: { children_id: childrenId, descendants: ctx.descendants },
    title: title || '未命名文档',
    warnings: ctx.warnings,
    images: ctx.images,
  }
}

/** 标题截断：按 Unicode 码点（Array.from）取前 100，避免 emoji 代理对中间截断产孤立 surrogate */
function clipTitle(s: string): string {
  return Array.from(s).slice(0, 100).join('')
}

/** 把一个块级节点发射到 ctx.descendants，返回它在当前层级的 ID 列表（list/table 等可能返回多个） */
function emitNode(node: RootContent, ctx: ConvertContext): string[] {
  switch (node.type) {
    case 'heading':
      return [emitHeading(node, ctx)]
    case 'paragraph':
      return emitParagraph(node, ctx)
    case 'list':
      return emitList(node, ctx)
    case 'code':
      return [emitCode(node, ctx)]
    case 'blockquote':
      return [emitBlockquote(node, ctx)]
    case 'thematicBreak':
      return [emitDivider(ctx)]
    case 'table':
      return [emitTable(node, ctx)]
    case 'html':
      return [emitTextBlock([makeTextElement(stripTags(node.value))], ctx)]
    case 'math':
      // 块级公式：equation element（content 是 LaTeX，不带 $$）
      return [emitTextBlock([makeEquationElement(node.value)], ctx)]
    default: {
      // 指令节点（::image 等，remark-directive 产生；TS 类型未扩展进 RootContent，运行时存在）
      const d = node as unknown as { type: string; name?: string; attributes?: Record<string, string> }
      if (d.type === 'leafDirective' || d.type === 'containerDirective' || d.type === 'textDirective') {
        if (d.name === 'image' && d.attributes?.src) {
          return [emitImageBlock(d.attributes.src, ctx)]
        }
        if (d.name === 'video') {
          ctx.warnings.push('视频不支持导出到飞书文档，已跳过')
          return []
        }
        ctx.warnings.push(`未支持的指令: ${d.name || '(unnamed)'}`)
        return []
      }
      ctx.warnings.push(`未支持的块级节点: ${(node as { type: string }).type}`)
      return []
    }
  }
}

function emitHeading(node: Heading, ctx: ConvertContext): string {
  const level = Math.min(Math.max(node.depth, 1), 9) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9
  // 飞书 heading 块 text_element_style 不接受 text_color（int/string 均 99992402 field validation failed），
  // 且 docx text_color 是预设枚举 int 非任意 hex；heading 用飞书原生层级色，不上色。
  const elements = extractElements(node.children, {}, ctx)
  const block: FeishuBlock = {
    block_id: genId(),
    block_type: HEADING_BLOCK_TYPE[level],
    children: [],
  }
  ;(block as unknown as Record<string, unknown>)[`heading${level}`] = { elements: ensureNonEmpty(elements) } as TextBlockData
  ctx.descendants.push(block)
  return block.block_id
}

function emitParagraph(node: Paragraph, ctx: ConvertContext): string[] {
  // 单图段落：产 image block + 收集 src（Phase 4 由浏览器 fetch 字节、Worker 上传绑定）
  if (node.children.length === 1 && node.children[0]?.type === 'image') {
    const img = node.children[0] as Image
    if (img.url) return [emitImageBlock(img.url, ctx)]
    return [emitTextBlock([makeTextElement(img.alt || '[图片]')], ctx)]
  }
  const elements = extractElements(node.children, {}, ctx)
  if (elements.length === 0) return []
  return [emitTextBlock(elements, ctx)]
}

function emitList(node: List, ctx: ConvertContext): string[] {
  const ordered = node.ordered ?? false
  // 飞书 ordered 列表自动从 1 编号，不支持 mdast List.start；非 1 起始给 warning
  if (ordered && node.start && node.start > 1) {
    ctx.warnings.push(`有序列表起始号 ${node.start} 飞书不支持，将从 1 开始编号`)
  }
  const ids: string[] = []
  for (const item of node.children) {
    const id = emitListItem(item, ordered, ctx)
    if (id) ids.push(id)
  }
  return ids
}

function emitListItem(item: ListItem, ordered: boolean, ctx: ConvertContext): string | null {
  // 任务列表项
  if (item.checked !== null && item.checked !== undefined) {
    return emitTodoItem(item, ctx)
  }

  // 第一个段落作列表项正文；其余段落/嵌套列表作子块
  let elements: TextElement[] = []
  const rest: RootContent[] = []
  for (const child of item.children) {
    if (child.type === 'paragraph' && elements.length === 0) {
      elements = extractElements(child.children, {}, ctx)
    } else {
      rest.push(child)
    }
  }

  const block: FeishuBlock = {
    block_id: genId(),
    block_type: ordered ? BlockType.Ordered : BlockType.Bullet,
    children: [],
    [ordered ? 'ordered' : 'bullet']: { elements: ensureNonEmpty(elements) },
  }
  ctx.descendants.push(block)

  // 嵌套内容挂为该列表项的子块（飞书用 children 表达缩进层级）
  for (const child of rest) {
    const childIds = emitNode(child, ctx)
    block.children.push(...childIds)
  }
  return block.block_id
}

function emitTodoItem(item: ListItem, ctx: ConvertContext): string {
  // 首段作 todo 正文；其余段落/嵌套列表作子块（与 emitListItem 一致，不再 break 丢后续 children）
  let elements: TextElement[] = []
  const rest: RootContent[] = []
  for (const child of item.children) {
    if (child.type === 'paragraph' && elements.length === 0) {
      elements = extractElements(child.children, {}, ctx)
    } else {
      rest.push(child)
    }
  }
  const block: FeishuBlock = {
    block_id: genId(),
    block_type: BlockType.Todo,
    children: [],
    todo: { elements: ensureNonEmpty(elements), style: { done: item.checked ?? false } },
  }
  ctx.descendants.push(block)
  for (const child of rest) {
    block.children.push(...emitNode(child, ctx))
  }
  return block.block_id
}

function emitCode(node: Code, ctx: ConvertContext): string {
  // Mermaid：产空 image block + 收集源码，浏览器渲染 PNG 走图片上传 3 步链路
  if (node.lang && node.lang.toLowerCase().trim() === 'mermaid') {
    const id = genId()
    ctx.descendants.push({
      block_id: id,
      block_type: BlockType.Image,
      children: [],
      image: {},
    })
    ctx.images.push({ block_id: id, src: '', kind: 'mermaid', mermaidCode: node.value })
    return id
  }
  const block: FeishuBlock = {
    block_id: genId(),
    block_type: BlockType.Code,
    children: [],
    code: {
      elements: [makeTextElement(node.value)],
      style: { language: mapCodeLanguage(node.lang), wrap: false },
    },
  }
  ctx.descendants.push(block)
  return block.block_id
}

function emitBlockquote(node: Blockquote, ctx: ConvertContext): string {
  const container: FeishuBlock = {
    block_id: genId(),
    block_type: BlockType.QuoteContainer,
    children: [],
    quote_container: {},
  }
  ctx.descendants.push(container)
  for (const child of node.children) {
    container.children.push(...emitNode(child, ctx))
  }
  return container.block_id
}

function emitDivider(ctx: ConvertContext): string {
  const block: FeishuBlock = {
    block_id: genId(),
    block_type: BlockType.Divider,
    children: [],
    divider: {},
  }
  ctx.descendants.push(block)
  return block.block_id
}

function emitTable(node: Table, ctx: ConvertContext): string {
  const rows = node.children
  const rowSize = rows.length
  const columnSize = rows[0]?.children.length ?? 0
  if (rowSize === 0 || columnSize === 0) {
    ctx.warnings.push('空表格已跳过')
    return emitTextBlock([makeTextElement('[空表格]')], ctx)
  }

  // 列宽估算：用纯文本长度（extractPlainText 无副作用，避免 extractElements 重复跑 + 重复 push warning）
  const colMax = new Array<number>(columnSize).fill(0)
  for (const row of rows) {
    row.children.forEach((cell, col) => {
      if (col < columnSize) {
        const len = extractPlainText(cell).length
        colMax[col] = Math.max(colMax[col] ?? 0, len)
      }
    })
  }
  const columnWidth = colMax.map((len) => (len <= 2 ? 50 : len <= 4 ? 80 : len === 5 ? 100 : len === 6 ? 120 : 130))

  const cellIds: string[] = []
  for (const row of rows) {
    for (const cell of row.children) {
      cellIds.push(emitTableCell(cell, ctx))
    }
  }

  const tableBlock: FeishuBlock = {
    block_id: genId(),
    block_type: BlockType.Table,
    children: cellIds,
    table: {
      property: {
        row_size: rowSize,
        column_size: columnSize,
        column_width: columnWidth,
        header_row: true,
      },
    },
  }
  ctx.descendants.push(tableBlock)
  return tableBlock.block_id
}

function emitTableCell(cell: TableCell, ctx: ConvertContext): string {
  const cellBlock: FeishuBlock = {
    block_id: genId(),
    block_type: BlockType.TableCell,
    children: [],
    table_cell: {},
  }
  ctx.descendants.push(cellBlock)
  const elements = extractElements(cell.children, {}, ctx)
  const contentBlock: FeishuBlock = {
    block_id: genId(),
    block_type: BlockType.Text,
    children: [],
    text: { elements: ensureNonEmpty(elements) },
  }
  ctx.descendants.push(contentBlock)
  cellBlock.children.push(contentBlock.block_id)
  return cellBlock.block_id
}

/**
 * 产空 image block（block_type 27，token 空）+ 收集到 ctx.images。
 * 浏览器侧 fetch 图片字节(base64)随请求送 Worker，Worker：
 *   1) descendant 建块返回 block_id_relations 把临时 id 映射成真实 id
 *   2) upload_all(parent_node=真实 id, parent_type=docx_image) → file_token
 *   3) batch_update replace_image 把 token 绑回块
 */
function emitImageBlock(src: string, ctx: ConvertContext): string {
  const id = genId()
  ctx.descendants.push({
    block_id: id,
    block_type: BlockType.Image,
    children: [],
    image: {},
  })
  ctx.images.push({ block_id: id, src })
  return id
}

function emitTextBlock(elements: TextElement[], ctx: ConvertContext): string {
  const block: FeishuBlock = {
    block_id: genId(),
    block_type: BlockType.Text,
    children: [],
    text: { elements: ensureNonEmpty(elements) },
  }
  ctx.descendants.push(block)
  return block.block_id
}

// ───────────────────────────── inline ─────────────────────────────

interface StyleContext {
  bold?: boolean
  italic?: boolean
  strikethrough?: boolean
  underline?: boolean
  inlineCode?: boolean
  link?: string
}

/** phrasing 节点 → TextElement[]（处理嵌套样式） */
function extractElements(nodes: PhrasingContent[], style: StyleContext, ctx: ConvertContext): TextElement[] {
  const out: TextElement[] = []
  for (const node of nodes) {
    switch (node.type) {
      case 'text':
        out.push(makeTextElement(node.value, style))
        break
      case 'strong':
        out.push(...extractElements(node.children as PhrasingContent[], { ...style, bold: true }, ctx))
        break
      case 'emphasis':
        out.push(...extractElements(node.children as PhrasingContent[], { ...style, italic: true }, ctx))
        break
      case 'delete':
        out.push(...extractElements(node.children as PhrasingContent[], { ...style, strikethrough: true }, ctx))
        break
      case 'inlineCode':
        out.push(makeTextElement(node.value, { ...style, inlineCode: true }))
        break
      case 'link':
        out.push(...extractElements(node.children as PhrasingContent[], { ...style, link: node.url }, ctx))
        break
      case 'break':
        out.push(makeTextElement('\n', style))
        break
      case 'inlineMath':
        out.push(makeEquationElement(node.value))
        break
      case 'image':
        // 段落内 inline image 无法转 block 级 image block（飞书 image 是 block 级），降级 alt + warning
        ctx.warnings.push(`行内图片「${node.alt || '未命名'}」无法在段落内显示，已降级为文本（独占段落的图才上传）`)
        out.push(makeTextElement(node.alt || '[图片]', style))
        break
      case 'html':
        out.push(makeTextElement(stripTags(node.value), style))
        break
      default:
        if ('children' in node && Array.isArray(node.children)) {
          out.push(...extractElements(node.children as PhrasingContent[], style, ctx))
        } else {
          ctx.warnings.push(`未支持的行内节点: ${node.type}`)
        }
    }
  }
  return out
}

function makeTextElement(content: string, style: StyleContext = {}): TextElement {
  return { text_run: { content, text_element_style: buildStyle(style) } }
}

/** 公式 element：content 是 LaTeX 源（不带 $ delimiters），飞书自动渲染 */
function makeEquationElement(content: string): TextElement {
  return { equation: { content } }
}

function buildStyle(ctx: StyleContext): TextElementStyle | undefined {
  const s: TextElementStyle = {}
  let has = false
  if (ctx.bold) { s.bold = true; has = true }
  if (ctx.italic) { s.italic = true; has = true }
  if (ctx.strikethrough) { s.strikethrough = true; has = true }
  if (ctx.underline) { s.underline = true; has = true }
  if (ctx.inlineCode) { s.inline_code = true; has = true }
  if (ctx.link) { s.link = { url: ctx.link }; has = true }
  return has ? s : undefined
}

function ensureNonEmpty(elements: TextElement[]): TextElement[] {
  return elements.length > 0 ? elements : [makeTextElement('')]
}

/** 取节点纯文本（用于文档标题 / 表格列宽估算，walk 通用） */
function extractPlainText(node: Nodes): string {
  let text = ''
  const walk = (n: Nodes) => {
    if ('value' in n && typeof n.value === 'string') text += n.value
    if ('children' in n && Array.isArray(n.children)) n.children.forEach(walk)
  }
  walk(node as Nodes)
  return text.trim()
}

/** 极简去标签（html 节点降级为文本用） */
function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, '').trim()
}
