import type { Root } from 'hast'
import { visit } from 'unist-util-visit'

export function rehypeImage() {
  return (tree: Root) => {
    visit(tree, 'element', (node) => {
      if (node.tagName !== 'img') return
      node.properties = {
        ...node.properties,
        loading: 'lazy',
        decoding: 'async',
        onerror: "this.onerror=null;this.src='data:image/svg+xml,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"200\" height=\"150\" fill=\"%23ccc\"><rect width=\"200\" height=\"150\" rx=\"8\"/><text x=\"50%\" y=\"50%\" text-anchor=\"middle\" dy=\".3em\" fill=\"%23999\" font-size=\"14\">Image not found</text></svg>';this.classList.add('img-fallback')",
      }
      if (!node.properties.className) {
        node.properties.className = []
      }
    })
  }
}
