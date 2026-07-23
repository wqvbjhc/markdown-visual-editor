import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// 飞书「复制粘贴」格式已加回 FormatType（CF/HF 无后端，改走复制路径）。
// 本测试正向守护：飞书格式必须存在、复制分支必须处理、公式必须走 LaTeX 源码（非 MathML/近似文本）。
const storeSrc = readFileSync(new URL('../src/utils/store.ts', import.meta.url), 'utf8')
assert.match(storeSrc, /'default' \| 'wechat' \| 'toutiao' \| 'mobile' \| 'feishu'/, "FormatType 必须含 'feishu'")

const toolbarSrc = readFileSync(new URL('../src/components/Toolbar.tsx', import.meta.url), 'utf8')
assert.match(toolbarSrc, /value: 'feishu'/, 'formats 数组必须有飞书选项')
assert.match(toolbarSrc, /applyFeishuStyles/, 'handleCopy 必须调 applyFeishuStyles')
// 「创建飞书文档」按钮必须受环境检测保护（纯静态部署隐藏）
assert.match(toolbarSrc, /feishuBackendAvailable/, '创建飞书文档按钮必须按后端探测结果条件渲染')
// 后端探测必须验 Content-Type，不能只判 res.ok：HF `serve -s dist` 的 SPA rewrite
// 对 /api/* 未匹配路径 fallback 到 index.html 仍返 200（text/html），会伪装成后端在线。
assert.match(toolbarSrc, /content-type/, '后端探测必须校验响应 Content-Type 含 application/json，区分 SPA fallback 假 200')

// 飞书格式化文件本身
const feishuSrc = readFileSync(new URL('../src/formats/feishu.ts', import.meta.url), 'utf8')
// 公式：LaTeX 源码（dollar）。MVP 探测确认飞书认 $...$ 源码，不认 MathML。
assert.match(feishuSrc, /annotation\[encoding="application\/x-tex"\]/, '必须从 KaTeX annotation 取原始 LaTeX')
assert.match(feishuSrc, /\$\$\$\{tex\}\$\$|`\$\$\\n\$\{tex\}\\n\$\$`/, '块级公式必须输出 $$...$$ 源码')
assert.doesNotMatch(feishuSrc, /inlineKatexStyles\s*\(/, '飞书公式不能调 inlineKatexStyles(...)（那是转近似文本，方向相反）')
assert.doesNotMatch(feishuSrc, /import.*inlineKatexStyles/, '不能 import inlineKatexStyles')
assert.doesNotMatch(feishuSrc, /\.katex-mathml|<math[> ]/, '飞书公式不能走 MathML（探测确认 C 纯文本，飞书不认）')

console.log('feishu format registered ok')
