import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/components/CodeBlock.tsx', import.meta.url), 'utf8')

assert.match(
  source,
  /export function normalizeCodeBlockText\(code: string\)[\s\S]*code\.endsWith\('\\n'\) \? code\.slice\(0, -1\) : code/,
  'code blocks should normalize one trailing newline before rendering',
)

assert.match(
  source,
  /codeToHtml\(normalizedCode,/,
  'syntax highlighting should use normalized code text',
)

assert.match(
  source,
  /navigator\.clipboard\.writeText\(normalizedCode\)/,
  'copy action should use normalized code text',
)

console.log('code block trailing newline handling ok')
