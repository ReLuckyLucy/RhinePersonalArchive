FROM node:24.10.0-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production \
    RHINE_BIND_HOST=0.0.0.0 \
    RHINE_CONTAINER=1 \
    RHINE_CONFIG_FILE=/app/runtime/config/config.json \
    PLAYWRIGHT_BROWSERS_PATH=/app/runtime/browsers

COPY package.json package-lock.json ./
COPY scripts/patch-rolling-number.mjs ./scripts/patch-rolling-number.mjs
# PDF export uses the exact locked Playwright dependency.
RUN npm ci --include=dev && npm cache clean --force
COPY tsconfig.json vite.config.ts index.html LICENSE ./
COPY server/ ./server/
COPY shared/ ./shared/
COPY src/ ./src/
COPY public/ ./public/
COPY scripts/prepare-local-assets.mjs scripts/open-source.mjs scripts/open-source.d.mts scripts/open-source.ps1 scripts/open-browser.ps1 ./scripts/
RUN npm run build \
    && node scripts/prepare-local-assets.mjs --browsers --with-deps \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p runtime/library runtime/backups runtime/config \
    && chown -R node:node runtime

USER node
EXPOSE 4317
VOLUME ["/app/runtime/library", "/app/runtime/backups", "/app/runtime/config"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD ["node", "--input-type=module", "-e", "const r=await fetch('http://127.0.0.1:'+(process.env.RHINE_PORT||4317)+'/api/health');if(!r.ok)process.exit(1)"]
CMD ["node", "server/main.ts"]
