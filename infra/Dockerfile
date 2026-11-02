ARG NODE_IMAGE
FROM ${NODE_IMAGE} AS build
WORKDIR /workspace
COPY package.json package-lock.json ./
COPY packages ./packages
COPY apps ./apps
COPY scripts ./scripts
RUN npm ci
RUN npm run typecheck && npm run build

# A one-off migration image; do not run migrations in the app's start command.
FROM build AS migrator
CMD ["npm", "run", "db:migrate"]

ARG NODE_IMAGE
FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000
WORKDIR /app
COPY --from=build --chown=node:node /workspace/apps/code-lily/.next/standalone ./
COPY --from=build --chown=node:node /workspace/apps/code-lily/.next/static ./apps/code-lily/.next/static
USER node
EXPOSE 3000
CMD ["node", "apps/code-lily/server.js"]
