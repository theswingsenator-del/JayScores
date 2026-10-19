"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  fetchFixture, fetchMarkets, fetchTeamForm, Fixture, isFinished, isLive,
  Markets, TeamForm,
} from "@/lib/api";
import { LiveBadge } from "@/components/Badges";
import CountUp from "@/components/CountUp";
import LockRing from "@/components/LockRing";
import MatchCenter from "@/components/MatchCenter";

const LOCK_MINUTE = Number(process.env.NEXT_PUBLIC_LIVE_LOCK_MINUTE ?? 70);

function FormDots({ form }: { form: TeamForm }) {
  const color = { W: "bg-lime/80", D: "bg-white/30", L: "bg-magenta/70" };
  return (
    <div className="flex gap-1.5">
      {form.recent.slice(0, 6).map((e) => (
        <span
          key={e.fixture_id}
          title={`${e.home ? "vs" : "@"} ${e.opponent} ${e.goals_for}-${e.goals_against}`}
          className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-black ${color[e.result]}`}
        >
          {e.result}
        </span>
      ))}
    </div>
  );
}

/** One market row: label, thin probability bar, percentage. */
function MarketRow({ label, prob, max }: { label: string; prob: number; max: number }) {
  const strong = prob === max && prob >= 0.5;
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="min-w-0 flex-1 truncate text-sm text-ink/90">{label}</span>
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/8">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${prob * 100}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className={`h-full rounded-full ${strong ? "bg-cyan" : "bg-cyan/45"}`}
        />
      </div>
      <span className={`w-12 text-right text-sm tabular-nums ${strong ? "font-bold text-cyan" : "text-dim"}`}>
        {(prob * 100).toFixed(0)}%
      </span>
    </div>
  );
}

function MarketsBoard({ markets }: { markets: Markets }) {
  return (
    <div className="mt-6">
      <h2 className="section-title display mb-3 text-2xl tracking-wider text-cyan">
        ALL MARKETS
      </h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {markets.groups.map((g, gi) => {
          const max = Math.max(...g.markets.map((m) => m.prob));
          return (
            <motion.div
              key={g.name}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: gi * 0.05, duration: 0.4 }}
              className="glass p-5"
            >
              <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-dim">
                {g.name}
              </div>
              <div className="divide-y divide-white/5">
                {g.markets.map((m) => (
                  <MarketRow key={m.label} label={m.label} prob={m.prob} max={max} />
                ))}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

export default function MatchClient({ id }: { id: number }) {
  const [fixture, setFixture] = useState<Fixture | null>(null);
  const [markets, setMarkets] = useState<Markets | null>(null);
  const [homeForm, setHomeForm] = useState<TeamForm | null>(null);
  const [awayForm, setAwayForm] = useState<TeamForm | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetchFixture(id)
        .then((f) => {
          if (!alive) return;
          setFixture(f);
          if (!homeForm) {
            fetchTeamForm(f.home.id).then((x) => alive && setHomeForm(x)).catch(() => {});
            fetchTeamForm(f.away.id).then((x) => alive && setAwayForm(x)).catch(() => {});
          }
          fetchMarkets(f.id).then((x) => alive && setMarkets(x)).catch(() => {});
        })
        .catch(() => alive && setError("Could not load match."));
    load();
    const t = setInterval(() => {
      // poll only while live and unlocked
      if (fixture && isLive(fixture) && !fixture.prediction?.is_locked) load();
    }, 30_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (error) return <div className="glass mt-10 p-8 text-center text-danger">{error}</div>;
  if (!fixture)
    return <div className="glass mt-10 h-72 animate-pulse" />;

  const p = fixture.prediction;
  const live = isLive(fixture);
  const done = isFinished(fixture);

  return (
    <div className="pt-6">
      <Link href="/" className="text-sm text-dim hover:text-cyan">← All fixtures</Link>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass relative mt-4 overflow-hidden p-6"
      >
        {/* Faint tunnel-walkout backdrop, fading into the card background */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/visuals/tunnel.jpg"
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-25"
          style={{
            maskImage: "linear-gradient(180deg, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 92%)",
            WebkitMaskImage: "linear-gradient(180deg, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 92%)",
          }}
        />
        <div className="relative flex items-center justify-between text-xs text-dim">
          <span>
            {new Date(fixture.date).toLocaleString(undefined, {
              weekday: "long", month: "long", day: "numeric",
              hour: "2-digit", minute: "2-digit",
            })}
          </span>
          <div className="flex items-center gap-3">
            {live && <LiveBadge locked={p?.is_locked} />}
            {done && <span className="rounded-full bg-white/8 px-2 py-0.5">FULL TIME</span>}
            {live && <LockRing minute={fixture.minute ?? 0} lockMinute={LOCK_MINUTE} size={56} />}
          </div>
        </div>

        <div className="relative mt-4 grid grid-cols-3 items-center">
          <div className="text-center">
            {fixture.home.logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={fixture.home.logo} alt="" className="mx-auto mb-2 h-16 w-16 object-contain" />
            )}
            <div className="text-lg font-bold">{fixture.home.name}</div>
            {homeForm && <div className="mt-2 flex justify-center"><FormDots form={homeForm} /></div>}
          </div>

          <div className="text-center">
            {(done || live) ? (
              <div className="display text-6xl text-glow-cyan md:text-7xl">
                {fixture.home_goals}–{fixture.away_goals}
              </div>
            ) : (
              <div className="display text-5xl text-dim">VS</div>
            )}
            {p && (
              <div className="mt-1 text-xs uppercase tracking-widest text-dim">
                model says{" "}
                <span className="display text-xl text-cyan">{p.likely_scoreline.replace("-", "–")}</span>
              </div>
            )}
          </div>

          <div className="text-center">
            {fixture.away.logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={fixture.away.logo} alt="" className="mx-auto mb-2 h-16 w-16 object-contain" />
            )}
            <div className="text-lg font-bold">{fixture.away.name}</div>
            {awayForm && <div className="mt-2 flex justify-center"><FormDots form={awayForm} /></div>}
          </div>
        </div>
      </motion.div>

      {/* Match Center */}
      {p && (
        <MatchCenter
          prediction={p}
          homeName={fixture.home.name}
          awayName={fixture.away.name}
          leagueId={fixture.league_id}
        />
      )}

      {/* Numbers strip */}
      {p && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5"
        >
          <div className="glass p-4 text-center">
            <div className="display text-3xl text-cyan">
              <CountUp value={p.p_home_win * 100} suffix="%" />
            </div>
            <div className="text-xs text-dim">Home win</div>
          </div>
          <div className="glass p-4 text-center">
            <div className="display text-3xl">
              <CountUp value={p.p_draw * 100} suffix="%" />
            </div>
            <div className="text-xs text-dim">Draw</div>
          </div>
          <div className="glass p-4 text-center">
            <div className="display text-3xl text-magenta">
              <CountUp value={p.p_away_win * 100} suffix="%" />
            </div>
            <div className="text-xs text-dim">Away win</div>
          </div>
          <div className="glass p-4 text-center">
            <div className="display text-3xl text-lime">
              <CountUp value={p.p_over25 * 100} suffix="%" />
            </div>
            <div className="text-xs text-dim">Over 2.5 goals</div>
          </div>
          <div className="glass p-4 text-center">
            <div className="display text-3xl text-amber">
              <CountUp value={p.p_btts * 100} suffix="%" />
            </div>
            <div className="text-xs text-dim">Both teams score</div>
          </div>
        </motion.div>
      )}

      {/* Full market board */}
      {p && markets && <MarketsBoard markets={markets} />}

      {!p && (
        <div className="glass mt-4 p-8 text-center text-dim">
          No prediction available for this fixture yet.
        </div>
      )}

      {p && (
        <div className="mt-3 text-right text-[11px] text-dim">
          model {p.model_version} · updated {new Date(p.ts).toLocaleString()}
          {p.is_live && !p.is_locked && " · live-updating"}
          {p.is_locked && ` · locked at ${LOCK_MINUTE}'`}
        </div>
      )}
    </div>
  );
}
