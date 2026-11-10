/**
 * Music links for entries. Paste a link from Spotify, YouTube Music or YouTube and it becomes an embed.
 * Only these hosts and id formats are accepted, and the embed URL is always built here from the id.
 */

export type MusicProvider = "spotify" | "youtube";

export interface MusicRef {
  provider: MusicProvider;
  /** Spotify: track | album | playlist | episode | show. YouTube: video | playlist. */
  kind: string;
  id: string;
}

const SPOTIFY_KINDS = ["track", "album", "playlist", "episode", "show"] as const;
const SPOTIFY_ID = "[A-Za-z0-9]{22}";
const YT_VIDEO = "[A-Za-z0-9_-]{11}";
const YT_LIST = "[A-Za-z0-9_-]{10,64}";

const SPOTIFY_URI_RE = new RegExp(`^spotify:(${SPOTIFY_KINDS.join("|")}):(${SPOTIFY_ID})$`);
const SPOTIFY_PATH_RE = new RegExp(`^/(?:intl-[a-z]{2}/)?(${SPOTIFY_KINDS.join("|")})/(${SPOTIFY_ID})/?$`);
const YT_URI_RE = new RegExp(`^youtube:(video|playlist):(${YT_VIDEO}|${YT_LIST})$`);
const YT_VIDEO_RE = new RegExp(`^(${YT_VIDEO})$`);
const YT_LIST_RE = new RegExp(`^(${YT_LIST})$`);

const SPOTIFY_HOSTS = new Set(["open.spotify.com"]);
const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be", "youtube-nocookie.com", "www.youtube-nocookie.com"]);

function youtubeFromUrl(url: URL): MusicRef | null {
  const host = url.hostname.toLowerCase();
  const list = url.searchParams.get("list");
  // youtu.be/ID
  if (host === "youtu.be") {
    const id = url.pathname.slice(1).split("/")[0];
    return YT_VIDEO_RE.test(id) ? { provider: "youtube", kind: "video", id } : null;
  }
  const path = url.pathname;
  // /shorts/ID and /embed/ID
  const direct = /^\/(?:shorts|embed|live)\/([A-Za-z0-9_-]+)\/?$/.exec(path);
  if (direct && YT_VIDEO_RE.test(direct[1])) return { provider: "youtube", kind: "video", id: direct[1] };
  // /watch?v=ID (a list alongside a video plays the video)
  const v = url.searchParams.get("v");
  if (path === "/watch" && v && YT_VIDEO_RE.test(v)) return { provider: "youtube", kind: "video", id: v };
  // /playlist?list=ID, or /embed/videoseries?list=ID
  if (list && YT_LIST_RE.test(list) && (path === "/playlist" || path.startsWith("/embed/videoseries"))) {
    return { provider: "youtube", kind: "playlist", id: list };
  }
  return null;
}

/** Accepts a share link from Spotify, YouTube Music or YouTube, or an internal uri. Returns null for anything else. */
export function parseMusicLink(input: string): MusicRef | null {
  const raw = input.trim();
  const spotifyUri = SPOTIFY_URI_RE.exec(raw);
  if (spotifyUri) return { provider: "spotify", kind: spotifyUri[1], id: spotifyUri[2] };
  const ytUri = YT_URI_RE.exec(raw);
  if (ytUri) return { provider: "youtube", kind: ytUri[1], id: ytUri[2] };

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.toLowerCase();
  if (SPOTIFY_HOSTS.has(host)) {
    const m = SPOTIFY_PATH_RE.exec(url.pathname);
    return m ? { provider: "spotify", kind: m[1], id: m[2] } : null;
  }
  if (YOUTUBE_HOSTS.has(host)) return youtubeFromUrl(url);
  return null;
}

/** The uri stored in the entry body. Spotify keeps its original format, so older entries still load. */
export function musicUri(ref: MusicRef): string {
  return ref.provider === "spotify" ? `spotify:${ref.kind}:${ref.id}` : `youtube:${ref.kind}:${ref.id}`;
}

/** Re-validates a stored uri, so a tampered body can never load anything else. */
export function parseStoredMusicUri(uri: unknown): MusicRef | null {
  return typeof uri === "string" ? parseMusicLink(uri) : null;
}

/** Embed URL, built only from validated parts. */
export function embedUrl(ref: MusicRef): string {
  if (ref.provider === "spotify") return `https://open.spotify.com/embed/${ref.kind}/${ref.id}`;
  return ref.kind === "playlist"
    ? `https://www.youtube-nocookie.com/embed/videoseries?list=${ref.id}&rel=0`
    : `https://www.youtube-nocookie.com/embed/${ref.id}?rel=0&playsinline=1`;
}

/** Height in px. Spotify: compact pill for a song, taller for lists. YouTube: a video-shaped frame. */
export function embedHeight(ref: MusicRef): number {
  if (ref.provider === "spotify") return ref.kind === "track" || ref.kind === "episode" ? 80 : 232;
  return ref.kind === "playlist" ? 300 : 220;
}

export const providerName = (p: MusicProvider) => (p === "spotify" ? "Spotify" : "YouTube");
