import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkCjkFriendly from 'remark-cjk-friendly'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkBreaks from 'remark-breaks'
import remarkDirective from 'remark-directive'
import remarkRehype from 'remark-rehype'
import rehypeKatex from 'rehype-katex'
import rehypeSanitize from 'rehype-sanitize'
import rehypeSlug from 'rehype-slug'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import rehypeExternalLinks from 'rehype-external-links'
import rehypeStringify from 'rehype-stringify'
import { sanitizeSchema } from '@/utils/sanitize-schema'
import { rehypeTableWrap } from './plugins/rehype-table-wrap'
import { rehypeImage } from './plugins/rehype-image'
import { rehypeVideo } from './plugins/rehype-video'
import { rehypeMermaid } from './plugins/rehype-mermaid'
import { remarkDeAI } from './plugins/remark-deai'
import { remarkMediaDirective } from './plugins/remark-media-directive'
import { remarkSourceLine } from './plugins/remark-source-line'

function createProcessor(enableDeAI: boolean) {
  const processor = unified()
    .use(remarkParse)
    .use(remarkCjkFriendly)
    // singleTilde:false 关单波浪线删除线（GFM 默认允许 ~x~）：中文技术写作常用 ~ 表数字范围
    // （0.1~0.2、2024~2026），同段多个范围会被顺序配对成删除线吞掉中间正文。~~x~~ 仍可用
    .use(remarkGfm, { singleTilde: false })
    .use(remarkMath)
    .use(remarkBreaks)
    .use(remarkDirective)

  if (enableDeAI) {
    processor.use(remarkDeAI)
  }

  return processor
    .use(remarkMediaDirective)
    // mdast 阶段末尾注入源行号锚点（滚动同步用），须在 remarkRehype 前
    .use(remarkSourceLine)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeKatex)
    .use(rehypeMermaid)
    .use(rehypeTableWrap)
    .use(rehypeImage)
    .use(rehypeVideo)
    .use(rehypeSanitize, sanitizeSchema)
    .use(rehypeSlug)
    .use(rehypeAutolinkHeadings, { behavior: 'wrap' })
    .use(rehypeExternalLinks, {
      target: '_blank',
      rel: ['noopener', 'noreferrer'],
    })
    .use(rehypeStringify, { allowDangerousHtml: true })
}

const defaultProcessor = createProcessor(false)
const deAIProcessor = createProcessor(true)

export async function processMarkdown(md: string, enableDeAI: boolean = false): Promise<string> {
  const processor = enableDeAI ? deAIProcessor : defaultProcessor
  const file = await processor.process(md)
  return String(file)
}

export interface TocItem {
  id: string
  text: string
  level: number
}

export function extractToc(html: string): TocItem[] {
  const items: TocItem[] = []
  const re = /<h([1-6])\s+id="([^"]*)"[^>]*>(.*?)<\/h[1-6]>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    const text = m[3].replace(/<[^>]+>/g, '')
    items.push({ level: parseInt(m[1]), id: m[2], text })
  }
  return items
}
