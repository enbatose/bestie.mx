import { describe, expect, it } from "vitest";
import {
  blogArticlePublicPath,
  blogArticleShareUrl,
  BLOG_SOCIAL_FOLLOW_LINE,
  normalizeSocialCaption,
  parseBlogArticlePath,
  slugifyBlogTitle,
} from "./blogPaths.js";

describe("blogPaths", () => {
  it("builds national and city paths", () => {
    expect(blogArticlePublicPath({ slug: "hola-mundo" })).toBe("/blog/hola-mundo");
    expect(blogArticlePublicPath({ slug: "hola-mundo", cityCode: "gdl" })).toBe("/blog/gdl/hola-mundo");
  });

  it("parses article paths", () => {
    expect(parseBlogArticlePath("/blog/tips-roomie")).toEqual({ cityCode: null, slug: "tips-roomie" });
    expect(parseBlogArticlePath("/blog/gdl/tips-roomie")).toEqual({
      cityCode: "gdl",
      slug: "tips-roomie",
    });
    expect(parseBlogArticlePath("/blog/gdl")).toBeNull();
  });

  it("slugifies spanish titles", () => {
    expect(slugifyBlogTitle("Cómo encontrar roomie en GDL")).toBe("como-encontrar-roomie-en-gdl");
  });

  it("builds share URLs", () => {
    expect(blogArticleShareUrl({ slug: "tips", origin: "https://www.bestie.mx" })).toBe(
      "https://www.bestie.mx/blog/tips",
    );
    expect(blogArticleShareUrl({ slug: "tips", cityCode: "gdl", origin: "https://www.bestie.mx" })).toBe(
      "https://www.bestie.mx/blog/gdl/tips",
    );
  });

  it("normalizes captions with emojis, follow line, and article URL", () => {
    const url = "https://www.bestie.mx/blog/guia-depa";
    const out = normalizeSocialCaption(
      "🏠 Tip roomie\n\nLee más: BESTIE_URL\nSíguenos: https://www.instagram.com/bestie.mexico/",
      { articleUrl: url },
    );
    expect(out).toContain("🏠 Tip roomie");
    expect(out).toContain(BLOG_SOCIAL_FOLLOW_LINE);
    expect(out.endsWith(url)).toBe(true);
    expect(out).not.toContain("instagram.com");
    expect(out.match(/https?:\/\//g)?.length).toBe(1);
  });
});
