# syntax=docker/dockerfile:1.6

FROM node:20-bookworm-slim AS builder
WORKDIR /app
ENV CF_PAGES=1
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-bookworm-slim AS runner
RUN userdel -r node 2>/dev/null || true \
 && useradd -m -u 1000 user \
 && npm install -g serve@14
USER user
WORKDIR /home/user/app
# @cloudflare/vite-plugin 把 SPA 产物放 dist/client/（dist 根只有 worker bundle + client 子目录）。
# HF 不跑 Worker（飞书不可用），只取 dist/client 作 SPA 根，否则 serve 找不到 index.html → 目录列表。
COPY --from=builder --chown=user /app/dist/client ./dist
ENV PORT=7860 HOST=0.0.0.0
EXPOSE 7860
CMD ["serve", "-s", "dist", "-l", "tcp://0.0.0.0:7860"]
