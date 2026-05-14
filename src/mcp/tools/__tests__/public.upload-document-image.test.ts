import { beforeEach, describe, expect, it, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

vi.mock("@/services/research-project.service", () => ({}));
vi.mock("@/services/research-question.service", () => ({}));
vi.mock("@/services/activity.service", () => ({}));
vi.mock("@/services/comment.service", () => ({}));
vi.mock("@/services/assignment.service", () => ({}));
vi.mock("@/services/notification.service", () => ({}));
vi.mock("@/services/project-group.service", () => ({}));
vi.mock("@/services/mention.service", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/event-bus", () => ({ eventBus: { emitChange: vi.fn() } }));

const mockGetDocumentByUuid = vi.hoisted(() => vi.fn());
vi.mock("@/services/document.service", () => ({
  getDocumentByUuid: mockGetDocumentByUuid,
}));

const mockGetOrCreateExperimentReportDocumentForUpload = vi.hoisted(() => vi.fn());
vi.mock("@/services/experiment.service", () => ({
  getOrCreateExperimentReportDocumentForUpload: mockGetOrCreateExperimentReportDocumentForUpload,
}));

const mockWriteDocumentImage = vi.hoisted(() => vi.fn());
vi.mock("@/services/document-image.service", () => ({
  DOCUMENT_IMAGE_ALLOWED_MIME: new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"]),
  writeDocumentImage: mockWriteDocumentImage,
}));

import { registerPublicTools } from "@/mcp/tools/public";

type ToolHandler = (input: Record<string, unknown>) => Promise<{
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}>;

function makeServer() {
  const tools = new Map<string, ToolHandler>();
  const server = {
    registerTool: vi.fn((name: string, _config: unknown, handler: ToolHandler) => {
      tools.set(name, handler);
    }),
  } as unknown as McpServer;

  return { server, tools };
}

describe("synapse_upload_document_image", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDocumentByUuid.mockResolvedValue({ uuid: "doc-existing" });
    mockGetOrCreateExperimentReportDocumentForUpload.mockResolvedValue({
      uuid: "doc-from-exp",
      title: "Experiment Result · Run",
      version: 1,
    });
    mockWriteDocumentImage.mockResolvedValue({
      filename: "stored-metrics.png",
      size: 12,
      mimeType: "image/png",
      url: "/api/documents/doc-from-exp/images/stored-metrics.png",
    });
  });

  it("uploads by experimentUuid and returns the created or reused document UUID", async () => {
    const { server, tools } = makeServer();
    registerPublicTools(server, {
      type: "agent",
      companyUuid: "company-1",
      actorUuid: "agent-1",
      ownerUuid: "user-1",
      roles: ["experiment"],
      agentName: "Experiment Agent",
    });

    const result = await tools.get("synapse_upload_document_image")?.({
      experimentUuid: "exp-1",
      filename: "metrics.png",
      mimeType: "image/png",
      base64Content: Buffer.from("image-bytes").toString("base64"),
    });

    expect(result?.isError).toBeUndefined();
    expect(mockGetOrCreateExperimentReportDocumentForUpload).toHaveBeenCalledWith({
      companyUuid: "company-1",
      actorType: "agent",
      actorUuid: "agent-1",
      ownerUuid: "user-1",
      experimentUuid: "exp-1",
    });
    expect(mockWriteDocumentImage).toHaveBeenCalledWith(
      expect.objectContaining({
        companyUuid: "company-1",
        documentUuid: "doc-from-exp",
        originalName: "metrics.png",
        mimeType: "image/png",
      }),
    );
    expect(JSON.parse(result?.content[0]?.text ?? "{}")).toMatchObject({
      documentUuid: "doc-from-exp",
      url: "/api/documents/doc-from-exp/images/stored-metrics.png",
    });
  });

  it("requires exactly one of documentUuid or experimentUuid", async () => {
    const { server, tools } = makeServer();
    registerPublicTools(server, {
      type: "agent",
      companyUuid: "company-1",
      actorUuid: "agent-1",
      roles: ["experiment"],
      agentName: "Experiment Agent",
    });

    const missing = await tools.get("synapse_upload_document_image")?.({
      filename: "metrics.png",
      mimeType: "image/png",
      base64Content: "aW1hZ2U=",
    });
    const both = await tools.get("synapse_upload_document_image")?.({
      documentUuid: "doc-1",
      experimentUuid: "exp-1",
      filename: "metrics.png",
      mimeType: "image/png",
      base64Content: "aW1hZ2U=",
    });

    expect(missing?.isError).toBe(true);
    expect(both?.isError).toBe(true);
    expect(missing?.content[0]?.text).toContain("exactly one");
    expect(both?.content[0]?.text).toContain("exactly one");
    expect(mockWriteDocumentImage).not.toHaveBeenCalled();
  });
});
