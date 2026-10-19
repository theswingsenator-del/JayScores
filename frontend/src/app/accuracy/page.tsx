"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Accuracy, fetchAccuracy } from "@/lib/api";
import CountUp from "@/components/CountUp";

/** Simple SVG line chart — no chart lib needed. */
function LineChart({
  data,
  color,
  label,
}: {
  data: { x: string; y: number }[];
  color: string;
  label: string;
}) {
  const W = 640, H = 200, PAD = 34;
  if (data.length === 0) return null;
  const ys = data.map((d) => d.y);
  const yMin = Math.max(0, Math.min(...ys) - 0.08);
  const yMax = Math.min(1, Math.max(...ys) + 0.08);
  const px = (i: number) =>
    PAD + (i / Math.max(data.length - 1, 1)) * (W - 2 * PAD);
  const py = (v: number) => H - PAD - ((v - yMin) / (yMax - yMin || 1)) * (H - 2 * PAD);
  const path = data.map((d, i) => `${i ? "L" : "M"}${px(i)},${py(d.y)}`).join(" ");

  return (
    <div className="glass p-5">
      <div className="mb-2 text-sm font-semibold text-dim">{label}</div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        {[0.25, 0.5, 0.75].map((g) => {
          const gy = py(yMin + g * (yMax - yMin));
          return (
            <g key={g}>
              <line x1={PAD} x2={W - PAD} y1={gy} y2={gy} stroke="rgba(255,255,255,0.07)" />
            </g>
          );
        })}
        <motion.path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth={2.5}
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.4, ease: "easeOut" }}
          style={{ filter: `drop-shadow(0 0 6px ${color})` }}
        />
        {data.map((d, i) => (
          <g key={d.x}>
            <circle cx={px(i)} cy={py(d.y)} r={3.5} fill={color} />
            <text x={px(i)} y={H - 10} textAnchor="middle" fontSize={10} fill="#8b93ad">
              {d.x}
            </text>
            <text x={px(i)} y={py(d.y) - 10} textAnchor="middle" fontSize={10} fill="#eef2ff">
              {(d.y * 100).toFixed(0)}%
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export default function AccuracyPage() {
  const [acc, setAcc] = useState<Accuracy | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAccuracy().then(setAcc).catch(() => setError("Backend unreachable."));
  }, []);

  if (error) return <div className="glass mt-10 p-8 text-center text-danger">{error}</div>;
  if (!acc) return <div className="glass mt-10 h-72 animate-pulse" />;

  const latest = acc.points[acc.points.length - 1];

  return (
    <div className="relative pt-8">
      {/* Data-arena backdrop fading into the page background */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/visuals/arena.jpg"
        alt=""
        className="pointer-events-none absolute -inset-x-4 top-0 h-85 w-[calc(100%+2rem)] object-cover opacity-30"
        style={{
          maskImage: "linear-gradient(180deg, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 95%)",
          WebkitMaskImage: "linear-gradient(180deg, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 95%)",
        }}
      />
      <h1 className="display relative text-4xl md:text-5xl">
        MODEL <span className="text-cyan text-glow-cyan">ACCURACY</span>
      </h1>
      <p className="relative mt-2 max-w-2xl text-sm text-dim">
        Every finished match is scored against the model&apos;s final prediction.
        Each refit produces a new model version — this page tracks whether it
        keeps getting better.
      </p>

      <div className="relative mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="glass p-5 text-center">
          <div className="display text-4xl text-cyan">
            <CountUp value={(acc.overall_outcome_acc ?? 0) * 100} decimals={1} suffix="%" />
          </div>
          <div className="text-xs text-dim">W/D/L outcome accuracy</div>
        </div>
        <div className="glass p-5 text-center">
          <div className="display text-4xl text-lime">
            <CountUp value={(latest?.scoreline_acc ?? 0) * 100} decimals={1} suffix="%" />
          </div>
          <div className="text-xs text-dim">Exact scoreline</div>
        </div>
        <div className="glass p-5 text-center">
          <div className="display text-4xl text-magenta">
            <CountUp value={(latest?.over25_acc ?? 0) * 100} decimals={1} suffix="%" />
          </div>
          <div className="text-xs text-dim">Over 2.5 calls</div>
        </div>
        <div className="glass p-5 text-center">
          <div className="display text-4xl text-amber">
            <CountUp value={acc.total_evaluated} />
          </div>
          <div className="text-xs text-dim">Matches evaluated</div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <LineChart
          label="Outcome accuracy by month"
          color="#00e5ff"
          data={acc.points.map((p) => ({ x: p.period, y: p.outcome_acc }))}
        />
        <LineChart
          label="BTTS accuracy by month"
          color="#ff2ec4"
          data={acc.points.map((p) => ({ x: p.period, y: p.btts_acc }))}
        />
      </div>

      <p className="mt-4 text-xs text-dim">
        Note: predictions generated retrospectively on historical seasons are
        in-sample and read optimistic; live forward accuracy is the honest number
        once real matchdays flow in.
      </p>
    </div>
  );
}
