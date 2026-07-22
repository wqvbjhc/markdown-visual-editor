// 测试专用 ESM resolve hook：
//  1. 给无扩展名的相对导入补 .ts（node ESM 默认不解析 './types' 这类；vite/webpack 才补。node 25 原生剥类型，只差这一步）
//  2. 解析项目别名 `@/x` → <cwd>/src/x.ts（行为测试 import 含 `@/` 的 src 时需要）
// 用法：node --experimental-loader ./tests/_esm-resolve.mjs --test tests/xxx.test.ts
//  （注意是 --experimental-loader，不是 --import；--import 不自动注册 hook，需手动 module.register）
import { fileURLToPath, pathToFileURL } from 'node:url'
import { existsSync } from 'node:fs'
import path from 'node:path'

export async function resolve(specifier, context, nextResolve) {
  // @/ → <cwd>/src/<x>
  if (specifier.startsWith('@/')) {
    const rel = specifier.slice(2)
    const abs = path.resolve(process.cwd(), 'src', rel)
    for (const ext of ['.ts', '.js', '.mjs']) {
      if (existsSync(abs + ext)) return nextResolve(pathToFileURL(abs + ext).href, context)
    }
  }

  const isRelative = specifier.startsWith('./') || specifier.startsWith('../')
  const hasExt = /\.(ts|js|mjs|cjs|json|node)$/.test(specifier)
  if (isRelative && !hasExt) {
    const tsUrl = new URL(specifier + '.ts', context.parentURL)
    try {
      if (existsSync(fileURLToPath(tsUrl))) {
        return nextResolve(tsUrl.href, context)
      }
    } catch {
      // 忽略，走默认解析
    }
  }
  return nextResolve(specifier, context)
}
