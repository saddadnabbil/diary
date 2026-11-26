const sampleVideo = "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";

export async function GET(request: Request) {
  const range = request.headers.get("range");
  if (range && !/^bytes=(?:\d+-\d*|-\d+)$/.test(range)) return new Response(null, { status: 416 });

  try {
    const upstream = await fetch(sampleVideo, {
      headers: range ? { Range: range } : {},
      redirect: "error",
      signal: AbortSignal.timeout(8000),
    });

    if (upstream.status === 416) {
      await upstream.body?.cancel();
      const contentRange = upstream.headers.get("content-range");
      return new Response(null, { status: 416, headers: contentRange ? { "Content-Range": contentRange } : {} });
    }

    if (!upstream.ok || !upstream.body || upstream.headers.get("content-type") !== "video/mp4") {
      await upstream.body?.cancel();
      return new Response(null, { status: 502 });
    }

    const headers = new Headers({ "Content-Type": "video/mp4", "X-Content-Type-Options": "nosniff" });
    for (const name of ["accept-ranges", "content-range", "content-length"]) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }
    return new Response(upstream.body, { headers, status: upstream.status });
  } catch {
    return new Response(null, { status: 502 });
  }
}
