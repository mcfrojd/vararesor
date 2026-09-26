# ---- Steg 1: bygg SvelteKit-appen till statiska filer ----
FROM node:22-alpine AS web
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
# Versionen (commit, datum, pushad) som JSON, satt av deploy.sh. Visas på profilsidan.
ARG APP_VERSION=""
RUN APP_VERSION="$APP_VERSION" npm run build

# ---- Steg 2: PocketBase som serverar API + appen ----
FROM alpine:3.22
ARG PB_VERSION=0.40.4
# Sätts automatiskt av docker buildx (amd64 hemma, arm64 på Oracle Ampere).
ARG TARGETARCH

RUN apk add --no-cache ca-certificates unzip wget \
 && wget -q "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${TARGETARCH}.zip" -O /tmp/pb.zip \
 && unzip /tmp/pb.zip pocketbase -d /pb \
 && rm /tmp/pb.zip \
 && apk del unzip wget

COPY pocketbase/pb_migrations /pb/pb_migrations
COPY pocketbase/pb_hooks /pb/pb_hooks
COPY --from=web /web/build /pb/pb_public

# Samma version för servern, så att appen kan se om den har den senaste.
ARG APP_VERSION=""
ENV APP_VERSION=$APP_VERSION

EXPOSE 8090
VOLUME /pb/pb_data

HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:8090/api/health || exit 1

CMD ["/pb/pocketbase", "serve", "--http=0.0.0.0:8090", "--dir=/pb/pb_data", "--publicDir=/pb/pb_public", "--migrationsDir=/pb/pb_migrations", "--hooksDir=/pb/pb_hooks"]
