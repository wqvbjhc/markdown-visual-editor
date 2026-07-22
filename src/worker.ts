/**
 * Cloudflare Worker 入口。
 *
 * 职责：
 *  - 处理 `/api/feishu/*` 接口（飞书文档导出代理 + OAuth）
 *  - 其余请求交给 ASSETS 绑定（静态资源 / SPA）
 *
 * 鉴权方式：用户身份 OAuth（user_access_token）。组织限制应用身份高级权限，故走 OAuth。
 * 流程：浏览器点「创建飞书文档」→ /oauth/start 跳飞书授权 → 回调 /oauth/callback 换 token
 *       → HTTP-only cookie 存 → /export 用 cookie 调飞书 API。
 *
 * app_id 可进前端（非密钥），app_secret 仅在 Worker（env）。token 存 cookie（HttpOnly 防 JS 读）。
 *
 * Phase 4 图片 + Phase 5 Mermaid：浏览器把图（本地图/公网图/mermaid 渲染 PNG）fetch 成 base64 随请求送来，
 *   Worker 三步走：descendant 建空 image block（返 block_id_relations）→ upload_all 上传图拿 file_token
 *   → batch_update replace_image 绑回。权限 drive:drive 已覆盖，无需新 scope。
 *   公式 equation（Phase 3）在 converter 直出，不经 Worker。
 */

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> }
  FEISHU_APP_ID: string
  FEISHU_APP_SECRET: string
}

/** Worker 接收的导出请求体（浏览器 POST） */
interface ExportRequest {
  title?: string
  children_id?: string[]
  descendants?: unknown[]
  images?: ImageUploadRequest[]
}

/** 浏览器送来的单张图（base64 字节，block_id 是 converter 产的临时 id） */
interface ImageUploadRequest {
  block_id: string
  file_name: string
  mime: string
  data_base64: string
}

const FEISHU_BASE = 'https://open.feishu.cn/open-apis'
const AUTH_URL = 'https://accounts.feishu.cn/open-apis/authen/v1/authorize'
const TOKEN_URL = 'https://open.feishu.cn/open-apis/authen/v2/oauth/token'
/** 用户身份所需的 scope（需在飞书后台为「用户身份」开通并发布） */
const SCOPES = 'docx:document drive:drive'

/** cookie 读取（decodeURIComponent 容错：非法 % 序列当原文，避免攻击者构造 cookie 抛 URIError 做 500） */
function getCookie(request: Request, name: string): string | null {
  const header = request.headers.get('Cookie')
  if (!header) return null
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) {
      try {
        return decodeURIComponent(v.join('='))
      } catch {
        return v.join('=')
      }
    }
  }
  return null
}

/** 构造带 Set-Cookie 的 302 响应 */
function redirectWithCookie(location: string, cookies: string[]): Response {
  const headers: Record<string, string> = { Location: location }
  // 多个 Set-Cookie 用 getSetCookie（Workers 支持）；fallback 合并
  const res = new Response(null, { status: 302, headers })
  for (const c of cookies) res.headers.append('Set-Cookie', c)
  return res
}

/** /api/feishu/oauth/start —— 跳飞书授权页，带 state 防 CSRF */
function handleOAuthStart(request: Request, env: Env): Response {
  const url = new URL(request.url)
  const redirectUri = `${url.origin}/api/feishu/oauth/callback`
  const state = crypto.randomUUID()
  const authUrl =
    `${AUTH_URL}?client_id=${encodeURIComponent(env.FEISHU_APP_ID)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&state=${state}` +
    `&scope=${encodeURIComponent(SCOPES)}`
  return redirectWithCookie(authUrl, [
    `feishu_oauth_state=${state}; HttpOnly; Path=/; Max-Age=600; SameSite=Lax`,
  ])
}

