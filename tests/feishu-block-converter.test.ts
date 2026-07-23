import assert from 'node:assert/strict'
import { convertMarkdownToFeishu } from '../src/feishu-blocks/converter.ts'
import { BlockType } from '../src/feishu-blocks/types.ts'

// 帮助：按 block_type 找第一个块
function findBlock(result: ReturnType<typeof convertMarkdownToFeishu>, type: number) {
  return result.payload.descendants.find((b) => b.block_type === type)
}

// ── 1. 标题 + 段落：标题取首 heading，children_id 含顶层块 ──────────────
{
  const r = convertMarkdownToFeishu('# 标题一\n\n正文段落')
  assert.equal(r.title, '标题一', 'title 应取首个 heading 文本')
  assert.equal(r.payload.children_id.length, 2, '顶层两块（heading + paragraph）')
  const h1 = findBlock(r, BlockType.Heading1)
  assert.ok(h1, '应有 H1 块')
  assert.equal(h1?.heading1?.elements[0]?.text_run?.content, '标题一')
  const text = findBlock(r, BlockType.Text)
  assert.equal(text?.text?.elements[0]?.text_run?.content, '正文段落')
}

// ── 2. 行内样式：bold/italic/inlineCode/link（样式间有空格文本节点，用 some 匹配）──
{
  const r = convertMarkdownToFeishu('**粗** *斜* `码` [链](https://x.test)')
  const t = findBlock(r, BlockType.Text)
  const styles = (t?.text?.elements ?? []).map((e) => e.text_run?.text_element_style)
  assert.ok(styles.some((s) => s?.bold), '粗体')
  assert.ok(styles.some((s) => s?.italic), '斜体')
  assert.ok(styles.some((s) => s?.inline_code), '行内代码')
  assert.ok(styles.some((s) => s?.link?.url === 'https://x.test'), '链接')
}

// ── 3. 列表：无序 / 有序 / todo ──────────────────────────────────────
{
  const r = convertMarkdownToFeishu('- a\n- b\n1. c\n2. d\n- [ ] 待办\n- [x] 完成')
  const bullets = r.payload.descendants.filter((b) => b.block_type === BlockType.Bullet)
  const ordered = r.payload.descendants.filter((b) => b.block_type === BlockType.Ordered)
  const todos = r.payload.descendants.filter((b) => b.block_type === BlockType.Todo)
  assert.equal(bullets.length, 2, '两个无序项')
  assert.equal(ordered.length, 2, '两个有序项')
  assert.equal(todos.length, 2, '两个 todo')
  assert.equal(todos[0]?.todo?.style?.done, false, '未完成')
  assert.equal(todos[1]?.todo?.style?.done, true, '已完成')
}

// ── 4. 代码块：语言枚举映射（ts → TypeScript=63）──────────────────────
{
  const r = convertMarkdownToFeishu('```typescript\nconst a = 1\n```')
  const code = findBlock(r, BlockType.Code)
  assert.equal(code?.code?.style.language, 63, 'typescript → CodeLanguage.TypeScript=63')
  assert.equal(code?.code?.elements[0]?.text_run?.content, 'const a = 1', '代码内容')
}

// ── 5. 引用：quote_container + 子段落，父子引用正确 ───────────────────
{
  const r = convertMarkdownToFeishu('> 引用内容')
  const qc = findBlock(r, BlockType.QuoteContainer)
  assert.ok(qc, '应有 quote_container 块')
  assert.equal(qc?.children.length, 1, '容器有一个子块')
  const childId = qc?.children[0]
  const child = r.payload.descendants.find((b) => b.block_id === childId)
  assert.equal(child?.block_type, BlockType.Text, '子块是文本块')
  assert.equal(child?.text?.elements[0]?.text_run?.content, '引用内容')
  assert.ok(
    !r.payload.children_id.includes(childId ?? ''),
    '引用子块不应出现在顶层 children_id（它是容器的子块，不是文档根的直接子块）',
  )
  assert.ok(r.payload.children_id.includes(qc!.block_id), '容器本身在顶层')
}

// ── 6. 分隔线：divider 空数据 ────────────────────────────────────────
{
  const r = convertMarkdownToFeishu('a\n\n---\n\nb')
  const divider = findBlock(r, BlockType.Divider)
  assert.ok(divider, '应有 divider 块')
  assert.deepEqual(divider?.divider, {}, 'divider 数据为空对象')
}

// ── 7. 表格：table + cells，结构 row/column 正确 ─────────────────────
{
  const r = convertMarkdownToFeishu('| A | B |\n|---|---|\n| 1 | 2 |')
  const table = findBlock(r, BlockType.Table)
  assert.ok(table, '应有 table 块')
  assert.equal(table?.table?.property.row_size, 2, '2 行（含表头，GFM 不渲染分隔行）')
  assert.equal(table?.table?.property.column_size, 2, '2 列')
  const cells = r.payload.descendants.filter((b) => b.block_type === BlockType.TableCell)
  assert.equal(cells.length, 4, '4 个单元格（2×2）')
  // 每个单元格应有 1 个文本子块
  for (const c of cells) {
    assert.equal(c.children.length, 1, '单元格挂一个内容块')
    const content = r.payload.descendants.find((b) => b.block_id === c.children[0])
    assert.equal(content?.block_type, BlockType.Text)
  }
}

