import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { JSDOM } from 'jsdom'
import { processMarkdown } from '../src/pipeline/processor.ts'

// 回归：滚动同步的源行号锚点。
// remark-source-line 在 mdast 块级节点注入 data-source-line（源码起始行，1 基），
// 经 sanitize 后必须仍存在（白名单 '*' 含 dataSourceLine），否则 scroll-sync 拿不到锚点。
// 本测试守两个责任点：管线输出属性正确 + 白名单放行。

const md = [
  '# 标题',          // 1
  '',                // 2
  '段落一',           // 3
  '',                // 4
  '- 列表项 A',       // 5
  '- 列表项 B',       // 6
  '',                // 7
  '```ts',           // 8
  'const x = 1',     // 9
  '```',             // 10
  '',                // 11
  '> 引用',          // 12
  '',                // 13
  '| a | b |',       // 14
  '|---|---|',       // 15
  '| 1 | 2 |',       // 16
].join('\n')

const html = await processMarkdown(md, false)
const doc = new JSDOM(html).window.document

const lineOf = (sel: string) => doc.querySelector(sel)?.getAttribute('data-source-line')

// 标题 / 段落 / 引用：块级元素直接带行号
assert.equal(lineOf('h1'), '1', 'h1 应带 data-source-line=1')
assert.equal(lineOf('p'), '3', '首段 p 应带 data-source-line=3')
assert.equal(lineOf('blockquote'), '12', 'blockquote 应带 data-source-line=12')

// 列表整体 + 嵌套 li 分别带行号（长列表内部对齐依赖 li 锚点）
assert.equal(lineOf('ul'), '5', 'ul 应带 data-source-line=5')
const liLines = Array.from(doc.querySelectorAll('li')).map((li) => li.getAttribute('data-source-line'))
assert.deepEqual(liLines, ['5', '6'], `li 锚点应为 [5,6]，got: ${JSON.stringify(liLines)}`)

// 代码块：remark-rehype 把 code 节点的 hProperties 落在内层 <code>（pre>code）上
assert.equal(lineOf('pre > code'), '8', 'pre>code 应带 data-source-line=8')

// 表格：rehype-table-wrap 包了 .table-wrapper div，锚点在 table 上
assert.equal(lineOf('table'), '14', 'table 应带 data-source-line=14')

// Mermaid：rehype-mermaid 整体替换 pre，锚点须显式保留到 .mermaid-block（否则图块无法对齐）
const mermaidMd = ['```mermaid', 'graph TD; A-->B;', '```'].join('\n')
const mermaidHtml = await processMarkdown(mermaidMd, false)
const mermaidDoc = new JSDOM(mermaidHtml).window.document
assert.equal(
  mermaidDoc.querySelector('.mermaid-block')?.getAttribute('data-source-line'),
  '1',
  '.mermaid-block 应保留 data-source-line=1',
)

// —— 复制链路剥离：内部锚点不得流入剪贴板/外部平台 ——
// sanity：store.html 串里锚点存在（预览同步依赖），剥离只发生在复制链路单点
assert.ok(html.includes('data-source-line'), '管线输出应含 data-source-line（sanity）')
// 行为导入走不通（media-export 链上 @/components/CodeBlock.tsx，node 不解析 JSX），
// 按项目惯例用源码正则守复制链路单点（同 heading-links.test.ts 模式）
const mediaExportSrc = readFileSync(new URL('../src/utils/media-export.ts', import.meta.url), 'utf8')
assert.match(
  mediaExportSrc,
  /querySelectorAll\('\[data-source-line\]'\)/,
  'prepareClipboardHtml 应查 [data-source-line] 并剥离（复制链路单点）',
)
assert.match(
  mediaExportSrc,
  /removeAttribute\('data-source-line'\)/,
  'prepareClipboardHtml 应 removeAttribute data-source-line',
)

// sanitize 白名单防回归：'*' 通配须含 dataSourceLine，否则属性被静默剥（本项目已知坑）
const schemaSrc = readFileSync(new URL('../src/utils/sanitize-schema.ts', import.meta.url), 'utf8')
assert.match(schemaSrc, /'\*':\s*\[[^\]]*'dataSourceLine'/, "sanitize 白名单 '*' 应含 dataSourceLine")

console.log('source-line anchors ok')
