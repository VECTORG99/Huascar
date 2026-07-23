"use client";

/**
 * Minimalist spaceship: circle intersected with a diamond (rotated square).
 * Centered in the real viewport, fixed, white with subtle neon glow.
 * Sits behind text/content (z-5) but in front of stars/meteors (z-0),
 * so cards visually occlude it while it stays above the background.
 * Rolls slowly and continuously for a subtle "alive" feel.
 */
export function Spaceship() {
  return (
    <div
      className="pointer-events-none fixed left-1/2 top-1/2 z-[5] -translate-x-1/2 -translate-y-1/2 opacity-50 mix-blend-screen"
      aria-hidden="true"
    >
      {/* Outer neon pulse */}
      <div className="absolute -inset-3 animate-[pulse_3s_ease-in-out_infinite] rounded-full bg-white/[0.05] blur-md" />

      {/* Rolling container */}
      <div className="relative h-10 w-10 animate-[spin_18s_linear_infinite]">
        {/* Circle */}
        <div className="absolute inset-1 rounded-full border border-white/70 bg-white/[0.06] shadow-[0_0_14px_rgba(255,255,255,0.4),0_0_28px_rgba(255,255,255,0.15)]" />

        {/* Diamond (rotated square) */}
        <div className="absolute inset-0 rotate-45 border border-white/50 bg-white/[0.04] shadow-[0_0_10px_rgba(255,255,255,0.25)]" />

        {/* Core dot */}
        <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8),0_0_16px_rgba(255,255,255,0.4)]" />
      </div>
    </div>
  );
}
