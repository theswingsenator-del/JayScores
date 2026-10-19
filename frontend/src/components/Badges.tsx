"use client";

export function LiveBadge({ locked }: { locked?: boolean }) {
  if (locked)
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-400/10 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-amber">
        🔒 LOCKED
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/40 bg-red-500/10 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-danger">
      <span className="live-dot" /> LIVE — UPDATING
    </span>
  );
}

export function StatChip({
  label,
  value,
  accent = "cyan",
}: {
  label: string;
  value: string;
  accent?: "cyan" | "lime" | "magenta";
}) {
  const colors = {
    cyan: "text-cyan border-cyan/25 bg-cyan/5",
    lime: "text-lime border-lime/25 bg-lime/5",
    magenta: "text-magenta border-magenta/25 bg-magenta/5",
  };
  return (
    <div className={`rounded-lg border px-3 py-1.5 text-center ${colors[accent]}`}>
      <div className="text-[10px] uppercase tracking-wider text-dim">{label}</div>
      <div className="text-sm font-bold">{value}</div>
    </div>
  );
}

export function LeaguePill({
  name,
  active,
  onClick,
}: {
  name: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
        active
          ? "bg-cyan/15 text-cyan shadow-[0_0_20px_-6px_rgba(0,229,255,0.6)] border border-cyan/40"
          : "border border-white/10 text-dim hover:border-white/25 hover:text-ink"
      }`}
    >
      {name}
    </button>
  );
}
