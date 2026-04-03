import assert from 'node:assert/strict'
import { colorSchemes } from '../src/utils/color-schemes.ts'

const requiredVars = [
  '--bg-primary',
  '--bg-secondary',
  '--bg-tertiary',
  '--bg-editor',
  '--bg-preview',
  '--bg-toolbar',
  '--bg-elevated',
  '--bg-code',
  '--bg-blockquote',
  '--text-primary',
  '--text-secondary',
  '--text-muted',
  '--text-inverse',
  '--border-color',
  '--border-light',
  '--border-strong',
  '--accent',
  '--accent-hover',
  '--accent-soft',
  '--accent-contrast',
  '--link-color',
  '--shadow-sm',
  '--shadow-md',
  '--shadow-lg',
  '--scrollbar-bg',
  '--scrollbar-thumb',
] as const

assert.equal(colorSchemes.length, 4, 'should keep exactly four curated presets for Task 2')
assert.equal(
  new Set(colorSchemes.map((scheme) => scheme.id)).size,
  colorSchemes.length,
  'curated presets should keep stable unique ids',
)
assert.deepEqual(
  colorSchemes.map((scheme) => scheme.id),
  ['slate-blue', 'graphite-cyan', 'mist-violet', 'warm-paper'],
  'curated presets should keep the expected stable ids and ordering',
)

for (const scheme of colorSchemes) {
  assert.ok(scheme.id, 'each curated preset should define an id')
  assert.ok(scheme.name, `${scheme.id || '<unknown>'} should define a display name`)

  for (const mode of ['light', 'dark'] as const) {
    for (const variable of requiredVars) {
      assert.ok(
        variable in scheme[mode],
        `${scheme.id} ${mode} is missing ${variable}`,
      )
      assert.ok(
        scheme[mode][variable],
        `${scheme.id} ${mode} should assign a non-empty value to ${variable}`,
      )
    }
  }
}

console.log('theme token coverage ok')
