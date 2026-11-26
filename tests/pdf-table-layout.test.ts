import assert from 'node:assert/strict'
import { test } from 'node:test'
import { JSDOM } from 'jsdom'
import { exportCurrentPreviewAsPdf } from '../src/utils/pdf.ts'

const measuredSize = 'width: 920px; height: 400px; inline-size: 920px; block-size: 400px;'

const tableMarkup = `
          <div class="table-wrapper" style="${measuredSize} overflow-x: auto; overflow-y: auto;">
            <table style="${measuredSize} overflow: hidden;">
              <thead><tr><th>Column</th></tr></thead>
              <tbody><tr style="${measuredSize}"><td style="${measuredSize} color: red;">
                <code style="white-space: nowrap;">LongIdentifier</code>
              </td></tr></tbody>
            </table>
          </div>`

async function capturePrint(markup: string, check: (printed: Document, preview: Document) => void) {
  const dom = new JSDOM(`<!doctype html>${markup}`)
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
    check(printed, window.document)
  } finally {
    globalThis.window = previousWindow
    globalThis.document = previousDocument
    window.close()
  }
}

test('PDF export reflows table containers without changing the live preview', async () => {
  await capturePrint(`
    <div class="preview-pane" style="${measuredSize}">
      <div class="prose-container mobile-frame" style="${measuredSize} max-width: 420px;">
        <section style="${measuredSize}">${tableMarkup}</section>
      </div>
    </div>`, (printed, preview) => {
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
    assert.equal(preview.querySelector<HTMLElement>('.table-wrapper')!.style.overflowX, 'auto')
    assert.equal(preview.querySelector('table')!.style.width, '920px')
    assert.equal(preview.querySelector('code')!.style.whiteSpace, 'nowrap')
  })
})

for (const withTable of [true, false]) {
  test(`PDF fits sibling blocks to paper ${withTable ? 'with a table' : 'without a table'}`, async () => {
    await capturePrint(`
      <div class="preview-pane" style="${measuredSize}">
        <div class="prose-container mobile-frame" style="${measuredSize} max-width: 420px;">
          <section style="${measuredSize}">
            <blockquote style="${measuredSize} border-left: 4px solid blue;">Quote end</blockquote>
            <div class="code-block-wrapper" style="${measuredSize} overflow: hidden;">
              <div class="code-block-body" style="${measuredSize} overflow: auto;">
                <div class="code-block-lines" style="width: 56px; min-width: 40px;">1 2 3</div>
                <div class="code-block-content" style="${measuredSize} overflow: auto;">
                  <pre style="${measuredSize} white-space: pre;"><code style="white-space: pre;"><span class="line" style="color: red; white-space: pre;">  code START</span>\n<span class="line"></span>\n<span class="line">  code END</span></code></pre>
                </div>
              </div>
            </div>
            <span class="katex-display" style="${measuredSize} overflow: auto; display: block;">
              <span class="katex"><span class="katex-html"><span class="base" style="width: 770px; height: 36px; display: inline-block;">Display formula end</span></span></span>
            </span>
            <p style="${measuredSize}">
              <code style="white-space: nowrap;">Inline code end</code>
              <span class="katex-semantic" style="white-space: nowrap;">Inline formula end</span>
            </p>
            ${withTable ? tableMarkup : ''}
          </section>
        </div>
      </div>`, (printed, preview) => {
      for (const selector of ['.preview-pane', '.prose-container', 'section', 'blockquote', '.code-block-wrapper', '.code-block-content', 'pre', '.katex-display', 'p']) {
        const node = printed.querySelector<HTMLElement>(selector)!
        for (const property of ['width', 'height', 'inline-size', 'block-size']) {
          assert.doesNotMatch(node.style.getPropertyValue(property), /px$/, `${selector} must reflow without its measured ${property}`)
        }
        assert.equal(preview.querySelector<HTMLElement>(selector)!.style.width, '920px')
      }
      assert.equal(printed.querySelector('blockquote')!.style.borderLeftWidth, '4px')
      assert.equal(printed.querySelector('pre')!.style.whiteSpace, 'pre-wrap')
      assert.deepEqual(Array.from(printed.querySelectorAll('pre .line'), (line) => line.textContent), ['  code START', '', '  code END'])
      assert.deepEqual(Array.from(printed.querySelectorAll('pre .line'), (line) => line.getAttribute('data-print-line')), ['1', '2', '3'])
      assert.equal(printed.querySelector<HTMLElement>('.code-block-content')!.style.paddingInlineStart, '56px')
      assert.equal(printed.querySelector<HTMLElement>('.line')!.style.color, 'rgb(255, 0, 0)')
      assert.equal(printed.querySelector<HTMLElement>('.katex-display')!.style.overflow, 'visible')
      assert.equal(printed.querySelector<HTMLElement>('.katex-html')!.style.whiteSpace, 'normal')
      assert.equal(printed.querySelector<HTMLElement>('.katex .base')!.style.width, '770px', 'the exporter retains the internal formula geometry')
      assert.equal(printed.querySelector('p code')!.style.overflowWrap, 'anywhere')
      assert.equal(printed.querySelector<HTMLElement>('.katex-semantic')!.style.whiteSpace, 'normal')
      assert.equal(preview.querySelector<HTMLElement>('.katex-semantic')!.style.whiteSpace, 'nowrap')
    })
  })
}
