/**
 * 飞书 docx block 极简类型（仅覆盖本转换器产出的块）。
 *
 * 不整包引入 huandu 类型：我们语境是浏览器 + Cloudflare Worker，且公式原生支持 huandu 没有，
 * 自写更直接。类型对照 huandu `types/feishu.ts` 与飞书 docx-v1 官方文档。
 *
 * 关键事实：
 *  - block_id 在「创建块」时由客户端自定义（临时 ID），飞书通过 block_id_relations 回映射成真实 ID。
 *  - descendant 接口一次性建整棵树：descendants 是扁平数组，块之间的父子关系靠 children: string[] 引用；
 *    顶层 children_id 指明挂在 parent（文档根）下的直接子块。
 */

/** 本转换器用到的 block_type 枚举（飞书 docx-v1） */
export const BlockType = {
  Page: 1,
  Text: 2,
  Heading1: 3,
  Heading2: 4,
  Heading3: 5,
  Heading4: 6,
  Heading5: 7,
  Heading6: 8,
  Heading7: 9,
  Heading8: 10,
  Heading9: 11,
  Bullet: 12,
  Ordered: 13,
  Code: 14,
  Quote: 15,
  Todo: 17,
  Divider: 22,
  Image: 27,
  Table: 31,
  TableCell: 32,
  QuoteContainer: 34,
} as const

/** 文本元素行内样式 */
export interface TextElementStyle {
  bold?: boolean
  italic?: boolean
  strikethrough?: boolean
  underline?: boolean
  inline_code?: boolean
  link?: { url: string }
}

/** 文本运行（text_run） */
export interface TextRun {
  content: string
  text_element_style?: TextElementStyle
}

/** 公式（equation）—— content 吃 LaTeX（KaTeX 语法），Phase 3 启用 */
export interface EquationElement {
  content: string
  text_element_style?: TextElementStyle
}

/** 段落 elements[] 的联合（文本运行 / 公式） */
export interface TextElement {
  text_run?: TextRun
  equation?: EquationElement
}

/** 文本类块（Text / Heading / Bullet / Ordered / Quote / Todo）共用数据结构 */
export interface TextBlockData {
  elements: TextElement[]
  style?: {
    align?: number
    done?: boolean
    folded?: boolean
    language?: number
    wrap?: boolean
  }
}

/** 代码块数据（elements 放整段代码，style.language 是整数枚举） */
export interface CodeBlockData {
  elements: TextElement[]
  style: { language: number; wrap?: boolean }
}

/** 表格块数据 */
export interface TableBlockData {
  property: {
    row_size: number
    column_size: number
    column_width?: number[]
    header_row?: boolean
  }
}

/** 飞书 block（仅含本转换器产出的字段） */
export interface FeishuBlock {
  block_id: string
  block_type: number
  children: string[]
  text?: TextBlockData
  heading1?: TextBlockData
  heading2?: TextBlockData
  heading3?: TextBlockData
  heading4?: TextBlockData
  heading5?: TextBlockData
  heading6?: TextBlockData
  heading7?: TextBlockData
  heading8?: TextBlockData
  heading9?: TextBlockData
  bullet?: TextBlockData
  ordered?: TextBlockData
  code?: CodeBlockData
  quote?: TextBlockData
  todo?: TextBlockData
  divider?: Record<string, never>
  image?: { token?: string; width?: number; height?: number; align?: number }
  table?: TableBlockData
  table_cell?: Record<string, never>
  quote_container?: Record<string, never>
}

/** descendant 创建请求体 */
export interface DescendantPayload {
  /** 文档根的直接子块 ID */
  children_id: string[]
  /** 扁平的所有块（含父子引用） */
  descendants: FeishuBlock[]
}

/**
 * 代码块语言枚举（飞书整数，节选常用；未命中的语言降级 PlainText=1）。
 * 对照 huandu utils-language.ts / 飞书 docx CodeLanguage。
 */
export const CodeLanguage = {
  PlainText: 1,
  Bash: 7,
  CSharp: 8,
  CPlusPlus: 9,
  C: 10,
  CSS: 12,
  CoffeeScript: 13,
  Dart: 15,
  Dockerfile: 18,
  Erlang: 19,
  Fortran: 20,
  Go: 22,
  Groovy: 23,
  HTML: 24,
  HTTP: 26,
  Haskell: 27,
  JSON: 28,
  Java: 29,
  JavaScript: 30,
  Julia: 31,
  Kotlin: 32,
  LaTeX: 33,
  Lisp: 34,
  Lua: 36,
  MATLAB: 37,
  Makefile: 38,
  Markdown: 39,
  Nginx: 40,
  ObjectiveC: 41,
  PHP: 43,
  Perl: 44,
  PowerShell: 46,
  Prolog: 47,
  ProtoBuf: 48,
  Python: 49,
  R: 50,
  Ruby: 52,
  Rust: 53,
  SCSS: 55,
  SQL: 56,
  Scala: 57,
  Scheme: 58,
  Shell: 60,
  Swift: 61,
  Thrift: 62,
  TypeScript: 63,
  VBScript: 64,
  XML: 66,
  YAML: 67,
  CMake: 68,
  Diff: 69,
  GraphQL: 71,
  GLSL: 72,
  Properties: 73,
  Solidity: 74,
  TOML: 75,
} as const

