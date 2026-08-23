import { describe, expect, it } from "vitest";
import { blogArticlePublicPath, parseBlogArticlePath, slugifyBlogTitle } from "./blogPaths.js";

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
});
