import type { MetadataRoute } from "next";

/** Lets the app be installed to a phone or desktop home screen. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Diary.",
    short_name: "Diary",
    description: "A quiet place to think, with gentle prompts when you do not know where to start.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
