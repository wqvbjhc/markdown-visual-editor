import { visit } from 'unist-util-visit'
import type { Plugin } from 'unified'

const aiDict = [
  // 1. 宏大叙事与开场白（AI最爱）
  { pattern: /在当今(这个)?(快速发展的|瞬息万变的)?(数字化)?(时代|世界)中，?/g, replacement: '现在，' },
  { pattern: /在当今(这个)?(快速发展的|瞬息万变的)?(数字化)?(时代|世界)中/g, replacement: '现在' },
  { pattern: /随着时代的(不断)?发展/g, replacement: '这几年' },
  { pattern: /在全球化背景下/g, replacement: '现在大家都在说' },
  { pattern: /犹如一张(错综复杂的)?画卷/g, replacement: '就像' },

  // 2. 过度正式的过渡词
  { pattern: /总而言之，?/g, replacement: '说到底，' },
  { pattern: /不可否认的是，?/g, replacement: '必须承认，' },
  { pattern: /综上所述，?/g, replacement: '总的来说，' },
  { pattern: /值得(注意|一提)的是，?/g, replacement: '还有一点，' },
  { pattern: /毋庸置疑，?/g, replacement: '确实，' },
  { pattern: /不仅如此，?/g, replacement: '而且，' },
  { pattern: /需要(特别)?指出的是，?/g, replacement: '另外，' },
  { pattern: /首先，/g, replacement: '第一点，' },
  { pattern: /其次，/g, replacement: '接着，' },

  // 3. AI 最爱的四字成语/高级动词（大词小用）
  { pattern: /深入探讨/g, replacement: '聊聊' },
  { pattern: /深入挖掘/g, replacement: '仔细看看' },
  { pattern: /释放.*的潜力/g, replacement: '发挥作用' },
  { pattern: /赋能/g, replacement: '帮助' },
  { pattern: /无缝衔接/g, replacement: '连着' },
  { pattern: /至关重要/g, replacement: '很重要' },
  { pattern: /显著提升/g, replacement: '明显提高' },
  { pattern: /错综复杂/g, replacement: '挺复杂的' },
  { pattern: /充满活力/g, replacement: '很热闹' },

  // 4. 废话句型
  { pattern: /本文旨在/g, replacement: '这篇文章想分享' },
  { pattern: /本文将带您/g, replacement: '我们来看看' },
  
  // 进阶打断句式
  // 把太长的逗号连接句，强行改成两个短句
  { pattern: /，同时(，)?/g, replacement: '。而且$1' },
  // 打破 AI 喜欢用的“不仅...还...”
  { pattern: /不仅(.*?)(，|而且)还(.*?)(。)/g, replacement: '$1。这也导致了$3。' },
]

export const remarkDeAI: Plugin = () => {
  return (tree) => {
    visit(tree, 'text', (node: any, _index, parent: any) => {
      // 安全过滤：绝对不要修改代码块 (code)、行内代码 (inlineCode)、链接 (link) 内的文本
      // 在 remark AST 中，text 节点是基础文本，我们要看它的父节点是不是链接等
      if (
        parent &&
        parent.type !== 'code' && 
        parent.type !== 'inlineCode' &&
        parent.type !== 'link' &&
        parent.type !== 'heading'
      ) {
        let result = node.value
        aiDict.forEach(rule => {
          result = result.replace(rule.pattern, rule.replacement)
        })
        
        // 进阶玩法：随机扰乱（已移除，因为在实时预览编辑器中，Math.random() 会导致用户每次敲击键盘时，
        // 同一句话末尾的句号都会以 10% 的概率闪烁变成感叹号，造成严重的视觉体验问题）
        node.value = result
      }
    })
  }
}
