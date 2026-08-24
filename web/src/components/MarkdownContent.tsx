import type { ReactNode } from "react";
import Link from "next/link";
import { MaterialIcon } from "@/components/MaterialIcon";

/**
 * A tiny, dependency-free renderer for the specific subset of Markdown the
 * public pages (About, Encryption, Privacy, Delete My Data — see
 * src/lib/content.ts and content/*.md) actually use. Not a general
 * CommonMark implementation — deliberately: these are four static pages,
 * not a blog engine, and a hand-rolled ~150-line parser scoped to exactly
 * what they need is a smaller, more auditable surface than pulling in a
 * full markdown library for four files that change rarely.
 *
 * Supported block syntax:
 *   # Heading         → page hero (H1) — expected once, at the top
 *   ## Heading        → section heading; groups subsequent blocks until
 *                        the next ## into one <section>
 *   ### N. Title       → a numbered "step" (see Step below); consecutive
 *                        steps are grouped into one spaced list
 *   > line             → callout box; content inside is itself parsed
 *                        recursively (so a blockquote can contain a bold
 *                        lead-in, a list, more paragraphs — see
 *                        delete-my-data.md's "If you can sign in" box)
 *   1. item / 2. item  → ordered list (every line in the block must match)
 *   plain text         → paragraph
 *
 * Inline syntax: **bold**, `code`, [text](url) — internal (/-prefixed)
 * links use next/link, mailto: links get a small mail icon, everything
 * else is a plain external link.
 */

type Block =
  | { kind: "h1"; text: string }
  | { kind: "h2"; text: string }
  | { kind: "step"; n: string; title: string; body: string }
  | { kind: "h3"; text: string }
  | { kind: "blockquote"; inner: string }
  | { kind: "orderedList"; items: string[] }
  | { kind: "paragraph"; text: string };

const STEP_HEADING = /^(\d+)\.\s+(.+)$/;
const LIST_ITEM = /^\d+\.\s+(.+)$/;

function splitIntoRawBlocks(source: string): string[] {
  return source
    .trim()
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);
}

function classifyBlocks(source: string): Block[] {
  const raw = splitIntoRawBlocks(source);
  const flat: (Block | { kind: "h3heading"; n: string; title: string })[] = [];

  for (const block of raw) {
    if (block.startsWith("# ")) {
      flat.push({ kind: "h1", text: block.slice(2).trim() });
      continue;
    }
    if (block.startsWith("## ")) {
      flat.push({ kind: "h2", text: block.slice(3).trim() });
      continue;
    }
    if (block.startsWith("### ")) {
      const rest = block.slice(4).trim();
      const m = STEP_HEADING.exec(rest);
      if (m) {
        flat.push({ kind: "h3heading", n: m[1], title: m[2] });
      } else {
        flat.push({ kind: "h3", text: rest });
      }
      continue;
    }
    if (block.startsWith(">")) {
      const inner = block
        .split("\n")
        .map((line) => line.replace(/^>\s?/, ""))
        .join("\n");
      flat.push({ kind: "blockquote", inner });
      continue;
    }
    const lines = block.split("\n").map((l) => l.trim());
    if (lines.every((l) => LIST_ITEM.test(l))) {
      flat.push({ kind: "orderedList", items: lines.map((l) => LIST_ITEM.exec(l)![1]) });
      continue;
    }
    flat.push({ kind: "paragraph", text: block.replace(/\n/g, " ") });
  }

  // Merge a "### N. Title" heading with the paragraph immediately after it
  // into one Step block.
  const merged: Block[] = [];
  for (let i = 0; i < flat.length; i++) {
    const node = flat[i];
    if ("kind" in node && node.kind === "h3heading") {
      const next = flat[i + 1];
      if (next && "kind" in next && next.kind === "paragraph") {
        merged.push({ kind: "step", n: node.n, title: node.title, body: next.text });
        i++;
        continue;
      }
      merged.push({ kind: "h3", text: `${node.n}. ${node.title}` });
      continue;
    }
    merged.push(node as Block);
  }

  return merged;
}

