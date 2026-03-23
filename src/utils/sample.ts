export const sampleMarkdown = `# Markdown 可视化编辑器

> 支持 GFM、数学公式、Mermaid 图表、代码高亮等丰富语法。

## 基础语法

这是一段**粗体**和*斜体*以及~~删除线~~文本。

### 任务列表

- [x] 支持 GFM 表格
- [x] 支持数学公式
- [ ] 支持 Mermaid 图表
- [ ] 支持脚注

### 表格

| 功能 | 状态 | 说明 |
|------|:----:|------|
| GFM | ✅ | 完整支持 |
| KaTeX | ✅ | 行内和块级 |
| Mermaid | ✅ | 流程图等 |
| 代码高亮 | ✅ | shiki 驱动 |

## 数学公式

行内公式：$E = mc^2$，以及 $\\sum_{i=1}^{n} x_i$。

块级公式：

$$
\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}
$$

## 代码块

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

\`\`\`python
def fibonacci(n: int) -> list[int]:
    fib = [0, 1]
    for i in range(2, n):
        fib.append(fib[-1] + fib[-2])
    return fib[:n]

print(fibonacci(10))
\`\`\`

## Mermaid 图表

\`\`\`mermaid
graph TD
    A[开始] --> B{条件判断}
    B -->|是| C[执行操作A]
    B -->|否| D[执行操作B]
    C --> E[结束]
    D --> E
\`\`\`

## 图片

![示例图片](https://picsum.photos/600/300)

## 链接

[GitHub](https://github.com) | [Google](https://google.com)

## 引用

> 代码是写给人看的，附带能在机器上运行。
> — Harold Abelson

## 脚注

这是一个脚注示例[^1]。

[^1]: 这是脚注的内容。

---

*使用本编辑器，体验 Markdown 的强大功能。*
`
