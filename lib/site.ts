// The public address of this deployment, used for link-preview images and absolute links.
// Set NEXT_PUBLIC_SITE_URL to the real domain; Vercel's own variables are a sensible fallback,
// and localhost keeps `next dev` working.

export const SITE_NAME = "Pickup League";
export const SITE_DESCRIPTION = "3v3 pickup stats for the crew";

export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const vercel =
    process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  if (vercel)
    return `https://${vercel.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;

  return "http://localhost:3000";
}
