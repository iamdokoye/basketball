import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { GeistSans } from "geist/font/sans";
import { getMe } from "@/lib/identity";
import { ME_REFRESH_MS } from "@/lib/identityShared";
import { AccessBadge } from "./components/AccessBadge";
import { IdentitySync } from "./components/IdentitySync";
import { MeChip } from "./components/MeChip";
import { BottomNav, TopNav } from "./components/Nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pickup League",
  description: "3v3 pickup stats for the crew",
  applicationName: "Pickup League",
  appleWebApp: {
    capable: true,
    title: "Pickup League",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/icons/192", sizes: "192x192", type: "image/png" },
      { url: "/icons/512", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover", // use the whole screen when installed (the header adds the notch padding)
  themeColor: "#f4f1ec",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const me = await getMe();
  return (
    // Browser extensions (reader mode, clippers, translators) add classes and
    // attributes to <html>/<body> before hydration; ignore those mismatches.
    <html
      lang="en"
      className={`${GeistSans.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col" suppressHydrationWarning>
        <div className="mesh" aria-hidden>
          <i />
          <i />
          <i />
        </div>
        <header
          className="glass-2 sticky top-0 z-20 rounded-none border-x-0 border-t-0"
          style={{ paddingTop: "env(safe-area-inset-top)" }}
        >
          <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
            <Link
              href="/"
              className="flex items-center gap-2.5 whitespace-nowrap text-lg font-semibold tracking-tight"
            >
              <span className="grid h-9 w-9 place-items-center rounded-full bg-court-soft text-white shadow-[0_2px_8px_rgb(253_101_30/0.3)]">
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  aria-hidden
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="M3 12h18M12 3v18M5.6 5.6c3 3 3 9.8 0 12.8M18.4 5.6c-3 3-3 9.8 0 12.8" />
                </svg>
              </span>
              {/* On very narrow phones the badge and your avatar need the room; the icon still links home. */}
              <span className="max-[379px]:sr-only">Pickup League</span>
            </Link>
            <TopNav />
            <div className="flex items-center gap-2">
              <AccessBadge />
              <MeChip />
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-32 pt-6 md:pb-12">
          {children}
        </main>
        <BottomNav />
        <IdentitySync
          playerId={me?.playerId ?? null}
          issuedAt={me?.issuedAt ?? null}
          refreshAfterMs={ME_REFRESH_MS}
        />
      </body>
    </html>
  );
}
