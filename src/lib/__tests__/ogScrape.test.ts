import { describe, expect, it } from "vitest";
import { extractOgImage, isSafePublicUrl } from "../ogScrape";

describe("isSafePublicUrl", () => {
  it("accepts normal public http(s) urls", () => {
    expect(isSafePublicUrl("https://www.theguardian.com/x/y")).toBe(true);
    expect(isSafePublicUrl("http://example.com")).toBe(true);
  });
  it("rejects other schemes, credentials and over-long urls", () => {
    expect(isSafePublicUrl("ftp://example.com/a")).toBe(false);
    expect(isSafePublicUrl("javascript:alert(1)")).toBe(false);
    expect(isSafePublicUrl("https://user:pw@example.com/")).toBe(false);
    expect(isSafePublicUrl(`https://example.com/${"a".repeat(2100)}`)).toBe(false);
    expect(isSafePublicUrl("not a url")).toBe(false);
  });
  it("rejects loopback / private / link-local / multicast hosts", () => {
    for (const bad of [
      "http://localhost/x",
      "http://foo.localhost/x",
      "http://printer.local/x",
      "http://127.0.0.1/x",
      "http://10.1.2.3/x",
      "http://192.168.1.1/x",
      "http://172.16.0.9/x",
      "http://172.31.255.1/x",
      "http://169.254.169.254/latest/meta-data",
      "http://0.0.0.0/x",
      "http://224.0.0.1/x",
      "http://[::1]/x",
      "http://[fd00::1]/x",
    ]) {
      expect(isSafePublicUrl(bad), bad).toBe(false);
    }
    expect(isSafePublicUrl("http://172.32.0.1/x")).toBe(true); // just outside 172.16/12
  });
});

describe("extractOgImage", () => {
  const base = "https://news.example.com/story";
  it("prefers og:image and resolves relative urls", () => {
    const html = `<head>
      <meta property="og:title" content="T">
      <meta property="og:image" content="/img/hero.jpg">
    </head>`;
    expect(extractOgImage(html, base)).toBe("https://news.example.com/img/hero.jpg");
  });
  it("handles reversed attribute order and twitter fallback", () => {
    expect(
      extractOgImage(`<meta content="https://cdn.example.com/a.png" name="twitter:image">`, base),
    ).toBe("https://cdn.example.com/a.png");
  });
  it("prefers secure_url over plain og:image", () => {
    const html = `
      <meta property="og:image" content="http://cdn.example.com/a.png">
      <meta property="og:image:secure_url" content="https://cdn.example.com/a.png">`;
    expect(extractOgImage(html, base)).toBe("https://cdn.example.com/a.png");
  });
  it("returns null when nothing usable exists", () => {
    expect(extractOgImage("<head><title>x</title></head>", base)).toBe(null);
    expect(extractOgImage(`<meta property="og:image" content="">`, base)).toBe(null);
  });
});
