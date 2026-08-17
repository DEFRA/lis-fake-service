# cts-ws

Fakes the CTS Web Services `DefraDataTransferPublicNWSE.asmx` `TransferDataHex` operation — the legacy SOAP protocol `Register_Births_Asynchronous`, `Register_Movements_Asynchronous` and their `Get_Register_*_Validation_Results` poll counterparts are built on. Mounted at `POST /cts_ws/DefraDataTransferPublicNWSE.asmx`.

Unlike the OIDC fakes (see the root README), this isn't fixture-replay of canned responses: submitted rows are validated dynamically against fixture reference data (known animals, holdings, breed codes), so arbitrary content — not just a fixed set of pre-recorded scenarios — gets a real accept/reject outcome.

## Request flow

```
controller.js                  outer TransferDataHex auth, dispatches on `type`
  → operations/index.js        maps `type` → operation module
    → operations/<name>/index.js   handler for that operation
```

Every failure mode is a thrown, typed error (`errors/domain-error.js`, `errors/transport-fault-error.js`, `errors/malformed-request-error.js`) — the plugin's `onPreResponse` extension maps each to its wire response, so handlers stay a straight-line happy path.

## Submit-now / validate-later

`Register_Births_Asynchronous` and `Register_Movements_Asynchronous` don't validate inline. They hand the batch to a `stores/*.js` `Store`:

```
stores/store.js       generic Store(causes, maxDelaySeconds) class
stores/birth.js        birthStore = new Store(birthCauses, 5)
stores/movement.js     movementStore = new Store(movementCauses, 5)
```

`store.submit({ txnId, rows })` stores the batch and returns a receipt number immediately. After a random delay (0–`maxDelaySeconds`, simulating the real CTS async turnaround), the `Store` classifies every row against its `causes` table and caches `{ txnId, accepted, rejected }`. `store.retrieveResults(receiptNum)` returns `undefined` (unknown receipt), `{ ready: false }` (still pending — the `Get_Register_*_Validation_Results` handler turns this into `CTWS806`), or `{ ready: true, results }`.

## Causes tables

`validation/birth.js` and `validation/movement.js` each export a flat array of causes:

```js
{
  code: 'CTWS003',
  desc: 'Missing Ear Tag',
  sev: 'e',
  field: 'Etg',
  validate: (row, rows) => !row.Etg
}
```

`validate(row, rows)` takes the row's attributes and (for causes needing cross-row context, e.g. duplicate-in-file detection) every row in the batch, and returns whether that cause applies. A row can match zero, one, or several causes across different fields at once — matching the real service's observed behaviour of returning multiple simultaneous causes on one rejected row. Causes on the _same_ field are written to be mutually exclusive (e.g. a movement's `Loc` can be malformed, not-found, cancelled, inactive or unsuitable, but only one of those at a time) via guard clauses in each predicate, not by chaining.

`Store` applies a causes table generically — it has no births/movements-specific knowledge. Adding a new causes table and constructing a `Store` with it is enough to back a new operation.

## Fixture data (`data/`)

Each module loads one `data/fixtures/*.json` file and exposes lookup functions — no other module reads fixture JSON directly.

| Module                    | Fixture                    | Provides                                                                                                                                                                               |
| ------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `data/animals.js`         | `cts-animals.json`         | Known animals: ear tag, sex, breed, DOB, current CPH, and (for a few dedicated test dams) `dead_on` / `calving_dates`                                                                  |
| `data/locations.js`       | `cts-locations.json`       | Sparse status overrides (cancelled / inactive-dated / unsuitable / sub-location-requiring) for specific CPHs; any CPH with an animal on it and no override is a normal active location |
| `data/breed-codes.js`     | `cts-breed-codes.json`     | Official GOV.UK cattle breed codes, plus their `X` cross-breed variants                                                                                                                |
| `data/unused-ear-tags.js` | `cts-unused-ear-tags.json` | Ear tags issued to a CPH and not yet used — a new birth's `Etg` must come from this pool for its `BLoc`                                                                                |

## Adding a validation rule

1. Add a `{ code, desc, sev, field, validate }` entry to the relevant `validation/*.js` causes array. Keep `validate` self-guarding so it can't fire together with a mutually-exclusive same-field cause.
2. If it needs reference data you don't have yet, add a fixture under `data/fixtures/` and a loader under `data/`.
3. Add a one-cause-per-test case to that file's `*.test.js`, following the WET arrange/act/assert pattern used throughout.

## Other pieces

- `parsing/` — turns the raw SOAP envelope and each operation's inner XML into plain objects (`fast-xml-parser`-based).
- `xml/` — renders responses (`xml/templates/*.njk`) and the outer `TransferDataHexResponse`/SOAP envelope; `soap-envelope.js` handles the base64 `data` payload encoding.
- `errors/` — typed errors plus the `onPreResponse` extension that maps them to `SystemException`/SOAP fault wire responses.
