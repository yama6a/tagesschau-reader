# The build stage runs on the runner's own platform: dist/ is plain files, so one build serves
# both architectures and nothing runs under QEMU.
FROM --platform=$BUILDPLATFORM node:26-alpine@sha256:6bd9ab43c0ec0190ca7b2d193906cb8b7edf6e7f4afa43ddeccd6452710bffb5 AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

# nginx-unprivileged rather than nginx: it runs as uid 101 and writes its caches under /tmp, so the
# pod keeps the cluster's restricted securityContext and needs no root to bind a port.
FROM nginxinc/nginx-unprivileged:1.31-alpine@sha256:b5047b9b76845eac124358373c6852377c52e4b05834a47647e955dd91cb8f1e
USER 0
# The base image lags behind Alpine security fixes.
RUN apk upgrade --no-cache
USER 101:101
COPY --from=build /app/dist/ /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
USER 101:101
EXPOSE 8080
