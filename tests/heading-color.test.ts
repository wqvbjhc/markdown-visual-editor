import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import { processMarkdown } from '../src/pipeline/processor.ts'
import { applyWechatStyles } from '../src/formats/wechat.ts'
import { applyToutiaoStyles } from '../src/formats/toutiao.ts'

// 回归：公众号 / 头条号 标题必须有 accent 色。
// 历史：rehype-autolink-headings 把标题文本包进 <a>，<a> 的 link 样式（color:accent）incidental
// 给了标题颜色。复制链路剥 <a> 后标题文字落到 <h1> 自身色 → 失色。修：wechat/toutiao 显式给
// heading color:accent（对齐预览，预览标题经 .prose-container a 的 link-color 显色）。

// wechat/toutiao 用 new DOMParser，node 环境用 jsdom polyfill
globalThis.DOMParser = class {
  parseFromString(src: string) {
    return new JSDOM(src).window.document
  }
}

const md = '# 一级标题\n\n## 二级标题\n\n### 三级标题\n\n正文'
const html = await processMarkdown(md, false)
const accent = '#cc1234'

for (const [name, out] of [
  ['wechat', applyWechatStyles(html, accent)],
  ['toutiao', applyToutiaoStyles(html, accent)],
] as const) {
  const dom = new JSDOM(out)
  const headings = dom.window.document.querySelectorAll('h1,h2,h3')
  assert.ok(headings.length >= 3, `${name}: 应至少有 h1/h2/h3`)
  headings.forEach((h) => {
    const style = h.getAttribute('style') || ''
    assert.ok(
      style.includes(`color:${accent}`),
      `${name} ${h.tagName.toLowerCase()} 应带 color:${accent}，got: ${style}`,
    )
  })
}

console.log('heading accent color ok')
