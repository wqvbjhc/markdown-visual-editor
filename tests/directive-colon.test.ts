import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import { processMarkdown } from '../src/pipeline/processor.ts'

// 回归：remark-directive 把裸 `:name`（名字允许数字/连字符）当合法内联 textDirective，
// 渲染成空 <div></div> 丢名字。中文正文的 1:1、dataLoader.py:80-87、4:1 全中招。
// processor.ts 用 remarkRecoverDirective 把非 media 的误解析 directive 还原成纯文本。
// 本测试守这个责任点。

// 1. 用户实报段落：比例 / file:line 原样保留，无空 div，粗体不受影响
const userMd =
  '**音频时间轴 4T → 2T → T**：两次时间池化把每视频帧 4 个 MFCC 帧对齐回 1，与逐视频帧的说话标签形成 1:1（标签与视频帧的 1:1 在数据层完成，dataLoader.py:80-87；音频侧 4:1 由上表池化对齐）。'
const userHtml = await processMarkdown(userMd, false)
const userDoc = new JSDOM(userHtml).window.document
assert.equal(userDoc.querySelectorAll('div').length, 0, '正文不得产生空 div')
const userText = userDoc.querySelector('p')?.textContent || ''
for (const frag of ['1:1（', 'dataLoader.py:80-87', '4:1 由', '4T → 2T → T']) {
  assert.ok(userText.includes(frag), `正文应原样保留 ${frag}，got: ${userText}`)
}
assert.equal(userDoc.querySelector('strong')?.textContent, '音频时间轴 4T → 2T → T', '粗体不受影响')

// 2. 通用比例与 emoji 短代码形态
const ratioHtml = await processMarkdown('宽高比 16:9，间隔 1:2:3，表情 :tada: 与 :rocket: 庆祝', false)
const ratioText = new JSDOM(ratioHtml).window.document.querySelector('p')?.textContent || ''
for (const frag of ['16:9', '1:2:3', ':tada:', ':rocket:']) {
  assert.ok(ratioText.includes(frag), `应原样保留 ${frag}，got: ${ratioText}`)
}

// 3. 行首裸指令还原为文本（块级）
const lineStartHtml = await processMarkdown(':warning 下一行', false)
const lineStartDoc = new JSDOM(lineStartHtml).window.document
assert.equal(lineStartDoc.querySelectorAll('div').length, 0, '行首裸指令不得渲染成 div')
assert.ok((lineStartDoc.body.textContent || '').includes(':warning'), '行首裸指令还原为文本')

// 4. 对照：真实 media 指令（::image / ::video 带 {…}）必须不受还原影响
const mediaHtml = await processMarkdown(
  '::image{src="https://example.com/a.png" alt="示例" caption="说明"}',
  false,
)
const mediaDoc = new JSDOM(mediaHtml).window.document
assert.equal(mediaDoc.querySelectorAll('figure.media-image img[src="https://example.com/a.png"]').length, 1, '::image 应仍渲染为 figure')

// 5. 对照：带属性的未知行首指令（有意使用）保持原渲染，不被还原
const intentionalHtml = await processMarkdown('::note{type=tip}\n内容行', false)
assert.ok(intentionalHtml.includes('<div'), '带属性的未知指令保持 div 渲染')

console.log('directive colon recovery regression ok')
