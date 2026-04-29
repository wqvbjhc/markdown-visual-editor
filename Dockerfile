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
COPY --from=builder --chown=user /app/dist ./dist
ENV PORT=7860 HOST=0.0.0.0
EXPOSE 7860
CMD ["serve", "-s", "dist", "-l", "tcp://0.0.0.0:7860"]
