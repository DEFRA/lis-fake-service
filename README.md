# lis-fake-service

Fakes upstream data dependencies for LIS local development and CDP's deployed "dev" pre-production environment.

Currently fakes:

- **CTS Web Services** — `POST /cts_ws/DefraDataTransferPublicNWSE.asmx`. See [`src/server/cts-ws/README.md`](src/server/cts-ws/README.md) for the SOAP `TransferDataHex` protocol details.
- **identity-service-helper** — `GET /identity-service-helper/users/{id}/profile`, expanded from `data/fixtures/users.json` (minimal identity + `{ cph, role }` list) into the full `UserProfile` shape; each holding's id comes from the shared `data/fixtures/locations.json`.
- **cads-data-service** — bovine animal endpoints under `/cads`. Mapped from the shared canonical animal set (`data/fixtures/animals/*.json`) that the CTS fake also uses, with the extra detail CADS holds. Require a valid `x-api-key` header (`CADS_API_KEY`, default `local-dev-cads-key`).
  - `GET /cads/api/v1/bovine/animals/{identifier}` — animal details (LANI-802)
  - `GET /cads/api/v1/bovine/animals?CPH={cph}` — animals on a holding (LANI-803), in cads-data-service's `PaginatedResult<T>` shape. Supports `page` (default 1) and `pageSize` (default 10). Sorting (`order`/`sort`), free-text search and `holdingAssociation` filtering are not yet implemented.

OIDC identity provider fakes (DEFRA CI, Entra ID) live in the separate [`lis-fake-idp`](https://github.com/DEFRA/lis-fake-idp) repo, so OIDC auth flows work against a proper CDP frontend-tier service.

**Stack:** Hapi · hapi-pino · Nunjucks (XML response templating for cts-ws)

---

## Running locally

```bash
npm install
npm run dev
```

App available at `http://localhost:3000`.

```bash
npm test           # vitest with coverage
npm run lint       # eslint
```

---

## Project structure

```
src/
├── config/
│   └── config.js               # Convict config — all env vars defined here
├── server/
│   ├── server.js               # Hapi server bootstrap and plugin registration
│   ├── router.js               # Top-level router plugin — registers feature plugins
│   ├── common/
│   │   ├── constants/status-codes.js
│   │   ├── data/animals.js         # Canonical animal test data loader (data/fixtures/animals/*.json), shared by cts-ws and cads
│   │   ├── data/breeds.js          # GOV.UK cattle breed codes + names (data/fixtures/breed-names.json), shared by cts-ws and cads
│   │   ├── data/locations.js       # Holding registry — id, status, sub-locations (data/fixtures/locations.json), shared by cts-ws, cads and identity-service-helper
│   │   ├── data/users.js           # Minimal user records (data/fixtures/users.json), expanded to a UserProfile by identity-service-helper
│   │   └── helpers/
│   │       ├── errors.js           # onPreResponse catchAll error handler (JSON error responses)
│   │       └── logging/            # pino + ECS format
│   ├── health/                 # GET /health
│   ├── identity-service-helper/  # Fakes the identity-service-helper profile endpoint
│   ├── cts-ws/                 # Fakes the CTS SOAP TransferDataHex endpoint — see its own README
│   └── cads/                   # Fakes the cads-data-service bovine animal endpoints (/cads)
```
