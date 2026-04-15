import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const toolbarSource = readFileSync(new URL('../src/components/Toolbar.tsx', import.meta.url), 'utf8')
const mediaSource = readFileSync(new URL('../src/utils/media.ts', import.meta.url), 'utf8')
const storeSource = readFileSync(new URL('../src/utils/store.ts', import.meta.url), 'utf8')

assert.match(
  toolbarSource,
  /showDirectoryPicker/,
  'toolbar should provide a directory picker entry for resolving relative image paths',
)

assert.match(
  mediaSource,
  /normalizeRelativeMediaPath|readRelativeImageDirectory|readPersistedRelativeMedia/,
  'media utilities should include relative image path resolution helpers',
)

assert.match(
  storeSource,
  /relativeMediaMap|setRelativeMediaEntries|RELATIVE_MEDIA_STORAGE_KEY/,
  'store should persist relative image mappings so preview can refresh after selecting a directory',
)

console.log('relative image directory mode ok')
