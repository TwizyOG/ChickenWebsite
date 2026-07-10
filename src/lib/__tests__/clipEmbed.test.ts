import { describe, expect, it } from "vitest";
import { kickClipEmbedUrl, parseClipUrl, twitchClipEmbedUrl } from "../clipEmbed";

describe("parseClipUrl", () => {
  it("parses kick.com/{channel}/clips/{id}", () => {
    expect(parseClipUrl("https://kick.com/chickenandy/clips/clip_01ABC2DEF3")).toEqual({
      provider: "kick",
      id: "clip_01ABC2DEF3",
      url: "https://kick.com/chickenandy/clips/clip_01ABC2DEF3",
    });
  });
  it("parses kick.com ?clip= query form (www + params)", () => {
    expect(parseClipUrl("https://www.kick.com/chickenandy?clip=clip_01XYZ&extra=1")).toEqual({
      provider: "kick",
      id: "clip_01XYZ",
      url: "https://www.kick.com/chickenandy?clip=clip_01XYZ&extra=1",
    });
  });
  it("parses clips.twitch.tv/{Slug}", () => {
    expect(parseClipUrl("https://clips.twitch.tv/BraveCleverGarlicNerfRedBlaster-x1_Y2")).toEqual({
      provider: "twitch",
      id: "BraveCleverGarlicNerfRedBlaster-x1_Y2",
      url: "https://clips.twitch.tv/BraveCleverGarlicNerfRedBlaster-x1_Y2",
    });
  });
  it("parses twitch.tv/{channel}/clip/{Slug} with query", () => {
    expect(
      parseClipUrl("https://www.twitch.tv/somechannel/clip/FunnyClipSlug-abc_123?filter=clips"),
    ).toEqual({
      provider: "twitch",
      id: "FunnyClipSlug-abc_123",
      url: "https://www.twitch.tv/somechannel/clip/FunnyClipSlug-abc_123?filter=clips",
    });
  });
  it("rejects non-clip and garbage urls", () => {
    expect(parseClipUrl("https://kick.com/chickenandy")).toBeNull();
    expect(parseClipUrl("https://twitch.tv/somechannel")).toBeNull();
    expect(parseClipUrl("https://youtube.com/watch?v=abc")).toBeNull();
    expect(parseClipUrl("not a url")).toBeNull();
    expect(parseClipUrl("")).toBeNull();
  });
});

describe("embed urls", () => {
  it("builds the official kick clip player url", () => {
    expect(kickClipEmbedUrl("clip_01ABC")).toBe("https://player.kick.com/clip/clip_01ABC");
  });
  it("builds the twitch embed with all parent hosts", () => {
    const u = twitchClipEmbedUrl("SomeSlug-1");
    expect(u).toContain("https://clips.twitch.tv/embed?clip=SomeSlug-1");
    expect(u).toContain("parent=chickenwebsite.vercel.app");
    expect(u).toContain("parent=twizyog.github.io");
    expect(u).toContain("parent=localhost");
    expect(u).toContain("autoplay=false");
  });
});
