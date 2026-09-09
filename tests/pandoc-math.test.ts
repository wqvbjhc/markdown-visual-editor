import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import { processMarkdown } from '../src/pipeline/processor.ts'
import { convertPandocMathDelimiters } from '../src/pipeline/pandoc-math.ts'

// 回归：Pandoc 风格 \(...\) / \[...\] 公式定界符。
// remark-math 只认 $/$$；\( 落进 CommonMark 先被反斜杠转义吃掉（\(V_s\) → (V_s)），
// 残留 _ 下标再被强调规则跨段配对成 <em>，双重损坏。
// pandoc-math.ts 在 parse 前归一化成 $/$$，本测试守这个责任点。

// 1. 用户实报段落：全部公式渲染成 KaTeX，无 <em> 误吞、无残留 \( 、下标原样进公式
const userMd =
  '令视频中第 s 个候选人脸轨迹为 \\(V_s=\\{v_{s,t}\\}_{t=1}^{T}\\)，共享音频为 \\(A\\)，标签为 \\(y_{s,t}\\in\\{0,1\\}\\)。经典 ASD 学习函数 \\(p_{s,t}=f(V_s,A,\\mathcal{C})\\)，其中 \\(\\mathcal{C}\\) 可包含其他候选人、历史上下文或空间线索。输出是候选人级、帧级概率。'
const userHtml = await processMarkdown(userMd, false)
const userDoc = new JSDOM(userHtml).window.document
assert.equal(userDoc.querySelectorAll('.katex').length, 5, '五处行内公式全部渲染')
assert.equal(userDoc.querySelectorAll('em').length, 0, '下划线下标不得配对成 <em>')
assert.ok(!userHtml.includes('\\(') && !userHtml.includes('\\)'), '不得残留裸 \\( \\) 定界符')
// 公式文本进了 KaTeX（annotation 保留 LaTeX 源码）
assert.ok(userHtml.includes('V_s'), '公式源码保留在 KaTeX annotation')

// 2. display 公式 \[...\]：标准多行形态（\[\n内容\n\]）→ $$\n$$ → katex-display，
//    且原位替换零行偏移；单行形态 \[x\] 产 $$x$$ 为 inline 渲染（正确公式、非居中块）
const dispHtml = await processMarkdown('\\[\nE = mc^2\n\\]', false)
const dispDoc = new JSDOM(dispHtml).window.document
assert.equal(dispDoc.querySelectorAll('.katex-display').length, 1, '多行 display 公式渲染')
assert.equal(dispDoc.querySelectorAll('.katex').length, 1, 'display 公式内容完整')
const dispInlineHtml = await processMarkdown('\\[E = mc^2\\]', false)
assert.equal(new JSDOM(dispInlineHtml).window.document.querySelectorAll('.katex').length, 1, '单行 \\[x\\] 渲染为公式（inline 形态）')

// 3. 代码保护：行内代码与代码块里的定界符原样保留
const codeMd = '行内 `\\(x\\)` 与\n\n```\n\\(y\\)\n```\n\n正文 \\(z\\) 公式'
const codeHtml = await processMarkdown(codeMd, false)
const codeDoc = new JSDOM(codeHtml).window.document
assert.ok(codeHtml.includes('\\(x\\)'), '行内代码内定界符原样保留')
assert.ok(codeHtml.includes('\\(y\\)'), '代码块内定界符原样保留')
assert.equal(codeDoc.querySelectorAll('.katex').length, 1, '只有正文公式被渲染')

// 4. 不成对定界符不转换（落单 $ 只会更糟）；裸 \( 本就被 CommonMark 转义吃成 (
const soloHtml = await processMarkdown('孤立的 \\( 未闭合', false)
const soloText = new JSDOM(soloHtml).window.document.querySelector('p')?.textContent || ''
assert.ok(soloText.includes('(') && !soloText.includes('$'), '不成对 \\( 不产公式不产 $')

// 5. 已有 $...$ 公式不受影响
const dollarHtml = await processMarkdown('已有 $a_1+b$ 公式与 \\(c\\) 公式', false)
assert.equal(new JSDOM(dollarHtml).window.document.querySelectorAll('.katex').length, 2, '$ 与 \\( 并存各自渲染')

// 6. 纯函数层：替换不改变行数（data-source-line 锚点依赖）
const multiLine = '第一行 \\(a\\)\n第二行 \\(b\\)\n第三行'
assert.equal(convertPandocMathDelimiters(multiLine).split('\n').length, 3, '行数不变')

// 7. 快速通道：无定界符文档原文返回（同一引用，零开销）
const plain = '普通正文'
assert.equal(convertPandocMathDelimiters(plain), plain, '无定界符原样返回')

console.log('pandoc math delimiter regression ok')
