"use client";

import { motion } from "framer-motion";

/** Animated W/D/L probability bar with gradient segments. */
export default function ProbBar({
  home,
  draw,
  away,
  compact = false,
}: {
  home: number;
  draw: number;
  away: number;
  compact?: boolean;
}) {
  const pct = (v: number) => `${(v * 100).toFixed(0)}%`;
  return (
    <div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-white/5">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: pct(home) }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          className="bar-shimmer h-full"
          style={{
            background:
              "linear-gradient(90deg, #00e5ff, #38f9ff, #00e5ff)",
          }}
        />
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: pct(draw) }}
          transition={{ duration: 0.9, ease: "easeOut", delay: 0.1 }}
          className="h-full bg-white/25"
        />
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: pct(away) }}
          transition={{ duration: 0.9, ease: "easeOut", delay: 0.2 }}
          className="bar-shimmer h-full"
          style={{
            background:
              "linear-gradient(90deg, #ff2ec4, #ff6ad5, #ff2ec4)",
          }}
        />
      </div>
      {!compact && (
        <div className="mt-1.5 flex justify-between text-[11px] font-medium text-dim">
          <span>
            <span className="text-cyan">{pct(home)}</span> HOME
          </span>
          <span>{pct(draw)} DRAW</span>
          <span>
            AWAY <span className="text-magenta">{pct(away)}</span>
          </span>
        </div>
      )}
    </div>
  );
}
