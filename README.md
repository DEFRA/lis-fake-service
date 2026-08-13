# lis-fake-service

Fakes upstream identity/data dependencies for LIS local development and CDP's deployed "dev" pre-production environment. One app, one endpoint per faked service.

Currently fakes:

- **DEFRA CI** — mounted at `/defra-ci`
- **Entra ID** — mounted at `/entra-id`

Each is a self-contained OIDC provider (discovery document, JWKS, authorize, token) backed by a static `data/fixtures/*.json` user fixture — no external calls, no live upstream coupling.

**Stack:** Hapi · GOV.UK Frontend · Nunjucks · hapi-pino · Vite

---

## Running locally

```bash
npm install
npm run dev        # starts vite build --watch + nodemon
```

App available at `http://localhost:3000`.

```bash
npm test           # build frontend, run vitest with coverage
npm run lint       # eslint + stylelint
```

---

## Project structure

```
src/
├── config/
│   ├── config.js               # Convict config — all env vars defined here, including oidcFakes.*
│   └── nunjucks/
│       ├── nunjucks.js         # @hapi/vision plugin wiring up Nunjucks
│       └── context/context.js  # Global template variables (assetPath, serviceName, getAssetPath)
├── server/
│   ├── server.js               # Hapi server bootstrap and plugin registration
│   ├── router.js               # Top-level router plugin — registers feature plugins
│   ├── common/
│   │   ├── constants/status-codes.js
│   │   ├── helpers/
│   │   │   ├── errors.js           # onPreResponse catchAll error handler
│   │   │   ├── serve-static-files.js
│   │   │   └── logging/            # pino + ECS format
│   │   ├── templates/layouts/      # page-base.njk (GOV.UK template), page.njk
│   │   └── components/heading/     # Custom appHeading macro
│   ├── home/                   # Lists the available faked services
│   ├── health/                 # GET /health
│   ├── oidc-fake/              # Shared OIDC-provider plugin factory + login template
│   ├── entra-id/               # Entra ID fake — instantiates oidc-fake at /entra-id
│   └── defra-ci/               # DEFRA CI fake — instantiates oidc-fake at /defra-ci
└── client/
    ├── javascripts/application.js  # GOV.UK Frontend JS entrypoint
    └── stylesheets/application.scss
```

## OIDC fake plugin

`server/oidc-fake/create-oidc-fake-plugin.js` exports a factory used by both `entra-id` and `defra-ci`:

```js
createOidcFakePlugin({
  name,
  label,
  mountPath,
  fixturePath,
  getExternalBase,
  getInternalBase
})
```

It generates an RSA keypair at startup and serves:

- `GET {mountPath}/.well-known/openid-configuration`
- `GET {mountPath}/jwks`
- `GET {mountPath}/authorize` / `POST {mountPath}/authorize` — renders a user picker sourced from the fixture, issues an authorization code on submit
- `POST {mountPath}/token` — redeems the code (with PKCE verification) for a signed `id_token`/`access_token`

Auth codes are held in an in-memory `Map` with a 10-minute TTL — no session/cookie machinery is used.

To fake a new upstream service, add a fixture under `data/fixtures/`, instantiate the factory in a new `src/server/<name>/index.js`, and register it in `router.js`.
