import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/pipeline/plugins/rehype-image.ts', import.meta.url), 'utf8')

assert.doesNotMatch(
  source,
  /node\.properties\.title/,
  'plain markdown image title should not be promoted to visible figcaption automatically',
)

assert.match(
  source,
  /node\.properties\['data-caption'\]/,
  'explicit data-caption should remain the source of visible image captions',
)

console.log('image title caption handling ok')