/** /api/feishu/oauth/callback —— 飞书回调，验 state、换 token、存 cookie、回首页 */
async function handleOAuthCallback(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  try {
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const cookieState = getCookie(request, 'feishu_oauth_state')
    if (!code || !state || state !== cookieState) {
      return new Response('bad state or missing code', { status: 400 })
    }
    const redirectUri = `${url.origin}/api/feishu/oauth/callback`
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: env.FEISHU_APP_ID,
        client_secret: env.FEISHU_APP_SECRET,
        code,
        redirect_uri: redirectUri,
      }),
    })
    const data = (await readJson(res)) as {
      access_token?: string
      refresh_token?: string
      expires_in?: number
      refresh_token_expires_in?: number
      error?: string
      error_description?: string
    }
    if (!data.access_token) {
      return new Response(
        `token exchange failed: ${data.error || ''} ${data.error_description || JSON.stringify(data)}`,
        { status: 500 },
      )
    }
    const expiresIn = data.expires_in ?? 7200
    const refreshExpiresIn = data.refresh_token_expires_in ?? 30 * 24 * 3600
    return redirectWithCookie(`${url.origin}/`, [
      // access token 提前 60s 失效
      `feishu_token=${encodeURIComponent(data.access_token)}; HttpOnly; Path=/; Max-Age=${expiresIn - 60}; SameSite=Lax`,
      `feishu_refresh=${encodeURIComponent(data.refresh_token || '')}; HttpOnly; Path=/; Max-Age=${refreshExpiresIn}; SameSite=Lax`,
      `feishu_oauth_state=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`,
    ])
  } catch (e) {
    // token 交换网络/非 JSON 失败：重定向回首页带错误，避免用户卡在 /callback（auth code 已消费，重试需重授权）
    const msg = e instanceof Error ? e.message : String(e)
    return redirectWithCookie(`${url.origin}/?feishu_error=${encodeURIComponent(msg)}`, [
      `feishu_oauth_state=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`,
    ])
  }
}

/** /api/feishu/status —— 前端探测是否已授权（有 token cookie） */
function handleStatus(request: Request): Response {
  const token = getCookie(request, 'feishu_token')
  return Response.json({ authed: !!token })
}

/** /api/feishu/oauth/refresh —— 用 refresh_token cookie 静默换新 access token，避免每 2h 重走 OAuth */
async function handleRefresh(request: Request, env: Env): Promise<Response> {
  const refreshToken = getCookie(request, 'feishu_refresh')
  if (!refreshToken) {
    return Response.json(
      { ok: false, need_auth: true, auth_url: '/api/feishu/oauth/start' },
      { status: 401 },
    )
  }
  try {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        client_id: env.FEISHU_APP_ID,
        client_secret: env.FEISHU_APP_SECRET,
        refresh_token: refreshToken,
      }),
    })
    const data = (await readJson(res)) as {
      access_token?: string
      refresh_token?: string
      expires_in?: number
      error?: string
    }
    if (!data.access_token) {
      // refresh_token 也过期/失效 → 走完整 OAuth
      return Response.json(
        { ok: false, need_auth: true, auth_url: '/api/feishu/oauth/start' },
        { status: 401 },
      )
    }
    const expiresIn = data.expires_in ?? 7200
    const resp = Response.json({ ok: true })
    resp.headers.append(
      'Set-Cookie',
      `feishu_token=${encodeURIComponent(data.access_token)}; HttpOnly; Path=/; Max-Age=${expiresIn - 60}; SameSite=Lax`,
    )
    if (data.refresh_token) {
      resp.headers.append(
        'Set-Cookie',
        `feishu_refresh=${encodeURIComponent(data.refresh_token)}; HttpOnly; Path=/; Max-Age=${30 * 24 * 3600}; SameSite=Lax`,
      )
    }
    return resp
  } catch (e) {
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }
}

