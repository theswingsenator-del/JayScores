"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Fixture, isLive, isFinished } from "@/lib/api";
import ProbBar from "./ProbBar";
import { LiveBadge, StatChip } from "./Badges";

const LEAGUE_NAMES: Record<number, string> = {
  1: "World Cup",
  39: "Premier League",
  140: "La Liga",
};

function Crest({ src, name }: { src: string | null; name: string }) {
  if (!src)
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-xs font-bold">
        {name.slice(0, 2).toUpperCase()}
      </div>
    );
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={name} className="h-10 w-10 object-contain drop-shadow-[0_0_8px_rgba(255,255,255,0.15)]" />;
}

export default function FixtureCard({ fixture, index = 0 }: { fixture: Fixture; index?: number }) {
  const p = fixture.prediction;
  const live = isLive(fixture);
  const done = isFinished(fixture);

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: index * 0.05, ease: "easeOut" }}
    >
      <Link href={`/match/${fixture.id}`}>
        <div className="glass glass-hover cursor-pointer p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-y-1 text-xs text-dim">
            <span className="flex min-w-0 flex-wrap items-center gap-2">
              {LEAGUE_NAMES[fixture.league_id] && (
                <span className="rounded-full border border-cyan/25 bg-cyan/8 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-cyan/90">
                  {LEAGUE_NAMES[fixture.league_id]}
                </span>
              )}
              {new Date(fixture.date).toLocaleDateString(undefined, {
                weekday: "short", month: "short", day: "numeric",
              })}{" "}
              ·{" "}
              {new Date(fixture.date).toLocaleTimeString(undefined, {
                hour: "2-digit", minute: "2-digit",
              })}
            </span>
            {live && <LiveBadge locked={p?.is_locked} />}
            {done && <span className="rounded-full bg-white/8 px-2 py-0.5">FT</span>}
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <Crest src={fixture.home.logo} name={fixture.home.name} />
              <span className="truncate font-semibold">{fixture.home.name}</span>
            </div>

            <div className="text-center">
              {done || live ? (
                <div className="display text-3xl text-glow-cyan">
                  {fixture.home_goals}–{fixture.away_goals}
                </div>
              ) : (
                <div className="display text-3xl text-dim">VS</div>
              )}
              {p && (
                <div className="text-[10px] uppercase tracking-wider text-dim">
                  predicted <span className="font-bold text-cyan">{p.likely_scoreline.replace("-", "–")}</span>
                </div>
              )}
            </div>

            <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
              <span className="truncate text-right font-semibold">{fixture.away.name}</span>
              <Crest src={fixture.away.logo} name={fixture.away.name} />
            </div>
          </div>

          {p && (
            <div className="mt-4 space-y-3">
              <ProbBar home={p.p_home_win} draw={p.p_draw} away={p.p_away_win} />
              <div className="grid grid-cols-2 gap-2">
                <StatChip label="Over 2.5" value={`${(p.p_over25 * 100).toFixed(0)}%`} accent="lime" />
                <StatChip label="BTTS" value={`${(p.p_btts * 100).toFixed(0)}%`} accent="magenta" />
              </div>
            </div>
          )}
        </div>
      </Link>
    </motion.div>
  );
}
