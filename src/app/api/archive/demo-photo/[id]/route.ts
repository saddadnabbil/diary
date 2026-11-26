import { demoPhotos } from "@/lib/server/instagram-archive";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!Object.hasOwn(demoPhotos, id)) return new Response(null, { status: 404 });

  const photo = demoPhotos[id as keyof typeof demoPhotos];
  try {
    const response = await fetch("https://images.unsplash.com/photo-" + photo.id + "?fm=jpg&fit=max&w=1000&q=78", {
      redirect: "error",
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok || !response.body || response.headers.get("content-type") !== "image/jpeg") {
      await response.body?.cancel();
      return new Response(null, { status: 502 });
    }

    return new Response(response.body, {
      headers: { "Content-Type": "image/jpeg", "X-Content-Type-Options": "nosniff" },
    });
  } catch {
    return new Response(null, { status: 502 });
  }
}
