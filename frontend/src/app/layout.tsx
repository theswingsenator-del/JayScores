import type { Metadata, Viewport } from "next";
import "./globals.css";
import Nav from "@/components/Nav";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3005";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "SJ Sports — AI Match Predictions",
    template: "%s · SJ Sports",
  },
  description:
    "Statistical football and basketball predictions: scorelines, win probabilities, goals, corners and full market boards — refit after every matchday.",
  openGraph: {
    title: "SJ Sports — AI Match Predictions",
    description:
      "Statistical football and basketball predictions with full market boards, refit after every matchday.",
    siteName: "SJ Sports",
    images: [{ url: "/visuals/hero.jpg", width: 1920, height: 1080 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "SJ Sports — AI Match Predictions",
    images: ["/visuals/hero.jpg"],
  },
};

export const viewport: Viewport = {
  themeColor: "#05070f",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        <Nav />
        <main className="mx-auto max-w-6xl px-4 pb-20">{children}</main>
        <footer className="border-t border-white/8 bg-black/30">
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-4 py-8 text-center">
            <div className="display text-xl tracking-wider">
              SJ<span className="text-cyan"> SPORTS</span>
            </div>
            <p className="max-w-md text-xs text-dim">
              Statistical match predictions powered by a Dixon-Coles Poisson
              engine, refit after every matchday. For information only — not
              betting advice.
            </p>
            <p className="text-[11px] text-dim/60">
              © {new Date().getFullYear()} SJ Sports
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
