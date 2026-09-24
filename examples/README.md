# examples

Runnable requests for this fake service as `.http` files, for the JetBrains HTTP
Client (IntelliJ / WebStorm — bundled; VS Code's "REST Client" extension reads
the same format). Open a file, click the ▶ in the gutter next to a request, and
it runs _the current file contents_ — edit a URL, header, body or pre-request
script and re-run, no import step. Responses show in a tool window and are kept
under `.idea/httpRequests/`.

There's one environment, `local`, in `http-client.env.json` — pick it in the run
dialog or the environment dropdown. `baseUrl` defaults to
`http://fake-service.lis.defra:3000` (the `/etc/hosts` alias the lis-dev setup
adds); use `http://localhost:3000` if you haven't run that setup. If `fake/idp`
is also on `3000`, this service moves to `3001` — update `baseUrl`.

Start the service first: `npm run dev`.

| File                           | Covers                                                                                                                |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `health.http`                  | `GET /health`                                                                                                         |
| `cads.http`                    | `/cads/api/v1/bovine/animals/...` — details, on-holding, paging, every error case (needs `x-api-key: {{cadsApiKey}}`) |
| `identity-service-helper.http` | `GET /identity-service-helper/users/{id}/profile` — 3 users + 404 + header errors                                     |
| `cts-ws-reg-births.http`       | `Register_Births_Asynchronous` submit + poll, success and failure scenarios                                           |
| `cts-ws-reg-movements.http`    | `Register_Movements_Asynchronous` submit + poll, success and failure scenarios                                        |

## identity-service-helper `{id}`

`{id}` is the OIDC `sub`. It's the value the IdP fake issues for the address
(`fake/idp/data/fixtures/defra-ci.json`), stored alongside each record in
`data/fixtures/users.json` so the two fakes stay aligned. The `*Sub` env vars
mirror it:

| email                                 | sub                                    |
| ------------------------------------- | -------------------------------------- |
| `defralivestock+noholdings@gmail.com` | `e8e9a3d2-d9ba-4c49-b293-09288434c748` |
| `defralivestock+oakfield@gmail.com`   | `3a6f0e9b-fc47-4537-b904-8b98a88a67fe` |
| `defralivestock+fairfield@gmail.com`  | `ca73c5f5-2b5e-4944-ac6a-dcc979e6ed10` |

## cts-ws

The SOAP `<data>` element carries the inner request base64-encoded (an XML
declaration prepended). Each request builds it in a `< {% … %}` pre-request
script from a readable string and sets it as `{{data}}` — so you edit plain XML,
not base64. `btoa` needs IntelliJ HTTP Client 2023.2+.

Flow per scenario: run a **submit** → it returns `<MsgReceipt><Receipt Num="N"/>`
→ put `N` in the matching **poll**'s `<Receipt Num>` and run it. Polling before
the store's random validation delay elapses returns `CTWS806`. Every request also
has a ~5% chance of `CTWS809` (service unavailable) — just resend.

The response is a SOAP envelope with the result base64-encoded in
`<TransferDataHexResult>`. Each request has a `> {% … %}` response handler that
decodes it and prints the XML to the response console (`atob`, 2023.2+).
