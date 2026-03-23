export const sampleMarkdown = `# Markdown Visual Editor

> Rich Markdown preview with platform-aware export, local media preview, and PDF output.

## Highlights

- GFM tables, task lists, and footnotes
- KaTeX math rendering
- Mermaid diagrams
- Syntax-highlighted code blocks
- Image and video directives

## Extended image directive

::image{src="https://picsum.photos/900/480" alt="Sample landscape" caption="Remote image rendered as a figure with caption." width="720px"}

## Standard image markdown

![Fallback image example](https://picsum.photos/720/360 "Markdown image title")

## Extended video directive

::video{src="https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4" poster="https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1280&q=80" title="Preview videos in default/mobile, export as card in WeChat/Toutiao" href="https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4"}

## Raw HTML video

<video controls poster="https://images.unsplash.com/photo-1493246507139-91e8fad9978e?auto=format&fit=crop&w=1280&q=80" title="Raw HTML video also works" src="https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4"></video>

## Math

Inline math: $E = mc^2$ and $\\sum_{i=1}^{n} x_i$.

$$
\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}
$$

## Code

\`\`\`typescript
interface User {
  id: number
  name: string
  email: string
}

async function fetchUser(id: number): Promise<User> {
  const res = await fetch(\`/api/users/\${id}\`)
  if (!res.ok) throw new Error('Failed to fetch user')
  return res.json()
}
\`\`\`

## Mermaid

\`\`\`mermaid
graph TD
    A[Draft] --> B{Has media?}
    B -->|Yes| C[Preview with images and videos]
    B -->|No| D[Export as formatted article]
    C --> E[Copy to WeChat or Toutiao]
    D --> E
\`\`\`

## Table

| Format | Images | Videos |
|--------|--------|--------|
| Default | Native preview | Native preview |
| WeChat | Styled export | Poster + title + link |
| Toutiao | Styled export | Poster + title + link |
| Mobile | Native preview in phone frame | Native preview in phone frame |

[^1]: Local files are session-only for preview. Local image copying is best effort and depends on browser/editor paste handling.
`
