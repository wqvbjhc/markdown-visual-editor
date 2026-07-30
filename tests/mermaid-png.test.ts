import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// 守 mermaid → PNG 两条链路的根因修复：
// 1. tainted canvas：mermaid v11 默认 look:'neo'+htmlLabels:true 产 <foreignObject>，
//    SVG 经 <img> 画 canvas 必 tainted → toDataURL 抛 SecurityError。
//    修：顶层 htmlLabels:false（v11 主键，flowchart.htmlLabels deprecated 仅 fallback 实测不够）
//    + look:'classic'（原生 SVG <text>，去 foreignObject）+ useMaxWidth:false（去 100% 宽压扁）。
// 2. 复制路径：mermaid SVG 只挂预览 DOM 不在 store.html，复制拿串是裸文本；
//    公众号/头条/飞书粘贴又必丢 SVG。修：复制前就地渲 PNG data URL <img>（三平台均认）。

const mermaidPngSrc = readFileSync(new URL('../src/utils/mermaid-png.ts', import.meta.url), 'utf8')
// tainted 修复三要素（缺一会复发 SecurityError 或压扁图）
assert.match(mermaidPngSrc, /look:\s*['"]classic['"]/, "去 neo look（neo 用 foreignObject 致 tainted）")
assert.match(mermaidPngSrc, /htmlLabels:\s*false/, "顶层 htmlLabels:false（v11 主键，去 foreignObject）")
assert.match(mermaidPngSrc, /useMaxWidth:\s*false/, "useMaxWidth:false（去 width=\"100%\" 压扁图）")
// 不能缓存「已 init」标志：mermaid 单例被 Preview 反复重置成 neo，每次 render 前必须重设配置
assert.doesNotMatch(mermaidPngSrc, /mermaidReady\s*=\s*true/, "不能缓存 mermaidReady（Preview 单例污染后需重设）")
// svgToPng：百分号宽兜底 + 白底 + 2x canvas + toDataURL
assert.match(mermaidPngSrc, /\(\?!%\)/, "width 正则负前瞻排除百分号宽")
assert.match(mermaidPngSrc, /fillStyle\s*=\s*['"]#fff['"]/, "PNG 白底防透明（公众号/飞书防黑底）")
assert.match(mermaidPngSrc, /toDataURL\(['"]image\/png['"]\)/, "canvas → PNG data URL")

// 边标签遮线：SVG 经 <img> 栅格化时外部 CSS（index.css）不生效，必须把不透明白底注入 SVG 内部，
// 否则 mermaid 自带 rgba(232,232,232,.8) 半透明底 → 线穿过标签文字
assert.match(mermaidPngSrc, /injectOpaqueEdgeLabels/, "PNG 必须注入边标签不透明底（外部 CSS 不入 <img>）")
assert.match(mermaidPngSrc, /\.edgeLabel[^}]*background-color:\s*#fff/, "注入的边标签底必须不透明白")

// 复制注入：media-export.ts 必须 export injectMermaidPngs，渲 PNG 替换 mermaid-block 为 <img>
const mediaExportSrc = readFileSync(new URL('../src/utils/media-export.ts', import.meta.url), 'utf8')
assert.match(mediaExportSrc, /export async function injectMermaidPngs/, "复制路径必须有 injectMermaidPngs")
assert.match(mediaExportSrc, /renderMermaidToDataUrl/, "injectMermaidPngs 必须调 renderMermaidToDataUrl")
assert.match(mediaExportSrc, /querySelectorAll[^]*\.mermaid-block/, "injectMermaidPngs 必须查 .mermaid-block")
assert.match(mediaExportSrc, /createElement\(['"]img['"]\)/, "injectMermaidPngs 必须把 mermaid-block 换成 <img>")

// Toolbar handleCopy 必须在复制前注入 mermaid PNG
const toolbarSrc = readFileSync(new URL('../src/components/Toolbar.tsx', import.meta.url), 'utf8')
assert.match(toolbarSrc, /injectMermaidPngs/, "handleCopy 必须调 injectMermaidPngs")
assert.match(toolbarSrc, /content\.includes\(['"]mermaid-block['"]\)/, "handleCopy 必须先判 mermaid-block 再注入")

// export.ts 飞书链路必须复用同一 util（不再自带 mermaid 配置，防双源漂移）
const exportSrc = readFileSync(new URL('../src/feishu-blocks/export.ts', import.meta.url), 'utf8')
assert.match(exportSrc, /from ['"]@\/utils\/mermaid-png['"]/, "飞书 export 必须复用 mermaid-png util")
assert.match(exportSrc, /renderMermaidToDataUrl/, "飞书 export 必须用 renderMermaidToDataUrl")
assert.doesNotMatch(exportSrc, /import mermaid from ['"]mermaid['"]/, "export.ts 不再直接 import mermaid（统一走 util）")

console.log('mermaid png copy+export ok')
