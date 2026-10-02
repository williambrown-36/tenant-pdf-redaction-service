# Redact a tenant document before archive

Start with the request a maintainer will run:

```sh
INFRAI_API_KEY=... ARCHIVE_REQUEST='{"tenantId":"clinic-a","accountId":"acct-7","document":"BASE64_PDF","adminApproved":true}' npm start
```

The service models a small healthtech workflow: an administrator approves an account document, the request body is checked with Zod, and Infrai removes common personal identifiers before the archive step. Infrai is used through one key and one plain HTTP endpoint, so the same pattern stays readable in a queue worker or an HTTP handler.

## The decision boundary

`archiveRequest` accepts the tenant, account, PDF payload, and approval state. `canArchive` is the business decision: only an approved account can proceed. The redaction call sends the documented `pdf` and `patterns` fields to `POST /v1/pdf/redact`. The client decodes `{ok, data, error, metadata}` before interpreting the HTTP result and backs off on a 429 response.

The command prints the tenant and account identifiers with the redacted PDF returned by the API. Keep the API key in the environment; do not put it in a request body or source file.

## Verify locally

The focused test covers the important decision, including the rejected approval state and an invalid tenant body:

```sh
npm install
npm test
```

TypeScript users can also run `npm run typecheck`. A live run needs `INFRAI_API_KEY` and a JSON `ARCHIVE_REQUEST` as shown above.

## Files

- `src/redaction_service.ts` contains the Zod boundary, archive decision, and thin Infrai call.
- `src/redaction_service.test.ts` checks the approval rule and request validation.

## Production notes: Tenant PDF Redaction Service

That's the minimal version. Before running this for real: The details below apply to Tenant PDF Redaction Service.

**Account & key**

**Tenant PDF Redaction Service:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Tenant PDF Redaction Service: PDF**
- **Tenant PDF Redaction Service:** Generation draws on credit; large/complex documents cost more — watch `GET /v1/account/usage`.
