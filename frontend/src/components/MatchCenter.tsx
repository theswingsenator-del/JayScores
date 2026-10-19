"use client";

import { motion } from "framer-motion";
import { Prediction } from "@/lib/api";
import CountUp from "./CountUp";

/** Animated three-segment win-probability donut. */
function WinDonut({ home, draw, away }: { home: number; draw: number; away: number }) {
  const R = 64;
  const C = 2 * Math.PI * R;
  const gap = 0.012; // small visual gap between segments
  const segs = [
    { v: Math.max(home - gap, 0), color: "#00e5ff", off: 0 },
    { v: Math.max(draw - gap, 0), color: "rgba(255,255,255,0.35)", off: home },
    { v: Math.max(away - gap, 0), color: "#ff2ec4", off: home + draw },
  ];
  const best = Math.max(home, draw, away);
  const bestLabel = best === home ? "HOME" : best === draw ? "DRAW" : "AWAY";
  const bestColor = best === home ? "#00e5ff" : best === draw ? "#ffffff" : "#ff2ec4";

  return (
    <div className="relative mx-auto h-44 w-44">
      <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90">
        <circle cx="80" cy="80" r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="13" />
        {segs.map((s, i) => (
          <motion.circle
            key={i}
            cx="80"
            cy="80"
            r={R}
            fill="none"
            stroke={s.color}
            strokeWidth="13"
            strokeLinecap="round"
            strokeDasharray={`${s.v * C} ${C}`}
            initial={{ strokeDashoffset: C * 0.25 }}
            animate={{ strokeDashoffset: -s.off * C }}
            transition={{ duration: 1.1, ease: "easeOut", delay: 0.15 }}
            style={{ filter: `drop-shadow(0 0 6px ${s.color})` }}
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="display text-4xl" style={{ color: bestColor, textShadow: `0 0 16px ${bestColor}66` }}>
          <CountUp value={best * 100} suffix="%" />
        </div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-dim">{bestLabel}</div>
      </div>
    </div>
  );
}

/** Center-out expected-goals duel bar. */
function XgDuel({ home, away, homeName, awayName }: {
  home: number; away: number; homeName: string; awayName: string;
}) {
  const total = home + away || 1;
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between text-xs">
        <span className="font-semibold text-cyan">{home.toFixed(2)} xG</span>
        <span className="text-[10px] uppercase tracking-[0.25em] text-dim">expected goals</span>
        <span className="font-semibold text-magenta">{away.toFixed(2)} xG</span>
      </div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-white/8">
        <motion.div
          initial={{ width: "50%" }}
          animate={{ width: `${(home / total) * 100}%` }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          className="rounded-l-full bg-gradient-to-r from-cyan/50 to-cyan"
          style={{ boxShadow: "0 0 10px rgba(0,229,255,0.5)" }}
        />
        <motion.div
          initial={{ width: "50%" }}
          animate={{ width: `${(away / total) * 100}%` }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          className="rounded-r-full bg-gradient-to-l from-magenta/50 to-magenta"
          style={{ boxShadow: "0 0 10px rgba(255,46,196,0.5)" }}
        />
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-dim">
        <span className="max-w-[45%] truncate">{homeName}</span>
        <span className="max-w-[45%] truncate text-right">{awayName}</span>
      </div>
    </div>
  );
}

function StatDial({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex-1 rounded-xl bg-white/4 px-3 py-2.5 text-center">
      <div className="display text-2xl" style={{ color, textShadow: `0 0 12px ${color}55` }}>
        <CountUp value={value * 100} suffix="%" />
      </div>
      <div className="text-[10px] uppercase tracking-wider text-dim">{label}</div>
    </div>
  );
}

export default function MatchCenter({
  prediction: p, homeName, awayName, leagueId,
}: {
  prediction: Prediction;
  homeName: string;
  awayName: string;
  leagueId: number;
}) {
  const backdrop = [39, 140, 1].includes(leagueId) ? `/visuals/league-${leagueId}.jpg` : "/visuals/league-39.jpg";
  const [hs, as] = p.likely_scoreline.split("-");

  return (
    <div className="glass relative mt-4 overflow-hidden">
      {/* Aerial pitch backdrop fading into the card */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={backdrop}
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-20"
        style={{
          maskImage: "radial-gradient(120% 100% at 50% 0%, rgba(0,0,0,1), rgba(0,0,0,0.15))",
          WebkitMaskImage: "radial-gradient(120% 100% at 50% 0%, rgba(0,0,0,1), rgba(0,0,0,0.15))",
        }}
      />
      <div className="relative grid gap-8 p-6 md:grid-cols-3 md:gap-6 md:p-8">
        {/* Win probability */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center justify-center"
        >
          <div className="mb-3 text-[10px] uppercase tracking-[0.3em] text-dim">Win probability</div>
          <WinDonut home={p.p_home_win} draw={p.p_draw} away={p.p_away_win} />
          <div className="mt-3 flex gap-4 text-[11px]">
            <span className="flex items-center gap-1.5 text-dim">
              <span className="h-2 w-2 rounded-full bg-cyan" /> Home {(p.p_home_win * 100).toFixed(0)}%
            </span>
            <span className="flex items-center gap-1.5 text-dim">
              <span className="h-2 w-2 rounded-full bg-white/40" /> Draw {(p.p_draw * 100).toFixed(0)}%
            </span>
            <span className="flex items-center gap-1.5 text-dim">
              <span className="h-2 w-2 rounded-full bg-magenta" /> Away {(p.p_away_win * 100).toFixed(0)}%
            </span>
          </div>
        </motion.div>

        {/* Predicted scoreline + xG */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="flex flex-col items-center justify-center gap-5"
        >
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-[0.3em] text-dim">Most likely score</div>
            <div className="display mt-1 text-7xl leading-none md:text-8xl">
              <span className="text-cyan text-glow-cyan">{hs}</span>
              <span className="mx-2 text-dim">–</span>
              <span className="text-magenta text-glow-magenta">{as}</span>
            </div>
          </div>
          <div className="w-full max-w-xs">
            <XgDuel
              home={p.pred_home_goals}
              away={p.pred_away_goals}
              homeName={homeName}
              awayName={awayName}
            />
          </div>
        </motion.div>

        {/* Key dials */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="flex flex-col justify-center gap-3"
        >
          <div className="text-center text-[10px] uppercase tracking-[0.3em] text-dim md:text-left">
            Key markets
          </div>
          <div className="flex gap-3">
            <StatDial label="Over 2.5 goals" value={p.p_over25} color="#a3e635" />
            <StatDial label="Both teams score" value={p.p_btts} color="#fbbf24" />
          </div>
          <div className="flex gap-3">
            <StatDial label="Under 2.5 goals" value={1 - p.p_over25} color="#8b93ad" />
            <StatDial
              label="Draw no bet · home"
              value={p.p_home_win + p.p_away_win > 0 ? p.p_home_win / (p.p_home_win + p.p_away_win) : 0.5}
              color="#00e5ff"
            />
          </div>
        </motion.div>
      </div>
    </div>
  );
}
