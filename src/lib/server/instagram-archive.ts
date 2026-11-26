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
const commentsSchema = z.array(z.object({
  string_map_data: z.object({
    Comment: z.object({ value: z.string() }),
    Time: z.object({ timestamp: seconds }),
    "Media Owner": z.object({ value: z.string() }).optional(),
  }),
}));

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
    { title: "The drive back", creation_timestamp: 1732867200, media: [{ uri: "media/reels/drive.mp4" }] },
  ] },
  comments: [
    { string_map_data: { Comment: { value: "Where was this taken?" }, Time: { timestamp: 1733037000 }, "Media Owner": { value: "example_friend" } } },
    { string_map_data: { Comment: { value: "Adding this to my weekend list." }, Time: { timestamp: 1732258900 }, "Media Owner": { value: "example_travels" } } },
  ],
};

function demoAttachment({ uri }: z.infer<typeof mediaSchema>) {
  const photo = sampleMedia.get(uri);
  if (!photo) return { uri, src: null, alt: "", credit: null };
  return { uri, src: "/api/archive/demo-photo/" + photo, alt: demoPhotos[photo].alt, credit: demoPhotos[photo].credit };
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
    ].sort((a, b) => (b.createdAt ?? -1) - (a.createdAt ?? -1)),
    comments: commentsSchema.parse(demoExport.comments).map(({ string_map_data: data }, index) => ({
      id: "comment-" + index,
      text: data.Comment.value,
      mediaOwner: data["Media Owner"]?.value ?? null,
      createdAt: data.Time.timestamp * 1000,
    })).sort((a, b) => b.createdAt - a.createdAt),
  };
}

export type DemoArchive = ReturnType<typeof getDemoArchive>;
