import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkBreaks from 'remark-breaks'
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
import { rehypeMermaid } from './plugins/rehype-mermaid'
import { remarkDeAI } from './plugins/remark-deai'

const defaultProcessor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkMath)
  .use(remarkBreaks)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeKatex)
  .use(rehypeMermaid)
  .use(rehypeTableWrap)
  .use(rehypeImage)
  .use(rehypeSanitize, sanitizeSchema)
  .use(rehypeSlug)
  .use(rehypeAutolinkHeadings, { behavior: 'wrap' })
  .use(rehypeExternalLinks, {
    target: '_blank',
    rel: ['noopener', 'noreferrer'],
  })
  .use(rehypeStringify, { allowDangerousHtml: true })

const deAIProcessor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkMath)
  .use(remarkBreaks)
  .use(remarkDeAI)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeKatex)
  .use(rehypeMermaid)
  .use(rehypeTableWrap)
  .use(rehypeImage)
  .use(rehypeSanitize, sanitizeSchema)
  .use(rehypeSlug)
  .use(rehypeAutolinkHeadings, { behavior: 'wrap' })
  .use(rehypeExternalLinks, {
    target: '_blank',
    rel: ['noopener', 'noreferrer'],
  })
  .use(rehypeStringify, { allowDangerousHtml: true })

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
