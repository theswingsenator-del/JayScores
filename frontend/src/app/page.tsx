"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Accuracy, fetchAccuracy, fetchFixtures, fetchLeagues, Fixture, isFinished,
  isLive, League,
} from "@/lib/api";
import FixtureCard from "@/components/FixtureCard";
import { LeaguePill } from "@/components/Badges";
import CountUp from "@/components/CountUp";
import { LazyStadium, use3DCapable } from "@/components/three/Lazy3D";

export default function Home() {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [league, setLeague] = useState<number | undefined>(undefined);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [acc, setAcc] = useState<Accuracy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [glLost, setGlLost] = useState(false);
  const capable3D = use3DCapable() && !glLost;

  useEffect(() => {
    fetchLeagues().then(setLeagues).catch(() => {});
    fetchAccuracy().then(setAcc).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchFixtures(league)
      .then(setFixtures)
      .catch(() => setError("Backend unreachable. Is the API running?"))
      .finally(() => setLoading(false));
  }, [league]);

  return (
    <div>
      {/* Hero */}
      <section className="relative -mx-4 mb-0 h-105 overflow-hidden md:h-120">
        {/* Cinematic backdrop: video on desktop, still frame on mobile/2D */}
        {capable3D ? (
          <video
            className="absolute inset-0 h-full w-full object-cover"
            src="/visuals/hero.mp4"
            poster="/visuals/hero.jpg"
            autoPlay
            muted
            loop
            playsInline
          />
        ) : (
          <img
            src="/visuals/hero.jpg"
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        {/* Legibility gradient over the backdrop, under the 3D scene */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(5,7,15,0.55) 0%, rgba(5,7,15,0.15) 45%, rgba(5,7,15,0.82) 100%)",
          }}
        />
        {capable3D && (
          <div className="absolute inset-0">
            <LazyStadium onContextLost={() => setGlLost(true)} />
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-end pb-10 text-center">
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="display text-5xl leading-none md:text-7xl"
          >
            PREDICT THE <span className="text-cyan text-glow-cyan">GAME</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35, duration: 0.7 }}
            className="mt-3 max-w-xl px-4 text-sm text-dim md:text-base"
          >
            Dixon-Coles Poisson engine. Scorelines, win probability, Over 2.5
            &amp; BTTS — refit after every matchday, live-updated in play.
          </motion.p>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.55, duration: 0.7 }}
            className="pointer-events-auto mt-5 flex gap-3"
          >
            <a
              href="#fixtures"
              className="rounded-full bg-cyan px-6 py-2.5 text-sm font-bold text-black shadow-[0_0_24px_rgba(0,229,255,0.45)] transition-transform hover:scale-105"
            >
              Today&apos;s predictions
            </a>
            <a
              href="/accuracy"
              className="rounded-full border border-white/20 bg-white/5 px-6 py-2.5 text-sm font-semibold text-ink backdrop-blur transition-colors hover:border-cyan/50 hover:text-cyan"
            >
              Model accuracy
            </a>
          </motion.div>
        </div>
      </section>

      {/* Live model ticker */}
      <div className="relative -mx-4 mb-10 border-y border-white/8 bg-black/40 px-4 backdrop-blur-sm">
        <div className="mx-auto grid max-w-4xl grid-cols-2 divide-x divide-white/8 py-4 text-center md:grid-cols-4">
          <div className="px-2">
            <div className="display text-2xl text-cyan md:text-3xl">
              <CountUp value={acc?.total_evaluated ?? 0} />
            </div>
            <div className="text-[10px] uppercase tracking-wider text-dim">Matches analyzed</div>
          </div>
          <div className="px-2">
            <div className="display text-2xl text-lime md:text-3xl">
              <CountUp value={(acc?.overall_outcome_acc ?? 0) * 100} decimals={1} suffix="%" />
            </div>
            <div className="text-[10px] uppercase tracking-wider text-dim">Outcome accuracy</div>
          </div>
          <div className="px-2 pt-3 md:pt-0">
            <div className="display text-2xl text-amber md:text-3xl">6</div>
            <div className="text-[10px] uppercase tracking-wider text-dim">Competitions covered</div>
          </div>
          <div className="px-2 pt-3 md:pt-0">
            <div className="display text-2xl text-magenta md:text-3xl">24/7</div>
            <div className="text-[10px] uppercase tracking-wider text-dim">Auto-refit engine</div>
          </div>
        </div>
      </div>

      {/* League filter */}
      <div id="fixtures" className="mb-6 flex flex-wrap items-center gap-2 scroll-mt-24">
        <LeaguePill name="All" active={league === undefined} onClick={() => setLeague(undefined)} />
        {leagues.map((l) => (
          <LeaguePill key={l.id} name={l.name} active={league === l.id} onClick={() => setLeague(l.id)} />
        ))}
      </div>

      {/* League banner (leagues with generated artwork) */}
      {league !== undefined && [39, 140, 1].includes(league) && (
        <motion.div
          key={league}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative mb-6 h-28 overflow-hidden rounded-2xl md:h-40"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/visuals/league-${league}.jpg`}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(90deg, rgba(5,7,15,0.85) 0%, rgba(5,7,15,0.2) 55%, rgba(5,7,15,0.55) 100%)",
            }}
          />
          <div className="absolute inset-0 flex items-center px-6">
            <span className="display text-3xl tracking-wider md:text-4xl">
              {leagues.find((l) => l.id === league)?.name?.toUpperCase()}
            </span>
          </div>
        </motion.div>
      )}

      {/* Fixture grid */}
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
      {!loading && !error && (() => {
        const upcoming = fixtures
          .filter((f) => isLive(f) || (!isFinished(f) && new Date(f.date) >= new Date(Date.now() - 3 * 3600e3)))
          .sort((a, b) => +new Date(a.date) - +new Date(b.date));
        // Historical seasons stay in the DB as model training data — the UI
        // only surfaces results from the last 10 days.
        const results = fixtures
          .filter((f) => !upcoming.includes(f) && +new Date(f.date) >= Date.now() - 10 * 86400e3)
          .sort((a, b) => +new Date(b.date) - +new Date(a.date));
        const spotlight = upcoming.find((f) => f.prediction) ?? upcoming[0];
        const rest = upcoming.filter((f) => f !== spotlight);
        return (
          <>
            {/* Match of the Day spotlight */}
            {spotlight && (
              <Link href={`/match/${spotlight.id}`}>
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className="glass glass-hover relative mb-8 overflow-hidden"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/visuals/tunnel.jpg"
                    alt=""
                    className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-30"
                    style={{
                      maskImage: "linear-gradient(90deg, rgba(0,0,0,1), rgba(0,0,0,0.2))",
                      WebkitMaskImage: "linear-gradient(90deg, rgba(0,0,0,1), rgba(0,0,0,0.2))",
                    }}
                  />
                  <div className="relative p-6 md:p-8">
                    <div className="mb-4 flex items-center gap-2">
                      <span className="rounded-full bg-cyan/15 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-cyan">
                        {isLive(spotlight) ? "Live now" : "Match of the day"}
                      </span>
                      <span className="text-xs text-dim">
                        {new Date(spotlight.date).toLocaleString(undefined, {
                          weekday: "long", hour: "2-digit", minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex min-w-0 flex-1 flex-col items-center gap-2 md:flex-row md:gap-4">
                        {spotlight.home.logo && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={spotlight.home.logo} alt="" className="h-14 w-14 object-contain md:h-20 md:w-20" />
                        )}
                        <span className="display truncate text-xl md:text-3xl">{spotlight.home.name}</span>
                      </div>
                      <div className="shrink-0 text-center">
                        {spotlight.prediction ? (
                          <>
                            <div className="display text-5xl md:text-6xl">
                              <span className="text-cyan text-glow-cyan">{spotlight.prediction.likely_scoreline.split("-")[0]}</span>
                              <span className="mx-1.5 text-dim">–</span>
                              <span className="text-magenta text-glow-magenta">{spotlight.prediction.likely_scoreline.split("-")[1]}</span>
                            </div>
                            <div className="mt-1 text-[10px] uppercase tracking-widest text-dim">model prediction</div>
                          </>
                        ) : (
                          <div className="display text-5xl text-dim">VS</div>
                        )}
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col items-center gap-2 md:flex-row-reverse md:gap-4">
                        {spotlight.away.logo && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={spotlight.away.logo} alt="" className="h-14 w-14 object-contain md:h-20 md:w-20" />
                        )}
                        <span className="display truncate text-xl md:text-3xl">{spotlight.away.name}</span>
                      </div>
                    </div>
                    <div className="mt-5 text-center">
                      <span className="inline-block rounded-full bg-cyan px-5 py-2 text-xs font-bold text-black shadow-[0_0_20px_rgba(0,229,255,0.4)]">
                        Full analysis &amp; all markets →
                      </span>
                    </div>
                  </div>
                </motion.div>
              </Link>
            )}

            {rest.length > 0 && (
              <>
                <h2 className="section-title display mb-3 text-2xl tracking-wider text-cyan">
                  UPCOMING &amp; LIVE
                </h2>
                <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2">
                  {rest.map((f, i) => (
                    <FixtureCard key={f.id} fixture={f} index={i} />
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
                  {results.map((f, i) => (
                    <FixtureCard key={f.id} fixture={f} index={i} />
                  ))}
                </div>
              </>
            )}
            {upcoming.length === 0 && results.length === 0 && (
              <div className="glass p-10 text-center">
                <div className="display text-2xl tracking-wider text-dim">
                  NO MATCHES RIGHT NOW
                </div>
                <p className="mt-2 text-sm text-dim">
                  {league !== undefined
                    ? "This league is between matchdays — the World Cup is live in the meantime."
                    : "Check back soon — new fixtures load daily."}
                </p>
                {league !== undefined && league !== 1 && (
                  <button
                    onClick={() => setLeague(1)}
                    className="mt-4 rounded-full bg-cyan/15 px-5 py-2 text-sm font-semibold text-cyan transition-colors hover:bg-cyan/25"
                  >
                    See World Cup predictions →
                  </button>
                )}
              </div>
            )}
          </>
        );
      })()}
    </div>
  );
}
