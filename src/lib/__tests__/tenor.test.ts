import { describe, expect, it } from "vitest";
import { isTenorMediaUrl, mapTenorResults } from "../tenor";

const fixture = {
  results: [
    {
      id: "111",
      content_description: "happy chicken",
      media_formats: {
        gif: { url: "https://media.tenor.com/abc/full.gif", dims: [498, 280] },
        tinygif: { url: "https://media.tenor.com/abc/tiny.gif", dims: [220, 124] },
      },
    },
    { id: "222", media_formats: {} }, // no gif → dropped
    {
      id: "333",
      media_formats: { gif: { url: "https://media.tenor.com/x/g.gif", dims: [100, 100] } },
    }, // no tinygif → preview falls back to gif
  ],
};

describe("mapTenorResults", () => {
  it("maps results, drops gif-less rows, falls back preview to full gif", () => {
    const out = mapTenorResults(fixture);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({
      id: "111",
      preview: "https://media.tenor.com/abc/tiny.gif",
      url: "https://media.tenor.com/abc/full.gif",
      width: 498,
      height: 280,
      alt: "happy chicken",
    });
    expect(out[1].preview).toBe("https://media.tenor.com/x/g.gif");
    expect(out[1].alt).toBe("GIF");
  });
  it("tolerates garbage", () => {
    expect(mapTenorResults(null)).toEqual([]);
    expect(mapTenorResults({})).toEqual([]);
  });
});

describe("isTenorMediaUrl", () => {
  it("accepts tenor media, rejects everything else", () => {
    expect(isTenorMediaUrl("https://media.tenor.com/abc/full.gif")).toBe(true);
    expect(isTenorMediaUrl("https://evil.com/x.gif")).toBe(false);
    expect(isTenorMediaUrl("http://media.tenor.com/abc.gif")).toBe(false);
    expect(isTenorMediaUrl("not a url")).toBe(false);
  });
});
