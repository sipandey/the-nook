/**
 * The recurring rolling-hills-at-dawn motif from every screen in the design
 * canvas (design/mobile-flow/*.dc.html). Kept as one component so the shape
 * only needs tuning in one place.
 */

const SUN_X: Record<"left" | "center" | "right", number> = {
  left: 60,
  center: 150,
  right: 248,
};

export function HillsHero({
  height = 108,
  sunSide = "right",
  sunRadius = 22,
}: {
  height?: number;
  sunSide?: "left" | "center" | "right";
  sunRadius?: number;
}) {
  const sunCx = SUN_X[sunSide];
  const sunCy = Math.round(height * 0.26);

  return (
    <div style={{ height }} className="w-full flex-shrink-0 overflow-hidden">
      <svg
        viewBox={`0 0 300 ${height}`}
        width="100%"
        height={height}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="hills-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#eef1e4" />
            <stop offset="1" stopColor="#dbe6d3" />
          </linearGradient>
        </defs>
        <rect width="300" height={height} fill="url(#hills-sky)" />
        <circle cx={sunCx} cy={sunCy} r={sunRadius} fill="#f3e9c9" opacity={0.85} />
        <path
          d={`M0,${height * 0.7} C50,${height * 0.56} 90,${height * 0.8} 150,${height * 0.65} C210,${height * 0.5} 250,${height * 0.74} 300,${height * 0.61} L300,${height} L0,${height} Z`}
          fill="#a9c19f"
          opacity={0.85}
        />
        <path
          d={`M0,${height * 0.89} C60,${height * 0.78} 120,${height * 1.0} 180,${height * 0.85} C230,${height * 0.74} 270,${height * 0.96} 300,${height * 0.85} L300,${height} L0,${height} Z`}
          fill="#7c9b74"
        />
      </svg>
    </div>
  );
}
