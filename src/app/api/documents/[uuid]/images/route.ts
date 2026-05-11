import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { withErrorHandler } from "@/lib/api-handler";
import { errors, success } from "@/lib/api-response";
import { getAuthContext, isUser } from "@/lib/auth";
import { getDocumentByUuid } from "@/services/document.service";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB per image
const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
]);

function sanitizeFileName(name: string) {
  // Strip path separators and anything weird; keep latin/digits/._-
  return name
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/^\.+/, "")
    .slice(0, 120);
}

function extFromMime(mime: string): string {
  switch (mime) {
    case "image/png": return ".png";
    case "image/jpeg": return ".jpg";
    case "image/gif": return ".gif";
    case "image/webp": return ".webp";
    case "image/svg+xml": return ".svg";
    default: return "";
  }
}

export const POST = withErrorHandler(
  async (request: NextRequest, context: { params: Promise<{ uuid: string }> }) => {
    const auth = await getAuthContext(request);
    if (!auth) return errors.unauthorized();
    if (!isUser(auth)) return errors.forbidden("Only users can upload document images");

    const { uuid: documentUuid } = await context.params;
    const doc = await getDocumentByUuid(auth.companyUuid, documentUuid);
    if (!doc) return errors.notFound("Document");

    const formData = await request.formData();
    const fileEntry = formData.get("file");
    if (!(fileEntry instanceof File)) {
      return errors.validationError({ file: "file field must be a File" });
    }
    const file = fileEntry;

    if (file.size === 0) {
      return errors.validationError({ file: "file is empty" });
    }
    if (file.size > MAX_BYTES) {
      return errors.validationError({ file: `file exceeds ${MAX_BYTES / (1024 * 1024)} MB limit` });
    }
    const mime = file.type || "application/octet-stream";
    if (!ALLOWED_MIME.has(mime)) {
      return errors.validationError({ file: `unsupported content type: ${mime}` });
    }

    // Build disk path under ~/.synapse/uploads/documents/<companyUuid>/<docUuid>/
    const dir = path.join(
      homedir(),
      ".synapse",
      "uploads",
      "documents",
      auth.companyUuid,
      documentUuid,
    );
    await mkdir(dir, { recursive: true });

    const providedName = sanitizeFileName(file.name || "image");
    const baseName = providedName || `image${extFromMime(mime)}`;
    const storedName = `${randomUUID()}-${baseName}`;
    const storedPath = path.join(dir, storedName);

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(storedPath, buffer);

    return success({
      filename: storedName,
      size: file.size,
      mimeType: mime,
      url: `/api/documents/${documentUuid}/images/${encodeURIComponent(storedName)}`,
    });
  },
);
