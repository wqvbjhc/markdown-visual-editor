import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// 飞书已从「格式选择器」移除：建文档按钮常驻工具栏右侧（不依赖 format），
// 复制路径（text/plain）随之退役。本测试反向守护，防止飞书格式被误加回。
const storeSrc = readFileSync(new URL('../src/utils/store.ts', import.meta.url), 'utf8')
assert.doesNotMatch(storeSrc, /FormatType = [^;]*'feishu'/, "FormatType 不应再含 'feishu'（飞书格式已移除）")

const toolbarSrc = readFileSync(new URL('../src/components/Toolbar.tsx', import.meta.url), 'utf8')
assert.doesNotMatch(toolbarSrc, /value: 'feishu'/, 'formats 数组不应再含飞书选项')
// 「创建飞书文档」按钮必须常驻（不挂 format === \'feishu\' 条件）
assert.match(toolbarSrc, /创建飞书文档/, '建文档按钮文案必须存在')

const pdfSrc = readFileSync(new URL('../src/utils/pdf.ts', import.meta.url), 'utf8')
assert.doesNotMatch(pdfSrc, /feishu:/, 'pdf formatLabels 不应再含 feishu，否则 Record<FormatType,string> 类型不满足')

console.log('feishu format removed ok')
