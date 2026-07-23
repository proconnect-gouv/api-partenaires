FROM oven/bun:1.3.14-alpine AS build

WORKDIR /app

COPY package.json bun.lock tsconfig.json ./
RUN bun install --frozen-lockfile --production

COPY src/ ./src/
RUN bun build --compile --minify --sourcemap src/index.ts --outfile=partners

FROM alpine:3.24.1 AS runtime
RUN apk add --no-cache libstdc++
RUN addgroup -g 1001 -S bun && adduser -S bun -u 1001
USER bun

COPY config/ /etc/proconnect-gouv/api-partenaires/config
COPY --from=build --chown=bun:bun /app/partners /usr/local/bin/

EXPOSE 3000
CMD ["partners"]
