# lis-fake-service

Fakes upstream data dependencies for LIS local development and CDP's deployed "dev" pre-production environment.

Currently fakes:

- **CTS Web Services** — `POST /cts_ws/DefraDataTransferPublicNWSE.asmx`. See [`src/server/cts-ws/README.md`](src/server/cts-ws/README.md) for the SOAP `TransferDataHex` protocol details.
- **cads-data-service** — bovine animal endpoints under `/cads`. Mapped from the shared canonical animal set (`data/fixtures/animals/*.json`) that the CTS fake also uses, with the extra detail CADS holds. Require a valid `Authorization: Basic base64(clientId:secret)` header, matching the real service's ApiKeyOrCognito Basic-scheme auth policy (`CADS_CLIENT_ID`/`CADS_CLIENT_SECRET`, defaults `local-dev-cads-client`/`local-dev-cads-secret`).
  - `GET /cads/api/v1/bovine/animals/{identifier}` — animal details (LANI-932), in cads-data-service's `AnimalDetailsDto` shape. The identifier is trimmed, then rejected with 400 if it is over 20 characters or not letters, digits and spaces. Error bodies mirror the real service: an empty 401, ASP.NET's bare ProblemDetails for 404, and its `Validation errors` body (errors keyed by an empty property name) for an invalid identifier. One fixture carries a `SurrogateDam` parentage entry, which the real service does not return yet.
  - `GET /cads/api/v1/bovine/animals?CPH={cph}` — animals on a holding (LANI-803), in cads-data-service's `AnimalCollectionDto` shape (matching the real, not-yet-merged `feature/lani-803` branch). Supports `holdingAssociation` (`MovedOnHolding` default, or `RegisteredOnHolding`), `status`/`breedCode` filters (repeatable) and a single `sex` filter, `dateOnCPHFrom`, free-text search (`q`), sorting (`orderBy`/`direction`, case-insensitive against `Identifier`/`BirthDate`/`DateOnCPH`/`Sex`/`BreedCode`, always tie-broken by ear tag ascending) and paging (`page`/`pageSize`, defaulting to 1/25).
- **keeper-data-api** (krds, not yet built) — holding detail under `/krds`, standing in for the proposed keeper-data-api V2 contract. Requires a valid `Authorization: Basic base64(clientId:secret)` header, standing in for the real service's Bearer-or-Basic auth policy (`KRDS_CLIENT_ID`/`KRDS_CLIENT_SECRET`, defaults `local-dev-krds-client`/`local-dev-krds-secret`).
  - `GET /krds/api/v2/holdings/{county}/{parish}/{holding}` — holding detail by CPH, read from `data/fixtures/locations/`. Returns 400 with field-level errors when a segment fails its format (`county` 2 digits, `parish` 3 digits, `holding` 4 digits), 404 when the CPH isn't in the fixture.

`data/fixtures/locations/` (one file per CPH, `{county}_{parish}_{holding}.json`) is the shared canonical holding data - a superset of what each fake needs, the same pattern as `data/fixtures/animals/`: cts-ws reads movement-suitability status / inactive date range / sub-location detail, cads uses CPH recognition, and krds reads the full holding detail and derives a keeper's name and CPH/role assignments from each holding's `associations`.

### Fixtures from env vars

On top of the baked-in files, each fixture set can be upserted from an optional env var holding a JSON array, either raw or base64-encoded for us. This lets a deployed fake gain or override records without a rebuild:

| Env var          | Upserts over               | Keyed by         |
| ---------------- | -------------------------- | ---------------- |
| `FAKE_ANIMALS`   | `data/fixtures/animals/`   | `earTag`         |
| `FAKE_LOCATIONS` | `data/fixtures/locations/` | `identifier`     |
| `FAKE_PEOPLE`    | `data/fixtures/people/`    | `customerNumber` |

- When an env record's key matches a file record, it **replaces the whole record**. Fields are not merged. A new key adds a record. There is no way to delete a record.
- People are loaded before locations, so env locations can reference people from the files or from `FAKE_PEOPLE`.
- At startup the service logs how many records each var upserted and its size. A var that isn't a JSON array, or a record without its key, fails startup with an error naming the var.

```bash
FAKE_ANIMALS="$(jq -c -s . my-animals/*.json | base64)" npm run dev
```

**Size limits:** a minified animal is about 300 B and a location about 600 B. Linux caps a single env var at 128 KiB. On CDP/ECS, the whole task definition, including all env vars, must fit in about 64 KiB, so in practice you have room for about a hundred extra records in total. Bulk test data belongs in `data/fixtures/`.

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
│   │   ├── data/breeds.js          # GOV.UK cattle breed codes + names (from @defra/lis-species-cattle), shared by cts-ws and cads
│   │   ├── data/fixtures.js        # Reads data/fixtures/<folder>/*.json and upserts FAKE_* env var records over them
│   │   ├── data/locations.js       # Holding registry — id, status, sub-locations (data/fixtures/locations.json), shared by cts-ws, cads and krds
│   │   └── helpers/
│   │       ├── errors.js           # onPreResponse catchAll error handler (JSON error responses)
│   │       └── logging/            # pino + ECS format
│   ├── health/                 # GET /health
│   ├── cts-ws/                 # Fakes the CTS SOAP TransferDataHex endpoint — see its own README
│   └── cads/                   # Fakes the cads-data-service bovine animal endpoints (/cads)
```
