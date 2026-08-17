# cts-ws examples

Worked request/response examples for the `cts_ws` fake, in the same style as `soap-api-strategy-builder-poc`'s `Examples/evidence/` captures - but generated against **this fake service**, using **our own fixture data** (`data/fixtures/cts-animals.json`, `cts-locations.json`, `cts-breed-codes.json`, `cts-unused-ear-tags.json`), not the real CTS.

Each scenario is a numbered sequence:

1. `1-request-sent.xml` — the `Register_Births_Asynchronous`/`Register_Movements_Asynchronous` request
2. `2-response-received.xml` — the `MsgReceipt` returned immediately
3. `3-async-update-request.xml` — the `Get_Register_*_Validation_Results` poll
4. `4-async-update-response.xml` — the final `BirthResults`/`MovResults`, captured after the store's random validation delay had elapsed (poll too soon and you'll get `CTWS806` instead - see `src/server/cts-ws/README.md` → "Submit-now / validate-later")

## Scenarios

- **reg-births-success** — 3 rows, 2 accepted, 1 rejected as `CTWS200` (dam has a recent calving on record)
- **reg-births-failure** — 7 rows, 6 rejected (`CTWS004`, `CTWS014`, `CTWS111`, `CTWS192`, `CTWS180`, `CTWS198`), 1 accepted
- **reg-movements-success** — 3 rows, 2 accepted, 1 rejected as `CTWS336` (duplicate content of row 1)
- **reg-movements-failure** — 6 rows, 5 rejected (`CTWS307`, `CTWS329`, `CTWS320`, `CTWS324`, `CTWS330`), 1 accepted

## Using these for real

The `<data>` element these examples show is **decoded** for readability, matching the evidence convention - it's inlined directly rather than base64. To actually send one of these over the wire (Postman, curl, etc.), base64-encode the inner request element (`RegBirths`/`RegMovs`/`GetResults`, with an `<?xml version="1.0" encoding="utf-8"?>` declaration prepended) into the `<data>` field - see `src/server/cts-ws/xml/soap-envelope.js`'s `encodeDataPayload` for the exact scheme.

Credentials shown are this project's local-dev defaults (`ctsWs.dthUsername`/`dthPassword`/`ctsOlUsername`/`ctsOlPassword` in `src/config/config.js`) - override via the matching `CTS_WS_*` env vars if you've changed them.

Every request also has an independent `ctsWs.serviceUnavailableProbability` (default 5%) chance of returning `CTWS809` instead of the expected response - if a replay doesn't match these examples, that's most likely why; just retry.
