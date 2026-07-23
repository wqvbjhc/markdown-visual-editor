/**
 * 去掉标题里的自锚超链接包裹。
 *
 * processor.ts 用 rehype-slug + rehype-autolink-headings(behavior:'wrap') 把每个标题整段
 * 包进 <a href="#slug">，预览里点标题跳锚点导航 / 拿 permalink。但 #slug 离开本页就是死链，
 * 复制到任何平台（公众号 / 头条 / 飞书 / 默认 / Mobile）都只会变成无意义超链接。
 *
 * 故复制链路（prepareClipboardHtml，全格式必经）统一剥掉：用 <a> 子节点替换 <a> 本身。
 * 外链（http/https，标题里罕见）保留不动——只去自锚。
 */
export function unwrapSelfAnchorHeadingLinks(root: HTMLElement): void {
  root.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach((heading) => {
    heading.querySelectorAll('a').forEach((a) => {
      const anchor = a as HTMLAnchorElement
      const href = anchor.getAttribute('href') || ''
      // 仅去标题内的自锚（href 以 # 开头）；外链保留
      if (!href.startsWith('#')) return
      const parent = anchor.parentElement
      if (!parent) return
      while (anchor.firstChild) parent.insertBefore(anchor.firstChild, anchor)
      anchor.remove()
    })
  })
}
