export type ImageType = "image/png" | "image/jpeg" | "image/webp" | "image/gif";
export const IMAGE_TYPES: readonly ImageType[] = ["image/png", "image/jpeg", "image/webp", "image/gif"];
export const isImageType = (t: string | null): t is ImageType => !!t && (IMAGE_TYPES as readonly string[]).includes(t);

const ascii = (b: Uint8Array, at: number, s: string) => [...s].every((c, i) => b[at + i] === c.charCodeAt(0));

/** Identify an image from its first bytes, never from what the uploader claims. */
export function sniffImage(b: Uint8Array): ImageType | null {
  if (b.length >= 8 && b[0] === 0x89 && ascii(b, 1, "PNG") && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return "image/png";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 12 && ascii(b, 0, "RIFF") && ascii(b, 8, "WEBP")) return "image/webp";
  if (b.length >= 6 && (ascii(b, 0, "GIF87a") || ascii(b, 0, "GIF89a"))) return "image/gif";
  return null;
}
