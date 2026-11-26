import assert from 'node:assert/strict'
import { test } from 'node:test'
import { JSDOM } from 'jsdom'
import { exportCurrentPreviewAsPdf } from '../src/utils/pdf.ts'

const measuredSize = 'width: 920px; height: 400px; inline-size: 920px; block-size: 400px;'

test('PDF export reflows table containers without changing the live preview', async () => {
  const dom = new JSDOM(`<!doctype html>
    <div class="preview-pane" style="${measuredSize}">
      <div class="prose-container mobile-frame" style="${measuredSize} max-width: 420px;">
        <section style="${measuredSize}">
          <div class="table-wrapper" style="${measuredSize} overflow-x: auto; overflow-y: auto;">
            <table style="${measuredSize} overflow: hidden;">
              <thead><tr><th>Column</th></tr></thead>
              <tbody><tr style="${measuredSize}"><td style="${measuredSize} color: red;">
                <code style="white-space: nowrap;">LongIdentifier</code>
              </td></tr></tbody>
            </table>
          </div>
        </section>
        <p style="height: 40px;">Other content</p>
      </div>
    </div>`)
  const { window } = dom
  const previousWindow = globalThis.window
  const previousDocument = globalThis.document
  globalThis.window = window
  globalThis.document = window.document

  const { body } = window.document
  let printed: Document | undefined
  const appendChild = body.appendChild.bind(body)
  body.appendChild = (node) => {
    const appended = appendChild(node)
    if (node instanceof window.HTMLIFrameElement && node.contentWindow) {
      node.contentWindow.focus = () => {}
      node.contentWindow.print = () => { printed = node.contentDocument ?? undefined }
    }
    return appended
  }

  try {
    await exportCurrentPreviewAsPdf('mobile')
    assert.ok(printed, 'export must pass the cloned document to print')
    const wrapper = printed.querySelector<HTMLElement>('.table-wrapper')!
    const table = printed.querySelector<HTMLTableElement>('table')!
    const cell = table.tBodies[0].rows[0].cells[0]
    assert.equal(wrapper.style.overflow, 'visible', 'the table wrapper must not scroll in the PDF')
    assert.equal(table.style.overflow, 'visible')
    assert.equal(table.style.width, '100%', 'table must size to the available paper width')
    for (const node of [printed.querySelector<HTMLElement>('.preview-pane')!, printed.querySelector<HTMLElement>('.prose-container')!, wrapper.parentElement!, wrapper, table, cell.parentElement!, cell]) {
      for (const property of ['width', 'height', 'inline-size', 'block-size']) {
        assert.doesNotMatch(node.style.getPropertyValue(property), /px$/, `${node.tagName} must not retain the preview's ${property}`)
      }
    }
    assert.equal(cell.style.overflowWrap, 'anywhere')
    assert.equal(cell.querySelector('code')!.style.whiteSpace, 'normal')
    assert.equal(cell.textContent?.trim(), 'LongIdentifier')
    assert.equal(cell.style.color, 'rgb(255, 0, 0)')
    assert.equal(printed.querySelector<HTMLElement>('.mobile-frame')!.style.maxWidth, '420px')
    assert.equal(printed.querySelector('p')!.style.height, '40px')
    assert.equal(window.document.querySelector<HTMLElement>('.table-wrapper')!.style.overflowX, 'auto')
    assert.equal(window.document.querySelector('table')!.style.width, '920px')
    assert.equal(window.document.querySelector('code')!.style.whiteSpace, 'nowrap')
  } finally {
    globalThis.window = previousWindow
    globalThis.document = previousDocument
    window.close()
  }
})
