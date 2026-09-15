import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import { processMarkdown } from '../src/pipeline/processor.ts'
import { convertMarkdownToFeishu } from '../src/feishu-blocks/converter.ts'
import { escapeTableCodePipes } from '../src/pipeline/table-code-pipe.ts'

// 回归：表格单元格内行内代码的裸 |。
// GFM 表格按未转义 | 切格，切分先于行内解析——代码 span 保护不了自己的管道符，
// `stats_{main|neg}.json` 会被切成三格（反引号落单 + 超列格整格丢弃）。
// table-code-pipe.ts 在 parse 前把表格行内代码 span 里的活 | 转义成 \|，
// 本测试守这个责任点（AST 只圈表格行范围，行内定位靠 CommonMark 反引号配对扫描）。

// 1. 用户实报表：代码 span 整格完好、被丢的说明列回来、无落单反引号
const userMd = `| 内容 | 说明 |
|---|---|
| 关键点数据 | main 库：键 \`{组}/{视频}/{实体}/landmarks\` 存整实体 (帧数,82,2)；neg 库：键 = 图片 key，值**单帧** (82,2)——每实体/每图固定只提**一份**，训练时铺满 T 窗与逐窗独立增强都在 loader 侧做（D3-2 设计） |
| \`stats_{main|neg}_{区间}.json\` | 该分片逐实体明细（总量/检出数/按帧尺寸分桶的 ok-rate）。用途：覆盖率监控 + D6-1 裁决数据源。**断点续跑不依赖它**（续跑按已写键跳过），随时可删 |`
const userHtml = await processMarkdown(userMd, false)
const userDoc = new JSDOM(userHtml).window.document
assert.equal(userHtml.includes('<code>stats_{main|neg}_{区间}.json</code>'), true, '代码 span 完整渲染')
assert.equal(userHtml.includes('断点续跑不依赖它'), true, '原被丢弃的说明列内容回来')
const row2Codes = userDoc.querySelectorAll('tbody tr:last-child td code')
assert.equal(row2Codes.length, 1, '该行只有一个代码 span')
assert.equal(row2Codes[0]?.textContent, 'stats_{main|neg}_{区间}.json', 'span 内容无杂质')
assert.ok(!userHtml.includes('`stats'), '无落单反引号残留')

// 2. 微观：`x|y` 渲染干净，无反斜杠残留
const microHtml = await processMarkdown('| a | b |\n|---|---|\n| `x|y` | c |', false)
assert.ok(microHtml.includes('<code>x|y</code>'), '转义后管道符还原')
assert.ok(!microHtml.includes('\\|'), '代码 span 值无反斜杠残留')

// 3. 非表格段落不误伤（`\|` 在非表格代码 span 里是字面量，反斜杠可见）
const paraHtml = await processMarkdown('段落 `x|y` 结束', false)
assert.ok(paraHtml.includes('<code>x|y</code>'), '非表格代码 span 原样')
assert.ok(!paraHtml.includes('\\|'), '未注入转义')

// 4. 已手写转义的 \| 不双转义
const escMd = '| a | b |\n|---|---|\n| `x\\|y` | c |'
assert.ok(!escapeTableCodePipes(escMd).includes('\\\\|'), '不产生 \\\\|')
const escHtml = await processMarkdown(escMd, false)
assert.ok(escHtml.includes('<code>x|y</code>'), '已转义形态渲染不变')

// 5. 围栏代码块里的管道/反引号不当作表格处理
const fenceMd = '```\n`a|b` | x\n```\n\n| h |\n|---|\n| `c|d` |'
const fenceHtml = await processMarkdown(fenceMd, false)
assert.ok(fenceHtml.includes('`a|b` | x'), '围栏内容逐字保留')
assert.ok(fenceHtml.includes('<code>c|d</code>'), '围栏后的表格照常修复')

// 6. 双反引号 run 的代码 span 同样修复
const dblHtml = await processMarkdown('| a |\n|---|\n| ``x|y`` |', false)
assert.ok(dblHtml.includes('<code>x|y</code>'), '双反引号 span 修复')

// 7. 行数不变（data-source-line 锚点依赖）
const multi = '| a | b |\n|---|---|\n| `x|y` | c |'
assert.equal(escapeTableCodePipes(multi).split('\n').length, 3, '行数不变')

// 8. 快速通道：无 | 或无 ` 原引用返回（零开销）
const plain = '普通正文'
assert.equal(escapeTableCodePipes(plain), plain, '无管道原样返回')
const noBacktick = '| a | b |\n|---|---|\n| c |'
assert.equal(escapeTableCodePipes(noBacktick), noBacktick, '无反引号原样返回')

// 9. 飞书导出链路（独立 parse 栈）：inline code 值干净
const feishu = convertMarkdownToFeishu(userMd)
const feishuJson = JSON.stringify(feishu.payload)
assert.ok(feishuJson.includes('"content":"stats_{main|neg}_{区间}.json"'), '飞书 text_run 内容干净')
assert.ok(!feishuJson.includes('main\\\\|neg'), '飞书链路无转义残留')

console.log('table code pipe regression ok')
