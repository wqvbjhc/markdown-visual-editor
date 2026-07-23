import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { JSDOM } from 'jsdom'
import { processMarkdown } from '../src/pipeline/processor.ts'
import { unwrapSelfAnchorHeadingLinks } from '../src/utils/heading-links.ts'

// 回归：复制链路必须剥掉标题自锚超链接。
// processor.ts rehype-autolink-headings(behavior:'wrap') 把标题文本包进 <a href="#slug">，
// 预览里点标题跳锚点。但 #slug 离开本页是死链，复制到公众号/头条/飞书/默认都变无意义超链接。
// prepareClipboardHtml（全格式必经）调 unwrapSelfAnchorHeadingLinks 统一剥掉。本测试守这个责任点。

const md = [
  '# 标题一',
  '',
  '## 标题二 有 $E=mc^2$ 公式',
  '',
  '正文带 [外链](https://example.com) 应保留',
  '',
  '### 三级标题',
  '',
  '另段 [相对锚](./other) 不在标题里不动',
].join('\n')

const html = await processMarkdown(md, false)

// 取所有标题内的自锚 <a>（注意：不能写 'h1,...,h6 a[href]' group 选择器——
// group 里只有末项 h6 带后代，前面 h1..h5 会匹配标题元素本身。先选标题再查 a）
const headingSelfAnchors = (d: Document) =>
  Array.from(d.querySelectorAll('h1,h2,h3,h4,h5,h6')).flatMap((h) =>
    Array.from(h.querySelectorAll('a[href^="#"]')),
  )

// sanity：autolink 确实把标题包进了自锚 <a href="#...">
const before = new JSDOM(html).window.document
assert.ok(headingSelfAnchors(before).length > 0, '前置失败：processMarkdown 应产标题自锚 <a>')

// 剥：用复制链路同样的方式（拿 document root 调 util）
const doc = new JSDOM(html).window.document
unwrapSelfAnchorHeadingLinks(doc.body)

// 标题内不得残留自锚 <a>
assert.equal(headingSelfAnchors(doc).length, 0, '标题内不应残留自锚超链接')

// 标题文本不能丢（unwrap 用子节点替换 <a>，文字保留）
const h2 = doc.querySelector('h2')
assert.ok(h2?.textContent?.includes('标题二'), `标题文本应保留，got: ${h2?.textContent}`)

// 外链（http/https）必须保留——只剥自锚
const external = doc.querySelectorAll('a[href^="https://"]')
assert.ok(external.length > 0, '外链 <a> 应保留不被误剥')

// 非标题里的 <a>（正文外链 / 相对链接）不动
const bodyLinks = doc.querySelectorAll('p a')
assert.ok(bodyLinks.length > 0, '正文 <a> 不应被剥')

// —— 源码正则：守真实责任点 + 去重 ——

const utilSrc = readFileSync(new URL('../src/utils/heading-links.ts', import.meta.url), 'utf8')
assert.match(utilSrc, /export function unwrapSelfAnchorHeadingLinks/, 'heading-links.ts 应导出 unwrapSelfAnchorHeadingLinks')

const mediaExportSrc = readFileSync(new URL('../src/utils/media-export.ts', import.meta.url), 'utf8')
assert.match(mediaExportSrc, /from ['"]\.\/heading-links['"]/, 'media-export.ts 应 import heading-links')
assert.match(mediaExportSrc, /unwrapSelfAnchorHeadingLinks\(root\)/, 'prepareClipboardHtml 应调 unwrapSelfAnchorHeadingLinks(root)')

const feishuSrc = readFileSync(new URL('../src/formats/feishu.ts', import.meta.url), 'utf8')
assert.doesNotMatch(feishuSrc, /function unwrapHeadingLinks/, 'feishu.ts 不应再定义内联 unwrapHeadingLinks（已移交复制链路单点去重）')

console.log('heading self-anchor strip ok')
