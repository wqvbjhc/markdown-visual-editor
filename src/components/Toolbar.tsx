import { useState } from 'react'
import { FiMoon, FiSun } from 'react-icons/fi'
import { useStore, type FormatType } from '@/utils/store'
import { applyWechatStyles } from '@/formats/wechat'
import { applyToutiaoStyles } from '@/formats/toutiao'
import { colorSchemes, getCurrentAccent } from '@/utils/color-schemes'
import { exportCurrentPreviewAsPdf } from '@/utils/pdf'

const formats: { value: FormatType; label: string }[] = [
  { value: 'default', label: '默认' },
  { value: 'wechat', label: '公众号' },
  { value: 'toutiao', label: '头条号' },
  { value: 'mobile', label: 'Mobile' },
]

export function Toolbar() {
  const {
    format,
    setFormat,
    theme,
    toggleTheme,
    html,
    colorSchemeId,
    setColorScheme,
    customAccent,
    setCustomAccent,
    enableDeAI,
    setEnableDeAI,
  } = useStore()
  const [copyTip, setCopyTip] = useState('')
  const [pdfTip, setPdfTip] = useState('')
  const [showPalette, setShowPalette] = useState(false)

  const handleCopy = async () => {
    const accent = getCurrentAccent(colorSchemeId, theme, customAccent)
    let content = html
    if (format === 'wechat') content = applyWechatStyles(html, accent)
    else if (format === 'toutiao') content = applyToutiaoStyles(html, accent)

    try {
      const blob = new Blob([content], { type: 'text/html' })
      const textBlob = new Blob([content], { type: 'text/plain' })
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': blob,
          'text/plain': textBlob,
        }),
      ])
      setCopyTip('已复制')
    } catch {
      const el = document.querySelector('.prose-container')
      if (el) {
        const selection = window.getSelection()
        const range = document.createRange()
        range.selectNodeContents(el)
        selection?.removeAllRanges()
        selection?.addRange(range)
        document.execCommand('copy')
        selection?.removeAllRanges()
        setCopyTip('已复制')
      }
    }
    setTimeout(() => setCopyTip(''), 2000)
  }

  const handleExportPdf = async () => {
    try {
      await exportCurrentPreviewAsPdf(format)
      setPdfTip('PDF 准备中')
      setTimeout(() => setPdfTip(''), 2000)
    } catch (error) {
      console.error('PDF export failed:', error)
      setPdfTip('导出失败')
      setTimeout(() => setPdfTip(''), 2000)
    }
  }

  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <span className="toolbar-logo">MD</span>
        <span className="toolbar-title">Markdown 可视化</span>
      </div>
      <div className="toolbar-center">
        {formats.map((f) => (
          <button
            key={f.value}
            onClick={() => setFormat(f.value)}
            className={`toolbar-btn ${format === f.value ? 'active' : ''}`}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="toolbar-right">
        <button onClick={handleCopy} className="toolbar-btn" title="复制内容">
          {copyTip || '复制'}
        </button>
        <button onClick={handleExportPdf} className="toolbar-btn" title="导出当前预览为 PDF">
          {pdfTip || '导出 PDF'}
        </button>
        <label
          className={`toolbar-btn ${enableDeAI ? 'active' : ''}`}
          style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '4px' }}
          title="去除常见的 AI 味词汇和句式"
        >
          <input
            type="checkbox"
            checked={enableDeAI}
            onChange={(e) => setEnableDeAI(e.target.checked)}
            style={{ margin: 0, cursor: 'pointer' }}
          />
          去 AI 味
        </label>
        <div className="palette-wrapper">
          <button
            onClick={() => setShowPalette(!showPalette)}
            className="toolbar-btn"
            title="配色方案"
          >
            调色
          </button>
          {showPalette && (
            <div className="palette-dropdown">
              {colorSchemes.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setColorScheme(s.id)
                    setShowPalette(false)
                  }}
                  className={`palette-item ${colorSchemeId === s.id ? 'active' : ''}`}
                >
                  <span
                    className="palette-dot"
                    style={{ background: s.light['--accent'] }}
                  />
                  {s.name}
                </button>
              ))}
              <label className={`palette-item ${colorSchemeId === 'custom' ? 'active' : ''}`}>
                <input
                  type="color"
                  value={customAccent}
                  onChange={(e) => setCustomAccent(e.target.value)}
                  style={{ width: 18, height: 18, border: 'none', padding: 0, cursor: 'pointer', borderRadius: '50%' }}
                />
                <span style={{ marginLeft: 8 }}>自定义</span>
              </label>
            </div>
          )}
        </div>
        <button onClick={toggleTheme} className="toolbar-btn" title="切换主题" aria-label="切换主题">
          {theme === 'light' ? <FiMoon size={14} /> : <FiSun size={14} />}
        </button>
      </div>
    </div>
  )
}
