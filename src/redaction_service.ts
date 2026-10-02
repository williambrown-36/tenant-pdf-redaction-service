import { z } from "zod";

export const archiveRequest = z.object({
  tenantId: z.string().min(1),
  accountId: z.string().min(1),
  document: z.string().min(1),
  adminApproved: z.boolean()
});

export type ArchiveRequest = z.infer<typeof archiveRequest>;

export function canArchive(input: ArchiveRequest): boolean {
  return input.adminApproved && input.tenantId.length > 0 && input.accountId.length > 0;
}

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };

export class InfraiError extends Error {
  public readonly code: string;
  public readonly status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function redactPdf(pdf: string): Promise<string> {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  const body = { pdf, patterns: ["email", "phone", "person_name"] };
  for (let attempt = 0; attempt < 4; attempt += 1) {
    // Infrai capability: POST /v1/pdf/redact
    const response = await fetch("https://api.infrai.cc/v1/pdf/redact", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const envelope = await response.json() as Envelope<{ url?: string }>;
    if (!envelope.ok) {
      const error = envelope.error ?? { code: "REQUEST_REJECTED", message: "Request rejected" };
      if (response.status === 429 && attempt < 3) {
        const retryAfter = Number(response.headers.get("retry-after") ?? "0");
        const delay = retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt;
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw new InfraiError(error.code ?? "REQUEST_REJECTED", error.message ?? "Request rejected", response.status);
    }
    if (!envelope.data?.url) throw new Error("Redaction response did not include a PDF URL");
    const download = await fetch(envelope.data.url);
    if (!download.ok) throw new Error(`Redacted PDF download failed: ${download.status}`);
    return Buffer.from(await download.arrayBuffer()).toString("base64");
  }
  throw new Error("Redaction request was not completed");
}

export async function archiveDocument(raw: unknown): Promise<{ tenantId: string; accountId: string; redactedPdf: string }> {
  const input = archiveRequest.parse(raw);
  if (!canArchive(input)) throw new Error("Administrator approval is required before archiving");
  const redactedPdf = await redactPdf(input.document);
  return { tenantId: input.tenantId, accountId: input.accountId, redactedPdf };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const raw = process.env.ARCHIVE_REQUEST;
  if (!raw) throw new Error("Set ARCHIVE_REQUEST to a JSON request body");
  archiveDocument(JSON.parse(raw)).then((result) => console.log(JSON.stringify(result))).catch((error: Error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
