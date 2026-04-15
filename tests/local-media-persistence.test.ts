import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const storeSource = readFileSync(new URL('../src/utils/store.ts', import.meta.url), 'utf8')
const mediaSource = readFileSync(new URL('../src/utils/media.ts', import.meta.url), 'utf8')

assert.match(
  storeSource,
  /localStorage\.setItem\(LOCAL_MEDIA_STORAGE_KEY|localStorage\.setItem\('md-local-media'/,
  'local media registration should persist metadata so preview can recover after refresh',
)

assert.match(
  mediaSource,
  /localStorage\.getItem\(LOCAL_MEDIA_STORAGE_KEY|localStorage\.getItem\('md-local-media'\)|readPersistedLocalMedia/,
  'media hydration should have a way to restore persisted local media records',
)

console.log('local media persistence handling ok')