const LANGUAGE_MAP: Record<string, number> = {
  text: CodeLanguage.PlainText, plaintext: CodeLanguage.PlainText, plain: CodeLanguage.PlainText,
  bash: CodeLanguage.Bash, shell: CodeLanguage.Shell, sh: CodeLanguage.Shell, zsh: CodeLanguage.Shell,
  c: CodeLanguage.C, cpp: CodeLanguage.CPlusPlus, 'c++': CodeLanguage.CPlusPlus,
  csharp: CodeLanguage.CSharp, 'c#': CodeLanguage.CSharp, cs: CodeLanguage.CSharp,
  objectivec: CodeLanguage.ObjectiveC, 'objective-c': CodeLanguage.ObjectiveC, objc: CodeLanguage.ObjectiveC,
  javascript: CodeLanguage.JavaScript, js: CodeLanguage.JavaScript,
  typescript: CodeLanguage.TypeScript, ts: CodeLanguage.TypeScript,
  html: CodeLanguage.HTML, css: CodeLanguage.CSS, scss: CodeLanguage.SCSS, sass: CodeLanguage.SCSS,
  java: CodeLanguage.Java, kotlin: CodeLanguage.Kotlin, kt: CodeLanguage.Kotlin,
  go: CodeLanguage.Go, golang: CodeLanguage.Go,
  rust: CodeLanguage.Rust, rs: CodeLanguage.Rust,
  python: CodeLanguage.Python, py: CodeLanguage.Python,
  ruby: CodeLanguage.Ruby, rb: CodeLanguage.Ruby,
  php: CodeLanguage.PHP, swift: CodeLanguage.Swift, scala: CodeLanguage.Scala,
  perl: CodeLanguage.Perl, lua: CodeLanguage.Lua, r: CodeLanguage.R,
  dart: CodeLanguage.Dart, julia: CodeLanguage.Julia,
  haskell: CodeLanguage.Haskell, hs: CodeLanguage.Haskell,
  erlang: CodeLanguage.Erlang, erl: CodeLanguage.Erlang, elixir: CodeLanguage.Erlang,
  groovy: CodeLanguage.Groovy, lisp: CodeLanguage.Lisp, clojure: CodeLanguage.Lisp, scheme: CodeLanguage.Scheme,
  prolog: CodeLanguage.Prolog, fortran: CodeLanguage.Fortran, cobol: 11,
  assembly: 6, asm: 6,
  json: CodeLanguage.JSON, xml: CodeLanguage.XML, yaml: CodeLanguage.YAML, yml: CodeLanguage.YAML,
  toml: CodeLanguage.TOML, ini: CodeLanguage.Properties, properties: CodeLanguage.Properties,
  markdown: CodeLanguage.Markdown, md: CodeLanguage.Markdown, latex: CodeLanguage.LaTeX, tex: CodeLanguage.LaTeX,
  sql: CodeLanguage.SQL,
  dockerfile: CodeLanguage.Dockerfile, docker: CodeLanguage.Dockerfile,
  makefile: CodeLanguage.Makefile, make: CodeLanguage.Makefile, cmake: CodeLanguage.CMake,
  nginx: CodeLanguage.Nginx, apache: 4,
  graphql: CodeLanguage.GraphQL, gql: CodeLanguage.GraphQL,
  protobuf: CodeLanguage.ProtoBuf, proto: CodeLanguage.ProtoBuf, thrift: CodeLanguage.Thrift,
  powershell: CodeLanguage.PowerShell, ps1: CodeLanguage.PowerShell,
  vbscript: CodeLanguage.VBScript, vb: CodeLanguage.VBScript,
  coffeescript: CodeLanguage.CoffeeScript, coffee: CodeLanguage.CoffeeScript,
  diff: CodeLanguage.Diff, patch: CodeLanguage.Diff,
  http: CodeLanguage.HTTP, matlab: CodeLanguage.MATLAB,
  solidity: CodeLanguage.Solidity, sol: CodeLanguage.Solidity,
  glsl: CodeLanguage.GLSL, shader: CodeLanguage.GLSL,
}

/** Markdown 代码块语言 → 飞书 CodeLanguage 枚举，未命中降级 PlainText */
export function mapCodeLanguage(lang: string | undefined | null): number {
  if (!lang) return CodeLanguage.PlainText
  return LANGUAGE_MAP[lang.toLowerCase().trim()] ?? CodeLanguage.PlainText
}
