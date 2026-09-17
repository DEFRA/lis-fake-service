# lis-fake-service

Fakes upstream data dependencies for LIS local development and CDP's deployed "dev" pre-production environment.

Currently fakes:

- **CTS Web Services** — `POST /cts_ws/DefraDataTransferPublicNWSE.asmx`. See [`src/server/cts-ws/README.md`](src/server/cts-ws/README.md) for the SOAP `TransferDataHex` protocol details.
- **identity-service-helper** — `GET /identity-service-helper/users/{id}/profile`, expanded from `data/fixtures/users.json` (identity: `sub`/`email`/`active` only) into the full `UserProfile` shape; name and CPH/role assignments are derived from the matching keeper association(s) in `data/fixtures/locations/`.
- **cads-data-service** — bovine animal endpoints under `/cads`. Mapped from the shared canonical animal set (`data/fixtures/animals/*.json`) that the CTS fake also uses, with the extra detail CADS holds. Require a valid `Authorization: Basic base64(clientId:secret)` header, matching the real service's ApiKeyOrCognito Basic-scheme auth policy (`CADS_CLIENT_ID`/`CADS_CLIENT_SECRET`, defaults `local-dev-cads-client`/`local-dev-cads-secret`).
  - `GET /cads/api/v1/bovine/animals/{identifier}` — animal details (LANI-802)
  - `GET /cads/api/v1/bovine/animals?CPH={cph}` — animals on a holding (LANI-803), in cads-data-service's `AnimalCollectionDto` shape (matching the real, not-yet-merged `feature/lani-803` branch). Supports `holdingAssociation` (`MovedOnHolding` default, or `RegisteredOnHolding`), `status`/`breedCode` filters (repeatable) and a single `sex` filter, `dateOnCPHFrom`, free-text search (`q`), sorting (`order-by`/`direction`, case-insensitive against `Identifier`/`BirthDate`/`DateOnCPH`/`Sex`/`BreedCode`, always tie-broken by ear tag ascending) and paging (`page`/`page-size`, defaulting to 1/25).
- **keeper-data-api** (krds, not yet built) — holding detail under `/krds`, standing in for the proposed keeper-data-api V2 contract. Requires a valid `Authorization: Basic base64(clientId:secret)` header, standing in for the real service's Bearer-or-Basic auth policy (`KRDS_CLIENT_ID`/`KRDS_CLIENT_SECRET`, defaults `local-dev-krds-client`/`local-dev-krds-secret`).
  - `GET /krds/api/v2/holdings/{county}/{parish}/{holding}` — holding detail by CPH, read from `data/fixtures/locations/`. Returns 400 with field-level errors when a segment fails its format (`county` 2 digits, `parish` 3 digits, `holding` 4 digits), 404 when the CPH isn't in the fixture.

`data/fixtures/locations/` (one file per CPH, `{county}_{parish}_{holding}.json`) is the shared canonical holding data - a superset of what each fake needs, the same pattern as `data/fixtures/animals/`: cts-ws reads movement-suitability status / inactive date range / sub-location detail, cads and identity-service-helper use CPH recognition, identity-service-helper also derives a keeper's name and CPH/role assignments from each holding's `associations`, and krds reads the full holding detail.

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
