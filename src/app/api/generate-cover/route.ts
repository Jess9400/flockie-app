import { NextResponse } from "next/server";
import { experimental_generateImage as generateImage } from "ai";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

// Image model routed through Vercel AI Gateway (the "provider/model" string is
// auto-routed). Imagen 4 Fast — cheaper (~$0.02/image), great for stylized
// poster covers. Swap this slug if the gateway model list changes.
const IMAGE_MODEL = "google/imagen-4.0-fast-generate-001";

// Generate a decorative, illustrated cover for a Vibe/Trip/Activity. This is
// deliberately stylized poster art — NOT photoreal people — so it's never used
// to fake a person's identity. Requires AI Gateway to be enabled on the Vercel
// project (OIDC token) or AI_GATEWAY_API_KEY to be set.
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Rate limit: paid image generation — cap per user/day to prevent cost blowups.
  const { data: allowed } = await supabase.rpc("rate_limit_hit", {
    p_bucket: "cover_gen",
    p_max: 20,
    p_window_seconds: 86400,
  });
  if (allowed === false) {
    return NextResponse.json(
      { error: "Daily image limit reached — try again tomorrow." },
      { status: 429 }
    );
  }

  let prompt = "";
  try {
    ({ prompt } = await req.json());
  } catch {
    /* ignore */
  }
  prompt = (prompt ?? "").toString().trim().slice(0, 400);
  if (!prompt) return NextResponse.json({ error: "Missing prompt" }, { status: 400 });

  const styled =
    `Flat, vibrant illustrated event cover poster. ${prompt}. ` +
    `Warm, playful, modern editorial style, bold simple shapes, no text, no logos, no real human faces.`;

  try {
    const { images } = await generateImage({
      model: IMAGE_MODEL,
      prompt: styled,
      size: "1024x1024",
      providerOptions: { gateway: { user: user.id, tags: ["feature:cover-gen"] } },
    });
    const img = images[0];
    if (!img) return NextResponse.json({ error: "No image returned" }, { status: 502 });
    return NextResponse.json({ base64: img.base64, mediaType: img.mediaType ?? "image/png" });
  } catch (e) {
    const err = e as { statusCode?: number; message?: string };
    const status =
      err?.statusCode === 402 ? 402 : err?.statusCode === 429 ? 429 : 500;
    return NextResponse.json({ error: "Generation failed" }, { status });
  }
}
