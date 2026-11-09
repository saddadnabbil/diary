import { addImage } from "./db";

const ALLOWED = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const MAX_INPUT_BYTES = 15 * 1024 * 1024;
const MAX_GIF_BYTES = 5 * 1024 * 1024;
const MAX_EDGE = 1600;

export class ImageError extends Error {}

/** Validate, downscale and re-encode an image. SVG and anything unexpected is refused. */
export async function prepareImage(file: File): Promise<Blob> {
  if (!ALLOWED.includes(file.type)) throw new ImageError("Only PNG, JPEG, WebP and GIF images are supported.");
  if (file.size > MAX_INPUT_BYTES) throw new ImageError("That image is larger than 15 MB.");
  if (file.type === "image/gif") {
    if (file.size > MAX_GIF_BYTES) throw new ImageError("GIFs must be under 5 MB.");
    return file; // re-encoding would drop the animation
  }
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new ImageError("Could not read that image.");
  });
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/webp", 0.85));
  if (!blob) throw new ImageError("Could not process that image.");
  return blob;
}

/** Store an image on this device (and queue it for cloud sync) and return its id. */
export async function storeImage(file: File): Promise<string> {
  return addImage(await prepareImage(file));
}
