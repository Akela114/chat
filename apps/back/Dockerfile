FROM node:25-slim as base

FROM base as prepare
WORKDIR /app
RUN npm install -g turbo@2.9.5
COPY . .
RUN turbo prune back --docker

FROM base as builder
WORKDIR /app
COPY --from=prepare /app/out/json/ .
RUN npm install
COPY --from=prepare /app/out/full/ .

FROM node:25-alpine as runner
WORKDIR /app
COPY --from=builder /app .
EXPOSE 5000 5005
ENTRYPOINT ["apps/back/entrypoint.sh"]