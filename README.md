# lis-fake-service

Fakes upstream data dependencies for LIS local development and CDP's deployed "dev" pre-production environment.

Currently fakes:

- **CTS Web Services** — `POST /cts_ws/DefraDataTransferPublicNWSE.asmx`. See [`src/server/cts-ws/README.md`](src/server/cts-ws/README.md) for the SOAP `TransferDataHex` protocol details.
- **identity-service-helper** — `GET /identity-service-helper/users/{id}/profile`, backed by `data/fixtures/identity-service-helper.json`.

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
│   │   └── helpers/
│   │       ├── errors.js           # onPreResponse catchAll error handler (JSON error responses)
│   │       └── logging/            # pino + ECS format
│   ├── health/                 # GET /health
│   ├── identity-service-helper/  # Fakes the identity-service-helper profile endpoint
│   └── cts-ws/                 # Fakes the CTS SOAP TransferDataHex endpoint — see its own README
```
