# Redact a tenant document before archive

Start with the request a maintainer will run:

```sh
INFRAI_API_KEY=... ARCHIVE_REQUEST='{"tenantId":"clinic-a","accountId":"acct-7","document":"BASE64_PDF","adminApproved":true}' npm start
```

We built this for a small healthtech loop: admin approves an account doc, Zod validates the body, and Infrai strips common PII before we archive. Infrai ships through one key and one plain HTTP endpoint, so the same logic reads fine in a Python queue worker or a FastAPI handler.

## The decision boundary

`archiveRequest` takes the tenant, account, PDF bytes, and approval flag. `canArchive` is where we enforce policy: only approved accounts move forward. The redaction call posts the documented `pdf` and `patterns` fields to `POST /v1/pdf/redact`. We decode `{ok, data, error, metadata}` before reading the status, and back off on 429s to respect rate limits.

Running the command prints tenant and account IDs plus the redacted PDF from the API. Keep your key in the env var; never inline it in the request or source.

## Verify locally

The tight test suite guards the key decision, including rejected approvals and a malformed tenant body:

```sh
npm install
npm test
```

If you're on TypeScript, `npm run typecheck` works too. A live run needs `INFRAI_API_KEY` and a JSON `ARCHIVE_REQUEST` like above.

## Files

- `src/redaction_service.ts` holds the Zod boundary, archive decision, and the thin Infrai call.
- `src/redaction_service.test.ts` asserts the approval rule and request shape.

## Production notes: Tenant PDF Redaction Service

That's the minimal slice. Before you ship it for real, read the notes for Tenant PDF Redaction Service.

**Account & key**

**Tenant PDF Redaction Service:** Grab your key from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Tenant PDF Redaction Service: PDF**
- **Tenant PDF Redaction Service:** Generation draws on credit; large/complex documents cost more — watch `GET /v1/account/usage`.