/** Hand-drawn SJ Sports crest — hexagonal club badge with a speed slash.
 * Inline SVG so it stays razor sharp at any size and inherits page fonts. */
export default function Logo({ size = 38 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden
      style={{ filter: "drop-shadow(0 0 10px rgba(0,229,255,0.35))" }}
    >
      <defs>
        <linearGradient id="sjg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#00e5ff" />
          <stop offset="1" stopColor="#ff2ec4" />
        </linearGradient>
      </defs>
      {/* hex crest */}
      <path
        d="M24 2.5 L43 13 v22 L24 45.5 L5 35 V13 Z"
        fill="rgba(10,14,28,0.9)"
        stroke="url(#sjg)"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      {/* speed slash cutting behind the letters */}
      <path d="M9 31 L39 17" stroke="url(#sjg)" strokeWidth="1.4" opacity="0.5" />
      <text
        x="24"
        y="30.5"
        textAnchor="middle"
        fontFamily="'Bebas Neue','Arial Narrow',sans-serif"
        fontSize="19"
        letterSpacing="1"
        fill="#eef2ff"
      >
        SJ
      </text>
    </svg>
  );
}
