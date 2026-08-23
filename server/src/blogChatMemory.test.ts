import { describe, expect, it } from "vitest";
import {
  applyRestoreFrom,
  ensureBaselineRevision,
  nextRevisionNumber,
  snapshotFromDto,
  type BlogChatRevisionSnapshot,
} from "./blogChatMemory.js";
import type { BlogArticleDto } from "./blogDto.js";

function fakeDto(overrides: Partial<BlogArticleDto> = {}): BlogArticleDto {
  return {
    id: "a1",
    slug: "demo",
    title: "Título uno",
    excerpt: "Extracto uno",
    status: "draft",
    cityCode: null,
    cityLabel: null,
    labels: ["roomie"],
    coverImageUrl: null,
    coverImageCredit: null,
    coverImageSource: null,
    blocks: [{ id: "b1", type: "paragraph", text: "Cuerpo uno" }],
    sources: [],
    qualityScore: 80,
    qualitySuggestions: [],
    qualityStrengths: [],
    similarityWarnings: [],
    viewCount: 0,
    metaTitle: "Meta uno",
    metaDescription: "Desc uno",
    aeoSummary: "AEO uno",
    faq: [],
    socialCaption: "Caption uno",
    publishedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    path: "/blog/demo",
    ctaPath: "/",
    ...overrides,
  };
}

describe("blogChatMemory", () => {
  it("creates baseline revision 1 when empty", () => {
    const dto = fakeDto();
    const mem = ensureBaselineRevision({ history: [], revisions: [] }, dto, "2026-01-02T00:00:00.000Z");
    expect(mem.revisions).toHaveLength(1);
    expect(mem.revisions[0]?.revision).toBe(1);
    expect(mem.revisions[0]?.title).toBe("Título uno");
  });

  it("increments revision numbers", () => {
    expect(nextRevisionNumber([])).toBe(1);
    expect(nextRevisionNumber([{ revision: 1 } as BlogChatRevisionSnapshot, { revision: 3 } as BlogChatRevisionSnapshot])).toBe(4);
  });

  it("restores mixed fields from different revisions", () => {
    const v1 = snapshotFromDto(fakeDto({ title: "V1", blocks: [{ id: "1", type: "paragraph", text: "A" }] }), 1, "t1");
    const v2 = snapshotFromDto(fakeDto({ title: "V2", blocks: [{ id: "2", type: "paragraph", text: "B" }] }), 2, "t2");
    const patch = applyRestoreFrom(fakeDto({ title: "Live" }), [v1, v2], { blocks: 1, title: 2 });
    expect(patch.title).toBe("V2");
    expect(patch.blocks?.[0]?.text).toBe("A");
  });

  it("restoreFrom.all fills every content field", () => {
    const v1 = snapshotFromDto(fakeDto({ title: "Full", excerpt: "Ex" }), 1, "t1");
    const patch = applyRestoreFrom(fakeDto({ title: "Live" }), [v1], { all: 1 });
    expect(patch.title).toBe("Full");
    expect(patch.excerpt).toBe("Ex");
    expect(patch.blocks).toHaveLength(1);
  });
});
