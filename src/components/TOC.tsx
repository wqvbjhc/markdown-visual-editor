import { useStore } from '@/utils/store'
import { extractToc } from '@/pipeline/processor'

export function TOC() {
  const { html } = useStore()
  const items = extractToc(html)

  if (items.length === 0) return null

  return (
    <nav className="toc">
      <div className="toc-title">目录</div>
      <ul className="toc-list">
        {items.map((item, i) => (
          <li key={i} style={{ paddingLeft: `${(item.level - 1) * 12}px` }}>
            <a href={`#${item.id}`} className="toc-link" onClick={(e) => {
              e.preventDefault()
              document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth' })
            }}>
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
