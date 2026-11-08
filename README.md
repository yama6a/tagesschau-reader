# tagesschau-reader

A static web page for the phone that lists tagesschau stories newest first and opens each one in a dialog.
The browser calls the tagesschau API itself. There is no backend.

- Onboarding picks categories and federal states. The choice, the read marks and the "Gelesene anzeigen"
  switch live in `localStorage`, all under the key prefix `tagesschau-reader.v1.`.
- A story read since the page loaded shrinks to a strip. On the next load it is gone.
- The list pages back day by day as you scroll, about 30 days far.
- The list fetches the newest stories again every 2 minutes and when the tab becomes visible.

Risk: the API is the unofficial one the tagesschau app uses (bund.dev "tagesschau-api"). It can change or close
without notice.

## Data sources

| Selection                               | Feed                                                                             |
| --------------------------------------- | -------------------------------------------------------------------------------- |
| Any category except Sport, or any state | `https://www.tagesschau.de/api2u/news`, one page per day                         |
| Sport                                   | `https://www.tagesschau.de/api2u/news?ressort=sport`, one page for about 30 days |

- The full feed holds every story the other ressort feeds hold, so it is the only feed for those categories.
  The sport feed holds stories the full feed lacks.
- Sport stories come with `ressort: null`. The page counts every story of the sport feed as Sport.
- A nationwide story shows only when its `ressort` is a selected category.
- A nationwide story with `ressort: null` counts as "Weitere". These are live blogs, culture stories,
  commentaries and interviews. The page drops the ones whose `detailsweb` holds `/wetter/`, `/korrespondenten/`
  or `/multimedia/livestreams/`. These are the weather pages, the ARD studio pages and the livestream pages.
- With two feeds, the list shows only stories newer than the oldest loaded story of the feed that reaches
  least far back. The order then stays the same when the next page arrives.

## Run locally

Node comes from `.nvmrc`.

```bash
npm ci
npm run dev
```

The checks CI runs:

```bash
npm ci && npm run lint && npm run format:check && npm run typecheck && npm test && npm audit --audit-level=high && npm run build
```

`npm run dev` sends no Content-Security-Policy. Only the image does, from `nginx.conf`.

## Deploy

- A push to `main` runs `.github/workflows/build-push.yaml`. It builds the image with the shared
  `docker-build-release` workflow and pushes it to `ghcr.io/yama6a/tagesschau-reader`.
- The `deploy` job then opens a PR in `yama6a/offgrid-private` that sets the new tag in
  `argo_apps/workloads/charts/tagesschau-reader/values.yaml`. Argo CD rolls it out after that PR merges.
- The image is nginx-unprivileged on port 8080, user 101.
- `nginx.conf` holds the Content-Security-Policy. It names every image and media host the API returned.
  A new broadcaster host shows up as a missing image or a video that does not play. Add the host there.

| Secret           | Used by                                                  |
| ---------------- | -------------------------------------------------------- |
| `DEPLOY_TOKEN`   | `deploy` job, to open the PR in `yama6a/offgrid-private` |
| `RENOVATE_TOKEN` | `.github/workflows/renovate.yaml`                        |
