"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import {
  BballGame, fetchBballGames, fetchBballLeagues, League,
} from "@/lib/api";
import { LeaguePill } from "@/components/Badges";

const BBALL_LIVE = new Set(["Q1", "Q2", "Q3", "Q4", "OT", "BT", "HT", "LIVE"]);
const isLive = (g: BballGame) => BBALL_LIVE.has(g.status);
const isDone = (g: BballGame) => ["FT", "AOT"].includes(g.status);

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

function WinBar({ home, away }: { home: number; away: number }) {
  return (
    <div>
      <div className="flex h-2 overflow-hidden rounded-full bg-white/8">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${home * 100}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="bg-cyan"
        />
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${away * 100}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="bg-magenta"
        />
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-dim">
        <span className="text-cyan">{(home * 100).toFixed(0)}%</span>
        <span className="text-magenta">{(away * 100).toFixed(0)}%</span>
      </div>
    </div>
  );
}

function GameCard({ game, index }: { game: BballGame; index: number }) {
  const p = game.prediction;
  const live = isLive(game);
  const done = isDone(game);
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: index * 0.04, ease: "easeOut" }}
    >
      <div className="glass glass-hover p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-y-1 text-xs text-dim">
          <span className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="rounded-full border border-amber/25 bg-amber/8 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber/90">
              {game.league_name}
            </span>
            {new Date(game.date).toLocaleDateString(undefined, {
              weekday: "short", month: "short", day: "numeric",
            })}{" "}
            ·{" "}
            {new Date(game.date).toLocaleTimeString(undefined, {
              hour: "2-digit", minute: "2-digit",
            })}
          </span>
          {live && (
            <span className="flex items-center gap-1.5 text-danger">
              <span className="live-dot" /> LIVE
            </span>
          )}
          {done && <span className="rounded-full bg-white/8 px-2 py-0.5">FT</span>}
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Crest src={game.home.logo} name={game.home.name} />
            <span className="truncate font-semibold">{game.home.name}</span>
          </div>

          <div className="text-center">
            {done || live ? (
              <div className="display text-3xl text-glow-cyan">
                {game.home_pts}–{game.away_pts}
              </div>
            ) : (
              <div className="display text-3xl text-dim">VS</div>
            )}
            {p && (
              <div className="text-[10px] uppercase tracking-wider text-dim">
                predicted{" "}
                <span className="font-bold text-cyan">
                  {Math.round(p.exp_home_pts)}–{Math.round(p.exp_away_pts)}
                </span>
              </div>
            )}
          </div>

          <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
            <span className="truncate text-right font-semibold">{game.away.name}</span>
            <Crest src={game.away.logo} name={game.away.name} />
          </div>
        </div>

        {p && (
          <div className="mt-4 space-y-2">
            <WinBar home={p.p_home_win} away={p.p_away_win} />
            <div className="flex justify-center gap-2 text-xs">
              <span className="rounded-lg bg-white/5 px-3 py-1 text-dim">
                Projected total{" "}
                <span className="font-bold text-amber">{Math.round(p.exp_total)}</span> pts
              </span>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function BasketballPage() {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [league, setLeague] = useState<number | undefined>(undefined);
  const [games, setGames] = useState<BballGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchBballLeagues().then(setLeagues).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchBballGames(league)
      .then(setGames)
      .catch(() => setError("Backend unreachable. Is the API running?"))
      .finally(() => setLoading(false));
  }, [league]);

  const upcoming = games
    .filter((g) => isLive(g) || (!isDone(g) && new Date(g.date) >= new Date(Date.now() - 4 * 3600e3)))
    .sort((a, b) => +new Date(a.date) - +new Date(b.date));
  const results = games
    .filter((g) => !upcoming.includes(g) && isDone(g))
    .sort((a, b) => +new Date(b.date) - +new Date(a.date));

  return (
    <div>
      {/* Hero strip */}
      <section className="relative -mx-4 mb-10 h-70 overflow-hidden md:h-80">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/visuals/court.jpg"
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(5,7,15,0.55) 0%, rgba(5,7,15,0.2) 45%, rgba(5,7,15,0.85) 100%)",
          }}
        />
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-8 text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="display text-4xl leading-none md:text-6xl"
          >
            BASKETBALL <span className="text-amber" style={{ textShadow: "0 0 18px rgba(251,191,36,0.5)" }}>PREDICTIONS</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="mt-2 max-w-xl px-4 text-sm text-dim"
          >
            Team-strength ratings model — projected scores, win probability and
            totals for the NBA, WNBA and FIBA World Cup qualifiers.
          </motion.p>
        </div>
      </section>

      {/* League filter */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <LeaguePill name="All" active={league === undefined} onClick={() => setLeague(undefined)} />
        {leagues.map((l) => (
          <LeaguePill key={l.id} name={l.name} active={league === l.id} onClick={() => setLeague(l.id)} />
        ))}
      </div>

      {error && (
        <div className="glass border-danger/30 p-6 text-center text-danger">{error}</div>
      )}
      {loading && !error && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass h-48 animate-pulse" />
          ))}
        </div>
      )}
      {!loading && !error && (
        <>
          {upcoming.length > 0 && (
            <>
              <h2 className="section-title display mb-3 text-2xl tracking-wider text-cyan">
                UPCOMING &amp; LIVE
              </h2>
              <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2">
                {upcoming.map((g, i) => (
                  <GameCard key={g.id} game={g} index={i} />
                ))}
              </div>
            </>
          )}
          {results.length > 0 && (
            <>
              <h2 className="section-title display mb-3 text-2xl tracking-wider text-dim">
                RECENT RESULTS
              </h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {results.map((g, i) => (
                  <GameCard key={g.id} game={g} index={i} />
                ))}
              </div>
            </>
          )}
          {upcoming.length === 0 && results.length === 0 && (
            <div className="glass p-10 text-center">
              <div className="display text-2xl tracking-wider text-dim">
                NO GAMES RIGHT NOW
              </div>
              <p className="mt-2 text-sm text-dim">
                This league is between game days — check back soon.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
