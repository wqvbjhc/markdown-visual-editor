import assert from 'node:assert/strict'
import { test } from 'node:test'
import { JSDOM } from 'jsdom'
import { applyToutiaoStyles } from '../src/formats/toutiao.ts'

function withDom<T>(fn: () => T): T {
  const dom = new JSDOM('<!doctype html><html><body></body></html>')
  const { window } = dom

  const previousDomParser = globalThis.DOMParser
  const previousDocument = globalThis.document
  const previousHTMLElement = globalThis.HTMLElement

  globalThis.DOMParser = window.DOMParser
  globalThis.document = window.document
  globalThis.HTMLElement = window.HTMLElement

  try {
    return fn()
  } finally {
    globalThis.DOMParser = previousDomParser
    globalThis.document = previousDocument
    globalThis.HTMLElement = previousHTMLElement
    dom.window.close()
  }
}

test('toutiao export renders explicit numbering for top-level ordered lists with nested unordered lists', () => {
  const output = withDom(() =>
    applyToutiaoStyles(
      '<ol><li>Alpha<ul><li>Nested A</li></ul></li><li>Beta<ul><li>Nested B</li></ul></li></ol>',
    ),
  )

  const dom = new JSDOM(output, { contentType: 'text/html' })
  const root = dom.window.document.querySelector('section')

  assert.ok(root, 'Toutiao export should wrap content in a section')

  const items = Array.from(root!.querySelectorAll('[data-toutiao-ordered-list] > div'))
  assert.equal(items.length, 2)
  assert.equal(items[0].getAttribute('data-toutiao-list-marker'), '1.')
  assert.equal(items[1].getAttribute('data-toutiao-list-marker'), '2.')
  assert.match(items[0].textContent ?? '', /^1\.\s*Alpha.*•\s*Nested A/)
  assert.match(items[1].textContent ?? '', /^2\.\s*Beta.*•\s*Nested B/)
  assert.ok(root!.querySelector('[data-toutiao-bullet-list]'))
  assert.match(items[0].textContent ?? '', /•\s*Nested A/)
  assert.match(items[1].textContent ?? '', /•\s*Nested B/)
})

test('toutiao export keeps nested ordered lists numbered independently', () => {
  const output = withDom(() =>
    applyToutiaoStyles(
      '<ol><li>Parent<ol><li>Child A</li><li>Child B</li></ol></li><li>Parent Two</li></ol>',
    ),
  )

  const dom = new JSDOM(output, { contentType: 'text/html' })
  const root = dom.window.document.querySelector('section')
  assert.ok(root)

  const topItems = Array.from(root!.querySelectorAll(':scope > [data-toutiao-ordered-list] > div'))
  assert.equal(topItems.length, 2)
  assert.equal(topItems[0].getAttribute('data-toutiao-list-marker'), '1.')
  assert.equal(topItems[1].getAttribute('data-toutiao-list-marker'), '2.')

  const nestedOrderedGroups = Array.from(root!.querySelectorAll('[data-toutiao-ordered-list] [data-toutiao-ordered-list]'))
  assert.equal(nestedOrderedGroups.length, 1)

  const nestedItems = Array.from(nestedOrderedGroups[0].children).filter(
    (node) => node instanceof dom.window.HTMLElement && node.getAttribute('data-toutiao-list-marker'),
  ) as HTMLElement[]
  assert.equal(nestedItems.length, 2)
  assert.equal(nestedItems[0].getAttribute('data-toutiao-list-marker'), '1.')
  assert.equal(nestedItems[1].getAttribute('data-toutiao-list-marker'), '2.')
})
