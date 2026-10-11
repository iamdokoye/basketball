import type { Metadata, Viewport } from "next";
import Link from "next/link";
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
  themeColor: "#1c1917",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <header className="sticky top-0 z-20 bg-ink text-white">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2 whitespace-nowrap text-lg font-black tracking-tight">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-court text-sm">🏀</span>
              Pickup League
            </Link>
            <TopNav />
          </div>
        </header>
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-28 pt-5 md:pb-10">{children}</main>
        <BottomNav />
      </body>
    </html>
  );
}
