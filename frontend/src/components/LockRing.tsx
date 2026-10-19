"use client";

/** Countdown ring toward the lock minute (default 70'). */
export default function LockRing({
  minute,
  lockMinute = 70,
  size = 64,
}: {
  minute: number;
  lockMinute?: number;
  size?: number;
}) {
  const frac = Math.min(minute / lockMinute, 1);
  const r = size / 2 - 5;
  const c = 2 * Math.PI * r;
  const locked = minute >= lockMinute;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={4}
        />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke={locked ? "#fbbf24" : "#00e5ff"}
          strokeWidth={4}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
          strokeLinecap="round"
          style={{
            filter: `drop-shadow(0 0 6px ${locked ? "#fbbf24" : "#00e5ff"})`,
            transition: "stroke-dashoffset 1s ease",
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="display text-lg leading-none">{locked ? "🔒" : `${minute}'`}</span>
        {!locked && <span className="text-[9px] text-dim">→ {lockMinute}&apos;</span>}
      </div>
    </div>
  );
}