// ── 8. 嵌套列表：子列表挂为父项 children（飞书用 children 表达缩进）────
{
  const r = convertMarkdownToFeishu('- 父\n  - 子')
  const parent = r.payload.descendants.find(
    (b) => b.block_type === BlockType.Bullet && b.bullet?.elements[0]?.text_run?.content === '父',
  )
  assert.ok(parent, '应有父列表项')
  assert.equal(parent?.children.length, 1, '父项挂一个嵌套子项')
  const nested = r.payload.descendants.find((b) => b.block_id === parent?.children[0])
  assert.equal(nested?.block_type, BlockType.Bullet, '嵌套项也是 bullet')
  assert.equal(nested?.bullet?.elements[0]?.text_run?.content, '子')
}

// ── 9. 公式：math/inlineMath → equation element（飞书原生 LaTeX，自动渲染）─
{
  const r = convertMarkdownToFeishu('行内 $E=mc^2$ 公式')
  const t = findBlock(r, BlockType.Text)
  const eqs = (t?.text?.elements ?? []).map((e) => e.equation?.content).filter(Boolean) as string[]
  assert.ok(eqs.includes('E=mc^2'), 'inlineMath → equation element content=E=mc^2（不带 $）')
  const txts = (t?.text?.elements ?? []).map((e) => e.text_run?.content).filter(Boolean) as string[]
  assert.ok(txts.join('').includes('行内') && txts.join('').includes('公式'), '行内公式前后文本保留')
  assert.ok(!r.warnings.some((w) => w.includes('Phase 3')), 'inlineMath 不再打 Phase 3 warning')

  const r2 = convertMarkdownToFeishu('$$\nx^2\n$$')
  const t2 = findBlock(r2, BlockType.Text)
  const eq2 = t2?.text?.elements.find((e) => e.equation)?.equation
  assert.ok(eq2?.content?.includes('x^2'), '块级 math → equation element')
  assert.ok(!r2.warnings.some((w) => w.includes('Phase 3')), '块级公式不再打 Phase 3 warning')
}

// ── 10. 临时 block_id 全局唯一（descendant API 要求）─────────────────
{
  const r = convertMarkdownToFeishu('# a\n\nb\n\nc')
  const ids = r.payload.descendants.map((b) => b.block_id)
  assert.equal(new Set(ids).size, ids.length, '所有 block_id 唯一')
}

// ── 11. 图片：::image 指令 → 空 image block + images 清单（Phase 4，token 待 Worker 填）─
{
  const r = convertMarkdownToFeishu('::image{src="local-media://abc" alt="图A"}')
  const imgBlock = r.payload.descendants.find((b) => b.block_type === BlockType.Image)
  assert.ok(imgBlock, '::image 应产 image block')
  assert.deepEqual(imgBlock?.image, {}, 'image block 初始空（token 待 Worker 填）')
  assert.equal(r.images.length, 1, 'images 清单一条')
  assert.equal(r.images[0]?.src, 'local-media://abc', 'images[0].src 是 directive src')
  assert.equal(r.images[0]?.block_id, imgBlock?.block_id, 'image block_id 与 images 清单一致')
  assert.ok(r.payload.children_id.includes(imgBlock!.block_id), 'image block 在顶层')
}

// ── 12. 原生 ![]() 单图段落也走 image block ─────────────────────────
{
  const r = convertMarkdownToFeishu('![](https://x.test/a.png)')
  const imgBlock = r.payload.descendants.find((b) => b.block_type === BlockType.Image)
  assert.ok(imgBlock, '原生图也产 image block')
  assert.equal(r.images[0]?.src, 'https://x.test/a.png')
}

// ── 14. Mermaid 代码块 → image block + images（kind=mermaid，浏览器渲染 PNG）────
{
  const r = convertMarkdownToFeishu('```mermaid\ngraph TD\nA-->B\n```')
  const imgBlock = r.payload.descendants.find((b) => b.block_type === BlockType.Image)
  assert.ok(imgBlock, 'mermaid 应产 image block（而非 code block）')
  assert.deepEqual(imgBlock?.image, {}, 'mermaid image block 初始空')
  const codeBlocks = r.payload.descendants.filter((b) => b.block_type === BlockType.Code)
  assert.equal(codeBlocks.length, 0, 'mermaid 不应再产 code block')
  assert.equal(r.images.length, 1, 'images 清单一条')
  assert.equal(r.images[0]?.kind, 'mermaid', 'kind=mermaid')
  assert.equal(r.images[0]?.mermaidCode, 'graph TD\nA-->B', 'mermaidCode 保留源')
  assert.equal(r.images[0]?.block_id, imgBlock?.block_id, 'block_id 一致')
}

// ── 15. todo 嵌套 children 不丢（emitTodoItem 不再 break）──────────────
{
  const r = convertMarkdownToFeishu('- [x] 任务\n\n  详述\n\n  - 子项')
  const todo = r.payload.descendants.find((b) => b.block_type === BlockType.Todo)
  assert.ok(todo, '有 todo 块')
  assert.equal(todo?.todo?.elements[0]?.text_run?.content, '任务', 'todo 正文=首段')
  assert.ok((todo?.children.length ?? 0) >= 1, 'todo 子块不丢（详述/嵌套项）')
}

// ── 16. title 取首个 heading（非首段前言）────────────────────────────
{
  const r = convertMarkdownToFeishu('前言介绍\n\n# 真正标题\n\n正文')
  assert.equal(r.title, '真正标题', 'title 取首个 heading 非 first node')
}

console.log('feishu block converter ok')
