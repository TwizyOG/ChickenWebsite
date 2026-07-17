import { describe, expect, it } from "vitest";
import { isTenorMediaUrl } from "../tenor";

describe("isTenorMediaUrl", () => {
  it("accepts tenor media, rejects everything else", () => {
    expect(isTenorMediaUrl("https://media.tenor.com/abc/full.gif")).toBe(true);
    expect(isTenorMediaUrl("https://evil.com/x.gif")).toBe(false);
    expect(isTenorMediaUrl("http://media.tenor.com/abc.gif")).toBe(false);
    expect(isTenorMediaUrl("not a url")).toBe(false);
  });
});
