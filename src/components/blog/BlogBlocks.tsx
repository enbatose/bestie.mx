import { Link } from "react-router-dom";
import type { BlogBlock } from "@/lib/blogApi";

export function BlogBlocks({ blocks }: { blocks: BlogBlock[] }) {
  return (
    <div className="space-y-5">
      {blocks.map((block) => {
        if (block.type === "heading") {
          const className = "pt-3 font-bold text-primary";
          return block.level === 3 ? (
            <h3 key={block.id} className={`${className} text-lg`}>{block.text}</h3>
          ) : (
            <h2 key={block.id} className={`${className} text-xl`}>{block.text}</h2>
          );
        }
        if (block.type === "paragraph") {
          return <p key={block.id} className="text-base leading-7 text-body">{block.text}</p>;
        }
        if (block.type === "image") {
          return (
            <figure key={block.id} className="space-y-2">
              {block.imageUrl ? (
                <img src={block.imageUrl} alt={block.imageAlt ?? ""} className="w-full rounded-2xl object-cover" loading="lazy" />
              ) : null}
              {block.imageCredit || block.imageSource ? (
                <figcaption className="text-xs text-muted">
                  {block.imageCredit}{block.imageCredit && block.imageSource ? " · " : ""}
                  {block.imageSource ? <a href={block.imageSource} target="_blank" rel="noreferrer" className="underline">Fuente</a> : null}
                </figcaption>
              ) : null}
            </figure>
          );
        }
        if (block.type === "quote") {
          return <blockquote key={block.id} className="border-l-4 border-secondary bg-secondary/10 px-5 py-4 text-lg italic text-body">{block.text}</blockquote>;
        }
        if (block.type === "list") {
          return <ul key={block.id} className="ml-5 list-disc space-y-2 text-base leading-7 text-body">{(block.items ?? []).map((item, index) => <li key={`${block.id}-${index}`}>{item}</li>)}</ul>;
        }
        if (block.type === "cta") {
          const label = block.label || block.text || "Conocer más";
          return block.href?.startsWith("/") ? (
            <Link key={block.id} to={block.href} className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-fg hover:brightness-110">{label}</Link>
          ) : (
            <a key={block.id} href={block.href || "#"} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-fg hover:brightness-110">{label}</a>
          );
        }
        if (block.type === "faq") {
          return (
            <details key={block.id} className="rounded-xl border border-border bg-surface p-4">
              <summary className="cursor-pointer font-semibold text-body">{block.question}</summary>
              <p className="mt-3 text-sm leading-6 text-muted">{block.answer}</p>
            </details>
          );
        }
        return null;
      })}
    </div>
  );
}
