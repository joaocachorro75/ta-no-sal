FROM node:22-slim

WORKDIR /app

COPY . .

RUN npm install -g corepack@latest \
  && corepack pnpm install --frozen-lockfile \
  && corepack pnpm run build

ENV NODE_ENV=production

CMD ["sh", "-c", "corepack pnpm db:migrate && exec node dist/index.js"]
