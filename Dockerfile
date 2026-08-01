# syntax=docker/dockerfile:1

FROM node:22-alpine AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable

WORKDIR /app

FROM base AS dependencies

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

FROM dependencies AS builder

COPY . .

RUN pnpm build

FROM node:22-alpine AS runner

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

WORKDIR /app

RUN mkdir -p /app/data \
    && chown node:node /app/data

COPY --from=builder --chown=node:node /app/.output ./.output

USER node

VOLUME ["/app/data"]

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