/** 建新版文档（folder_token 空串 = 我的云空间根） */
async function createDocument(
  token: string,
  title?: string,
): Promise<{ document_id: string; revision_id: number }> {
  const res = await fetch(`${FEISHU_BASE}/docx/v1/documents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ folder_token: '', title: title || '未命名文档' }),
  })
  const data = (await readJson(res)) as {
    code: number
    msg: string
    data?: { document?: { document_id: string; revision_id: number } }
  }
  if (data.code !== 0 || !data.data?.document) {
    throw new Error(`飞书创建文档失败: code=${data.code} msg=${data.msg}`)
  }
  return data.data.document
}

/**
 * 一次性塞嵌套块树（descendant API，≤1000 块/次）。
 * parent_block_id 填 document_id（在文档根创建）。children_id 是根的直接子块。
 * 返回 block_id_relations：临时 block_id → 真实 block_id 映射（图片上传要用真实 id）。
 */
async function createDescendants(
  token: string,
  documentId: string,
  parentBlockId: string,
  payload: { children_id: string[]; descendants: unknown[] },
): Promise<Record<string, string>> {
  const res = await fetch(
    `${FEISHU_BASE}/docx/v1/documents/${documentId}/blocks/${parentBlockId}/descendant`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ index: -1, children_id: payload.children_id, descendants: payload.descendants }),
    },
  )
  const data = (await readJson(res)) as {
    code: number
    msg: string
    // 飞书返 {index: {block_id(真实), temporary_block_id(临时)}}，非扁平 {临时: 真实}
    data?: {
      block_id_relations?: Record<string, { block_id: string; temporary_block_id: string }>
    }
  }
  if (data.code !== 0) {
    throw new Error(`飞书写入块失败: code=${data.code} msg=${data.msg}`)
  }
  // 展平成 {临时id: 真实id}，图片上传用真实 id 查
  const relations: Record<string, string> = {}
  const raw = data.data?.block_id_relations ?? {}
  for (const v of Object.values(raw)) {
    if (v?.temporary_block_id && v?.block_id) {
      relations[v.temporary_block_id] = v.block_id
    }
  }
  return relations
}

/** 读 Response JSON；非 JSON（502/HTML/维护页）抛带 HTTP 状态的友好错误，避免 SyntaxError「Unexpected token <」误诊 */
async function readJson(res: Response): Promise<unknown> {
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`飞书返回非 JSON（HTTP ${res.status}）: ${text.slice(0, 200)}`)
  }
}

/** 飞书 user_access_token 过期/无效 code（99991661/99991663/99991664 等）→ 前端应 re-OAuth，非通用 500 */
const AUTH_EXPIRED_RE = /code=9999166\d/
function isAuthError(msg: string): boolean {
  return AUTH_EXPIRED_RE.test(msg)
}

/** base64 → Uint8Array（Worker 支持 atob） */
function decodeBase64(b64: string): Uint8Array {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

/**
 * 上传单张图片素材到指定 image block（upload_all）。
 * parent_node = image 真实 block_id，parent_type = docx_image。返回 file_token。
 * 权限 drive:drive 覆盖（现有 user OAuth scope 够，无需新增）。
 */
async function uploadMedia(
  token: string,
  parentNode: string,
  fileName: string,
  mime: string,
  bytes: Uint8Array,
): Promise<string> {
  const MAX = 20 * 1024 * 1024 // 飞书 upload_all 单文件 20MB 上限
  if (bytes.length > MAX) {
    throw new Error(`图片超 20MB 上限（${(bytes.length / 1024 / 1024).toFixed(1)}MB），飞书 upload_all 不收`)
  }
  const form = new FormData()
  form.append('file_name', fileName)
  form.append('parent_type', 'docx_image')
  form.append('parent_node', parentNode)
  form.append('size', String(bytes.length))
  form.append('file', new Blob([bytes as unknown as ArrayBuffer], { type: mime }), fileName)
  // 注意：multipart 不能手设 Content-Type，FormData 自动带 boundary
  const res = await fetch(`${FEISHU_BASE}/drive/v1/medias/upload_all`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })
  const data = (await readJson(res)) as { code: number; msg: string; data?: { file_token?: string } }
  if (data.code !== 0 || !data.data?.file_token) {
    throw new Error(`飞书图片上传失败: code=${data.code} msg=${data.msg}`)
  }
  return data.data.file_token
}

/** 批量把 file_token 绑回 image block（batch_update replace_image） */
async function bindImages(
  token: string,
  documentId: string,
  bindings: { block_id: string; token: string }[],
): Promise<void> {
  if (bindings.length === 0) return
  const res = await fetch(`${FEISHU_BASE}/docx/v1/documents/${documentId}/blocks/batch_update`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      requests: bindings.map((b) => ({ block_id: b.block_id, replace_image: { token: b.token } })),
    }),
  })
  const data = (await readJson(res)) as { code: number; msg: string }
  if (data.code !== 0) {
    throw new Error(`飞书图片绑定失败: code=${data.code} msg=${data.msg}`)
  }
}

/** /api/feishu/export —— 用 user token 建文档并写入 block 树 */
async function handleExport(request: Request): Promise<Response> {
  const token = getCookie(request, 'feishu_token')
  if (!token) {
    return Response.json(
      { ok: false, need_auth: true, auth_url: '/api/feishu/oauth/start' },
      { status: 401 },
    )
  }

  let body: ExportRequest = {}
  try {
    body = (await request.json()) as ExportRequest
  } catch {
    // 无 body 也允许（建空文档，向后兼容 Phase 1 探活）
  }

  try {
    const descendants = body.descendants ?? []
    // descendant API 单次 ≤1000 块；先查再建文档，避免超限返错却已留孤儿空文档在用户云空间
    if (descendants.length > 1000) {
      return Response.json(
        { ok: false, error: `块数 ${descendants.length} 超过单次上限 1000，暂不支持（待分批）` },
        { status: 413 },
      )
    }
    const doc = await createDocument(token, body.title)
    let relations: Record<string, string> = {}
    if (descendants.length > 0) {
      relations = await createDescendants(token, doc.document_id, doc.document_id, {
        children_id: body.children_id ?? [],
        descendants,
      })
    }

    // 图片：每张 upload_all 拿 file_token，最后一次性 batch_update 绑回。
    // 单张上传失败不阻断（该图空框）；绑定失败也不阻断（文档已建、media 已传），仍返 url 给用户。
    const images = body.images ?? []
    const bindings: { block_id: string; token: string }[] = []
    const image_errors: string[] = []
    for (const img of images) {
      const realId = relations[img.block_id]
      if (!realId) {
        image_errors.push(`图片块 ${img.block_id} 未在 descendant 映射中，跳过`)
        continue
      }
      try {
        const bytes = decodeBase64(img.data_base64)
        const fileToken = await uploadMedia(token, realId, img.file_name, img.mime, bytes)
        bindings.push({ block_id: realId, token: fileToken })
      } catch (e) {
        image_errors.push(`图片 ${img.file_name} 上传失败: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
    if (bindings.length > 0) {
      try {
        await bindImages(token, doc.document_id, bindings)
      } catch (e) {
        image_errors.push(`图片绑定失败（文档已建、media 已传，仅绑定未完成）: ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    return Response.json({
      ok: true,
      document_id: doc.document_id,
      url: `https://feishu.cn/docx/${doc.document_id}`,
      image_errors: image_errors.length > 0 ? image_errors : undefined,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    // token 过期/无效 → 前端跳 re-OAuth，非通用 500
    if (isAuthError(msg)) {
      return Response.json(
        { ok: false, need_auth: true, auth_url: '/api/feishu/oauth/start' },
        { status: 401 },
      )
    }
    return Response.json({ ok: false, error: msg }, { status: 500 })
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname
    if (path === '/api/feishu/oauth/start' && request.method === 'GET') {
      return handleOAuthStart(request, env)
    }
    if (path === '/api/feishu/oauth/callback' && request.method === 'GET') {
      return handleOAuthCallback(request, env)
    }
    if (path === '/api/feishu/status' && request.method === 'GET') {
      return handleStatus(request)
    }
    if (path === '/api/feishu/oauth/refresh' && request.method === 'POST') {
      return handleRefresh(request, env)
    }
    if (path === '/api/feishu/export' && request.method === 'POST') {
      return handleExport(request)
    }
    // 其余走静态资源（SPA）。prod 下 env.ASSETS 由 Workers Static Assets 自动注入；
    // dev 下 vite-plugin 不注入 ASSETS（资源由 vite 中间件直接服务，到不了这），未知路径回 404 防 500 崩。
    if (env.ASSETS) {
      return env.ASSETS.fetch(request)
    }
    return new Response('Not Found', { status: 404 })
  },
}
