"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "./Logo";

const links = [
  { href: "/", label: "Football" },
  { href: "/basketball", label: "Basketball" },
  { href: "/accuracy", label: "Accuracy" },
];

export default function Nav() {
  const path = usePathname();
  return (
    <nav className="sticky top-0 z-50 border-b border-white/8 bg-[#05070f]/75 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-2.5">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <Logo />
          <span className="display hidden text-2xl leading-none tracking-wider sm:block">
            SJ<span className="text-cyan text-glow-cyan"> SPORTS</span>
          </span>
        </Link>
        <div className="flex items-center gap-0.5 sm:gap-1">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-full px-3 py-1.5 text-[13px] transition-colors sm:px-4 sm:text-sm ${
                path === l.href
                  ? "bg-cyan/15 font-semibold text-cyan"
                  : "text-dim hover:text-ink"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
