import { describe, expect, it } from "vitest";
import { embedUrl, musicUri, parseMusicLink, parseStoredMusicUri } from "./music";

describe("parseMusicLink", () => {
  it("accepts Spotify share links with tracking params and locale paths", () => {
    expect(parseMusicLink("https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT?si=abc")).toEqual({ provider: "spotify", kind: "track", id: "4cOdK2wGLETKBW3PvgPWqT" });
    expect(parseMusicLink("https://open.spotify.com/intl-id/album/4cOdK2wGLETKBW3PvgPWqT")?.kind).toBe("album");
  });

  it("accepts Spotify URIs", () => {
    expect(parseMusicLink("spotify:track:4cOdK2wGLETKBW3PvgPWqT")?.provider).toBe("spotify");
  });

  it("accepts YouTube Music, YouTube and short links for videos", () => {
    const id = "dQw4w9WgXcQ";
    for (const link of [
      `https://music.youtube.com/watch?v=${id}&si=x`,
      `https://www.youtube.com/watch?v=${id}`,
      `https://m.youtube.com/watch?v=${id}`,
      `https://youtu.be/${id}?t=12`,
      `https://www.youtube.com/shorts/${id}`,
    ]) {
      expect(parseMusicLink(link)).toEqual({ provider: "youtube", kind: "video", id });
    }
  });

  it("accepts YouTube playlists", () => {
    expect(parseMusicLink("https://music.youtube.com/playlist?list=PLabcdefghij123")).toEqual({ provider: "youtube", kind: "playlist", id: "PLabcdefghij123" });
  });

  it("refuses other hosts, http, and malformed ids", () => {
    expect(parseMusicLink("https://evil.example.com/track/4cOdK2wGLETKBW3PvgPWqT")).toBeNull();
    expect(parseMusicLink("http://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT")).toBeNull();
    expect(parseMusicLink("https://www.youtube.com/watch?v=short")).toBeNull();
    expect(parseMusicLink("javascript:alert(1)")).toBeNull();
    expect(parseMusicLink("hello")).toBeNull();
  });
});

describe("embed and storage", () => {
  it("builds embed urls only from validated ids", () => {
    expect(embedUrl({ provider: "youtube", kind: "video", id: "dQw4w9WgXcQ" })).toContain("youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(embedUrl({ provider: "spotify", kind: "track", id: "4cOdK2wGLETKBW3PvgPWqT" })).toBe("https://open.spotify.com/embed/track/4cOdK2wGLETKBW3PvgPWqT");
  });

  it("round-trips a stored uri and rejects tampered ones", () => {
    const ref = parseMusicLink("https://youtu.be/dQw4w9WgXcQ");
    expect(ref && musicUri(ref)).toBe("youtube:video:dQw4w9WgXcQ");
    expect(parseStoredMusicUri("youtube:video:dQw4w9WgXcQ")).toEqual(ref);
    expect(parseStoredMusicUri("https://evil.example.com/x")).toBeNull();
    expect(parseStoredMusicUri(42)).toBeNull();
  });
});
