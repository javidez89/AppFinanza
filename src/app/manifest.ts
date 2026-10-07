import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  return {
    name: "AppFinanza",
    short_name: "AppFinanza",
    description: "Administración financiera personal y familiar compartida.",
    start_url: `${base}/`,
    id: `${base}/`,
    scope: `${base}/`,
    display: "standalone",
    background_color: "#f5f7fb",
    theme_color: "#12324a",
    lang: "es-CO",
    prefer_related_applications: false,
    icons: [192, 512].flatMap((size) => (["any", "maskable"] as const).map((purpose) => ({
      src: `${base}/icon-${size}.png`,
      sizes: `${size}x${size}`,
      type: "image/png",
      purpose,
    }))),
  };
}
