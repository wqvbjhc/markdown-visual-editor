import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8')

assert.match(css, /\.toolbar\s*\{[\s\S]*var\(--bg-toolbar\)/, 'toolbar should use toolbar surface token')
assert.match(css, /\.preview-pane\s*\{[\s\S]*var\(--bg-preview\)/, 'preview pane should use preview surface token')
assert.match(
  css,
  /\.palette-item(?:[^{}]|\{[^{}]*\})*\{[\s\S]*?(?:var\(--bg-elevated\)|var\(--accent-soft\))/,
  'palette-related selectors should use richer theme tokens within palette scope',
)
assert.match(css, /\.prose-container blockquote\s*\{[\s\S]*var\(--bg-blockquote\)/, 'blockquote should use blockquote token')

console.log('theme css coverage ok')
