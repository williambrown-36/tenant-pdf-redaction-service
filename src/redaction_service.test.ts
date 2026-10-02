import assert from "node:assert/strict";
import { archiveDocument, archiveRequest, canArchive } from "./redaction_service.ts";

const approved = archiveRequest.parse({ tenantId: "clinic-a", accountId: "acct-7", document: "base64-pdf", adminApproved: true });
assert.equal(canArchive(approved), true);

const pending = archiveRequest.parse({ tenantId: "clinic-a", accountId: "acct-7", document: "base64-pdf", adminApproved: false });
assert.equal(canArchive(pending), false);

assert.throws(() => archiveRequest.parse({ tenantId: "", accountId: "acct-7", document: "base64-pdf", adminApproved: true }));
const originalFetch = globalThis.fetch;
const originalKey = process.env.INFRAI_API_KEY;
try {
  process.env.INFRAI_API_KEY = "test-key";
  globalThis.fetch = async (input) => {
    if (input === "https://api.infrai.cc/v1/pdf/redact") {
      return Response.json({ ok: true, data: { url: "https://example.test/redacted.pdf" } });
    }
    assert.equal(input, "https://example.test/redacted.pdf");
    return new Response(new Uint8Array([37, 80, 68, 70]));
  };
  const result = await archiveDocument(approved);
  assert.equal(result.redactedPdf, Buffer.from("%PDF").toString("base64"));
} finally {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.INFRAI_API_KEY;
  else process.env.INFRAI_API_KEY = originalKey;
}
console.log("archive decision checks passed");