/** Inline **bold**, `code`, and [text](url) within a single string. */
function renderInline(text: string): ReactNode[] {
  const pattern = /`([^`]+)`|\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)]+)\)/g;
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(text))) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    const [, code, bold, linkText, href] = match;

    if (code !== undefined) {
      nodes.push(
        <code key={key++} className="font-mono text-body-md bg-surface-container-high px-1.5 py-0.5 rounded">
          {code}
        </code>,
      );
    } else if (bold !== undefined) {
      nodes.push(
        <strong key={key++} className="text-on-background">
          {bold}
        </strong>,
      );
    } else if (linkText !== undefined && href !== undefined) {
      if (href.startsWith("/")) {
        nodes.push(
          <Link key={key++} href={href} className="text-primary underline underline-offset-2">
            {linkText}
          </Link>,
        );
      } else if (href.startsWith("mailto:")) {
        nodes.push(
          <a key={key++} href={href} className="inline-flex items-center gap-1 text-primary underline underline-offset-2">
            <MaterialIcon name="mail" size={16} />
            {linkText}
          </a>,
        );
      } else {
        nodes.push(
          <a
            key={key++}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2"
          >
            {linkText}
          </a>,
        );
      }
    }
    lastIndex = pattern.lastIndex;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-editorial-display text-body-md">
        {n}
      </div>
      <div>
        <h3 className="font-editorial-display text-title-md text-on-background mb-1">
          {renderInline(title)}
        </h3>
        <p className="text-body-md text-on-surface-variant leading-relaxed">{renderInline(body)}</p>
      </div>
    </div>
  );
}

function renderBlock(block: Block, key: number): ReactNode {
  switch (block.kind) {
    case "h1":
      return (
        <h1
          key={key}
          className="font-editorial-display text-headline-lg-mobile md:text-display-lg text-primary mb-4"
        >
          {renderInline(block.text)}
        </h1>
      );
    case "h3":
      return (
        <h3 key={key} className="font-editorial-display text-title-md text-on-background">
          {renderInline(block.text)}
        </h3>
      );
    case "blockquote": {
      const innerBlocks = classifyBlocks(block.inner);
      return (
        <div key={key} className="rounded-xl bg-surface-container-low p-6 flex flex-col gap-3">
          {innerBlocks.map((b, i) => renderBlock(b, i))}
        </div>
      );
    }
    case "orderedList":
      return (
        <ol key={key} className="list-decimal list-inside text-body-md text-on-surface-variant leading-relaxed space-y-2">
          {block.items.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </ol>
      );
    case "paragraph":
      return (
        <p key={key} className="text-body-md text-on-surface-variant leading-relaxed">
          {renderInline(block.text)}
        </p>
      );
    default:
      return null;
  }
}

/** Groups blocks into top-level content, "## "-delimited sections, and
 *  consecutive-step lists, matching the visual structure the original
 *  hand-written pages had. */
function groupBlocks(blocks: Block[]): ReactNode[] {
  const out: ReactNode[] = [];
  let i = 0;
  let key = 0;

  function consumeStepRun(): ReactNode {
    const steps: Extract<Block, { kind: "step" }>[] = [];
    while (i < blocks.length && blocks[i].kind === "step") {
      steps.push(blocks[i] as Extract<Block, { kind: "step" }>);
      i++;
    }
    return (
      <div key={key++} className="flex flex-col gap-6">
        {steps.map((s, idx) => (
          <Step key={idx} n={s.n} title={s.title} body={s.body} />
        ))}
      </div>
    );
  }

  function consumeSection(title: string): ReactNode {
    const children: ReactNode[] = [];
    while (i < blocks.length && blocks[i].kind !== "h1" && blocks[i].kind !== "h2") {
      if (blocks[i].kind === "step") {
        children.push(consumeStepRun());
      } else {
        children.push(renderBlock(blocks[i], key++));
        i++;
      }
    }
    return (
      <section key={key++} className="mb-stack-gap">
        <h2 className="font-editorial-display text-headline-md text-on-background mb-3">{title}</h2>
        <div className="flex flex-col gap-3">{children}</div>
      </section>
    );
  }

  function leadParagraph(p: Extract<Block, { kind: "paragraph" }>): ReactNode {
    return (
      <p key={key++} className="text-body-lg text-on-surface-variant mb-stack-gap">
        {renderInline(p.text)}
      </p>
    );
  }

  // Leading H1 + any content before the first "##" render at the top
  // level (not wrapped in a section), then each "##" opens a section.
  // The document's first paragraph gets the larger "lead" style every
  // page's intro sentence originally had — whether or not it's preceded
  // by an H1 (Privacy renders its own H1 + "Last updated" line in
  // page.tsx and passes markdown starting at the intro paragraph, so
  // this has to work with or without a leading H1).
  while (i < blocks.length) {
    const block = blocks[i];
    if (block.kind === "h1") {
      out.push(renderBlock(block, key++));
      i++;
      if (blocks[i]?.kind === "paragraph") {
        out.push(leadParagraph(blocks[i] as Extract<Block, { kind: "paragraph" }>));
        i++;
      }
    } else if (out.length === 0 && block.kind === "paragraph") {
      out.push(leadParagraph(block));
      i++;
    } else if (block.kind === "h2") {
      i++;
      out.push(consumeSection(block.text));
    } else if (block.kind === "step") {
      out.push(consumeStepRun());
    } else {
      out.push(<div key={key++} className="mb-stack-gap">{renderBlock(block, key++)}</div>);
      i++;
    }
  }

  return out;
}

export function MarkdownContent({ source }: { source: string }) {
  const blocks = classifyBlocks(source);
  return <>{groupBlocks(blocks)}</>;
}
