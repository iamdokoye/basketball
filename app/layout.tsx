import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { GeistSans } from "geist/font/sans";
import { AccessBadge } from "./components/AccessBadge";
import { BottomNav, TopNav } from "./components/Nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pickup League",
  description: "3v3 pickup stats for the crew",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#f4f1ec",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // Browser extensions (reader mode, clippers, translators) add classes and
    // attributes to <html>/<body> before hydration; ignore those mismatches.
    <html lang="en" className={`${GeistSans.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="flex min-h-full flex-col" suppressHydrationWarning>
        <div className="mesh" aria-hidden>
          <i />
          <i />
          <i />
        </div>
        <header className="glass-2 sticky top-0 z-20 rounded-none border-x-0 border-t-0">
          <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
            <Link href="/" className="flex items-center gap-2.5 whitespace-nowrap text-lg font-semibold tracking-tight">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-court-soft text-white shadow-[0_2px_8px_rgb(253_101_30/0.3)]">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden>
                  <circle cx="12" cy="12" r="9" />
                  <path d="M3 12h18M12 3v18M5.6 5.6c3 3 3 9.8 0 12.8M18.4 5.6c-3 3-3 9.8 0 12.8" />
                </svg>
              </span>
              Pickup League
            </Link>
            <TopNav />
            <AccessBadge />
          </div>
        </header>
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-32 pt-6 md:pb-12">{children}</main>
        <BottomNav />
      </body>
    </html>
  );
}
