import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { errors } from "@/lib/api-response";
import { getAuthContext } from "@/lib/auth";
import { getDocumentByUuid } from "@/services/document.service";

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

// Basic traversal guard: reject anything that tries to escape the scoped dir.
function isSafeName(name: string): boolean {
  return !!name && !name.includes("/") && !name.includes("\\") && !name.includes("..") && name.length <= 256;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ uuid: string; filename: string }> },
) {
  const auth = await getAuthContext(request);
  if (!auth) return errors.unauthorized();

  const { uuid: documentUuid, filename: rawName } = await context.params;
  const filename = decodeURIComponent(rawName);
  if (!isSafeName(filename)) {
    return errors.notFound("Image");
  }

  const doc = await getDocumentByUuid(auth.companyUuid, documentUuid);
  if (!doc) return errors.notFound("Image");

  const filePath = path.join(
    homedir(),
    ".synapse",
    "uploads",
    "documents",
    auth.companyUuid,
    documentUuid,
    filename,
  );

  let fileStat;
  try {
    fileStat = await stat(filePath);
  } catch {
    return errors.notFound("Image");
  }
  if (!fileStat.isFile()) return errors.notFound("Image");

  const ext = path.extname(filename).toLowerCase();
  const mime = MIME_BY_EXT[ext] ?? "application/octet-stream";

  // Node stream → web ReadableStream
  const nodeStream = createReadStream(filePath);
  const webStream = new ReadableStream<Uint8Array>({
    start(controller) {
      nodeStream.on("data", (chunk) => controller.enqueue(chunk as Uint8Array));
      nodeStream.on("end", () => controller.close());
      nodeStream.on("error", (err) => controller.error(err));
    },
    cancel() {
      nodeStream.destroy();
    },
  });

  return new Response(webStream, {
    status: 200,
    headers: {
      "Content-Type": mime,
      "Content-Length": String(fileStat.size),
      "Cache-Control": "private, max-age=3600",
    },
  });
}
