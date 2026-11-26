import "server-only";
import { z } from "zod";

const seconds = z.number().int().nonnegative().max(253402300799);
const mediaSchema = z.object({
  uri: z.string().min(1),
  creation_timestamp: seconds.optional(),
  title: z.string().optional(),
});
const postSchema = z.object({
  title: z.string().optional(),
  creation_timestamp: seconds.optional(),
  media: z.array(mediaSchema).min(1),
});

export const demoPhotos = {
  lake: { id: "1739549019964-759fa644f92e", alt: "A lake beneath the mountains", credit: "https://unsplash.com/photos/FRH6YcFRNgs" },
  road: { id: "1484271516638-5de1a7e7e5e8", alt: "An empty road through the forest", credit: "https://unsplash.com/photos/_z_-NCWB6wg" },
  building: { id: "1761305073365-0e5c0562b91b", alt: "A white building with geometric windows", credit: "https://unsplash.com/photos/tboyx4CN5tE" },
  trees: { id: "1624475236903-de53c2b25ec3", alt: "A bend in the road under green trees", credit: "https://unsplash.com/photos/QiaaenNiTQU" },
  concrete: { id: "1587663298189-6e05e9017fd5", alt: "A pale concrete building under a bright sky", credit: "https://unsplash.com/photos/wPrrpX8Rkz0" },
} as const;

const sampleMedia = new Map<string, keyof typeof demoPhotos>([
  ["media/posts/lake.jpg", "lake"],
  ["media/posts/road.jpg", "road"],
  ["media/posts/building.jpg", "building"],
  ["media/stories/trees.jpg", "trees"],
  ["media/stories/concrete.jpg", "concrete"],
]);

// Synthetic records in the shapes observed in Instagram JSON exports.
const demoExport = {
  posts: [
    { title: "A weekend away", creation_timestamp: 1733032800, media: [
      { uri: "media/posts/lake.jpg" },
      { uri: "media/posts/road.jpg" },
    ] },
    { media: [{ uri: "media/posts/building.jpg", title: "An afternoon in town", creation_timestamp: 1732258800 }] },
  ],
  stories: { ig_stories: [
    { uri: "media/stories/trees.jpg", creation_timestamp: 1733036400, title: "The long way home" },
    { uri: "media/stories/concrete.jpg", creation_timestamp: 1732262400, title: "Caught the last bit of light" },
  ] },
  reels: { ig_reels_media: [
    { title: "Flowers by the trail", creation_timestamp: 1732953600, media: [{ uri: "media/reels/flowers.mp4" }] },
    { title: "The drive back", creation_timestamp: 1732867200, media: [{ uri: "media/reels/drive.mp4" }] },
  ] },
};

function demoAttachment({ uri }: z.infer<typeof mediaSchema>) {
  if (uri === "media/reels/flowers.mp4") {
    return { uri, src: "/api/archive/demo-video", alt: "Flowers by the trail", credit: null, kind: "video" as const };
  }
  const photo = sampleMedia.get(uri);
  if (!photo) return { uri, src: null, alt: "", credit: null, kind: "image" as const };
  return { uri, src: "/api/archive/demo-photo/" + photo, alt: demoPhotos[photo].alt, credit: demoPhotos[photo].credit, kind: "image" as const };
}

function milliseconds(timestamp: number | undefined) {
  return timestamp === undefined ? null : timestamp * 1000;
}

function normalizePosts(input: unknown, kind: "post" | "reel") {
  return z.array(postSchema).parse(input).map((post, index) => ({
    id: kind + "-" + index,
    kind,
    caption: post.title?.trim() || post.media.find((media) => media.title?.trim())?.title?.trim() || "",
    createdAt: milliseconds(post.creation_timestamp ?? post.media.find((media) => media.creation_timestamp !== undefined)?.creation_timestamp),
    media: post.media.map(demoAttachment),
  }));
}

// The fixture mirrors received comments with explicit post associations. The
// owner's exported comment history cannot establish these associations.
const demoPostComments: Record<string, { author: string; text: string; createdAt: number }[]> = {
  "post-0": [
    { author: "maya", text: "That lake looks unreal.", createdAt: 1733037300000 },
    { author: "raka", text: "Let's go back next year.", createdAt: 1733040000000 },
  ],
  "post-1": [
    { author: "maya", text: "Love the light here.", createdAt: 1732262500000 },
  ],
};

export function getDemoArchive() {
  const stories = z.object({ ig_stories: z.array(mediaSchema) }).parse(demoExport.stories);
  const reels = z.object({ ig_reels_media: z.array(postSchema) }).parse(demoExport.reels);
  return {
    memories: [
      ...normalizePosts(demoExport.posts, "post"),
      ...normalizePosts(reels.ig_reels_media, "reel"),
      ...stories.ig_stories.map((story, index) => ({
        id: "story-" + index,
        kind: "story" as const,
        caption: story.title?.trim() ?? "",
        createdAt: milliseconds(story.creation_timestamp),
        media: [demoAttachment(story)],
      })),
    ].map((memory) => ({ ...memory, comments: demoPostComments[memory.id] ?? [] }))
      .sort((a, b) => (b.createdAt ?? -1) - (a.createdAt ?? -1)),
  };
}

export type DemoArchive = ReturnType<typeof getDemoArchive>;

const attachmentSchema = z.object({ uri: z.string().min(1) });
const messageSchema = z.object({
  sender_name: z.string(),
  timestamp_ms: z.number().int().nonnegative().max(253402300799999),
  content: z.string().optional(),
  photos: z.array(attachmentSchema).optional(),
  videos: z.array(attachmentSchema).optional(),
});
const threadSchema = z.object({
  title: z.string(),
  messages: z.array(messageSchema),
});

const demoInbox = {
  maya: { title: "Maya", messages: [
    { sender_name: "Maya", timestamp_ms: 1733038120000, content: "A little clip for the archive.", videos: [{ uri: "messages/inbox/maya/videos/flowers.mp4" }] },
    { sender_name: "You", timestamp_ms: 1733038060000, photos: [{ uri: "media/posts/lake.jpg" }] },
    { sender_name: "Maya", timestamp_ms: 1733038000000, content: "Did you keep any photos from the trip?" },
  ] },
  raka: { title: "Raka", messages: [
    { sender_name: "You", timestamp_ms: 1732961600000, content: "I found this one from the drive.", photos: [{ uri: "media/stories/trees.jpg" }] },
    { sender_name: "Raka", timestamp_ms: 1732961000000, content: "That was a good weekend." },
  ] },
};

export function getDemoInbox() {
  return Object.entries(demoInbox).map(([id, input]) => {
    const thread = threadSchema.parse(input);
    return {
      id,
      title: thread.title,
      messages: thread.messages.map((message, index) => ({
        id: index,
        sender: message.sender_name,
        outgoing: message.sender_name === "You",
        createdAt: message.timestamp_ms,
        text: message.content ?? "",
        photos: (message.photos ?? []).map(demoAttachment),
        videos: (message.videos ?? []).map(({ uri }) => ({
          uri,
          src: uri === "messages/inbox/maya/videos/flowers.mp4" ? "/api/archive/demo-video" : null,
        })),
      })).sort((a, b) => a.createdAt - b.createdAt),
    };
  });
}

export type DemoInbox = ReturnType<typeof getDemoInbox>;
