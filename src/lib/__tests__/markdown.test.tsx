import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { _internal, Markdown } from "../markdown";

const html = (text: string) => renderToStaticMarkup(<Markdown text={text} />);

describe("safeHref", () => {
  it("allows http/https/mailto/relative/anchor", () => {
    expect(_internal.safeHref("https://x.com")).toBe("https://x.com");
    expect(_internal.safeHref("mailto:a@b.com")).toBe("mailto:a@b.com");
    expect(_internal.safeHref("/community")).toBe("/community");
    expect(_internal.safeHref("#c-1")).toBe("#c-1");
  });
  it("neutralizes javascript: and data: urls", () => {
    expect(_internal.safeHref("javascript:alert(1)")).toBe("#");
    expect(_internal.safeHref("data:text/html,x")).toBe("#");
    expect(_internal.safeHref("  JAVASCRIPT:alert(1)")).toBe("#");
  });
});

describe("Markdown rendering — security", () => {
  it("escapes raw HTML instead of injecting it", () => {
    const out = html("<img src=x onerror=alert(1)> **hi**");
    expect(out).not.toContain("<img");
    expect(out).toContain("&lt;img");
    expect(out).toContain("<strong>hi</strong>");
  });
  it("renders a javascript: link as an inert href", () => {
    const out = html("[click](javascript:alert(1))");
    expect(out).toContain('href="#"');
    expect(out).not.toContain("javascript:");
  });
});

describe("Markdown rendering — formats", () => {
  it("covers the core inline + block formats", () => {
    expect(html("**b**")).toContain("<strong>b</strong>");
    expect(html("*i*")).toContain("<em>i</em>");
    expect(html("~~s~~")).toContain("<del>s</del>");
    expect(html("`c`")).toContain("<code");
    expect(html("[t](https://x.com)")).toContain('href="https://x.com"');
    expect(html("# Title")).toContain("<h1");
    expect(html("> quote")).toContain("<blockquote");
    expect(html("- a\n- b")).toContain("<ul");
    expect(html("1. a\n2. b")).toContain("<ol");
    expect(html("```\ncode\n```")).toContain("<pre");
    expect(html("| a | b |\n| --- | --- |\n| 1 | 2 |")).toContain("<table");
  });
  it("renders spoiler and superscript", () => {
    expect(html(">!secret!<")).toContain("Reveal spoiler");
    expect(html("e = mc^2")).toContain("<sup>2</sup>");
    expect(html("x^(n+1)")).toContain("<sup>n+1</sup>");
  });
  it("returns nothing for empty input", () => {
    expect(html("")).toBe("");
    expect(html("   ")).toBe("");
  });
});
