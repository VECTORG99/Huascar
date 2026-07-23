"use client";

import { useEffect, useRef } from "react";
import {
  type GravityWell,
  gravityEffect,
  lensPoint,
  sampleDisk,
  sampleSecondaryImage,
} from "../lib/space-physics";

// ─── Config ───────────────────────────────────────────────────────────────────

const STAR_COUNT = 350;
const METEOR_COUNT = 22;
const METEOR_SPAWN_RATE = 0.12;
const CHAR_SET = ["0", "1"];
const CHAR_SPACING = 14;

// Disk tilt: how squashed the ellipse is (0 = edge-on line, 1 = face-on).
// A small non-zero tilt lets the far side peek above/below the shadow,
// like real renders of Sgr A*/M87*, without losing the edge-on silhouette.
const DISK_TILT = 0.34;
const DISK_SAMPLES = 220;
const SECONDARY_SAMPLES = 90;

// ─── Types ────────────────────────────────────────────────────────────────────

interface Star {
  ox: number; // original x
  oy: number; // original y
  baseRadius: number;
  baseOpacity: number;
  twinklePhase: number;
  twinkleSpeed: number;
}

interface MeteorChar {
  char: string;
  offset: number;
}

interface Meteor {
  x: number;
  y: number;
  vx: number;
  vy: number;
  chars: MeteorChar[];
  hue: number;
  hueSpeed: number;
  opacity: number;
  fontSize: number;
  life: number;
  maxLife: number;
  absorbed: boolean;
  stretch: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function randomChar() {
  return CHAR_SET[Math.floor(Math.random() * CHAR_SET.length)];
}

function clampOpacity(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function createStar(width: number, height: number): Star {
  return {
    ox: Math.random() * width,
    oy: Math.random() * height,
    baseRadius: Math.random() * 1.4 + 0.4,
    baseOpacity: Math.random() * 0.5 + 0.35,
    twinklePhase: Math.random() * Math.PI * 2,
    twinkleSpeed: Math.random() * 0.0015 + 0.0006,
  };
}

function createMeteor(width: number, height: number): Meteor {
  const angle = Math.PI * 0.28 + Math.random() * 0.12;
  const speed = Math.random() * 10 + 8;
  const trailLength = Math.floor(Math.random() * 9) + 9;
  return {
    x: Math.random() * width * 1.3 - width * 0.15,
    y: -60,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    chars: Array.from({ length: trailLength }, (_, i) => ({
      char: randomChar(),
      offset: i * CHAR_SPACING,
    })),
    hue: Math.random() * 360,
    hueSpeed: Math.random() * 6 + 3,
    opacity: Math.random() * 0.35 + 0.55,
    fontSize: Math.random() * 6 + 11,
    life: 0,
    maxLife: Math.random() * 55 + 40,
    absorbed: false,
    stretch: 0,
  };
}

export function SpaceSimulation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const accretionEnergyRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };
    resize();
    window.addEventListener("resize", resize);

    // Black hole well anchored near the very top of the viewport. Sized to
    // dominate the frame like a real horizon-scale render rather than a
    // Black hole well anchored dead-center on screen. Sized to dominate
    // the frame like a real horizon-scale render rather than a small
    // decorative icon. It never moves — no scroll offset is ever applied
    // to `well`.
    const well: GravityWell = {
      x: width * 0.5,
      y: height * 0.5,
      eventRadius: Math.min(width, height) * 0.16,
      photonRadius: Math.min(width, height) * 0.205,
      influenceRadius: Math.min(width, height) * 0.75,
    };

    // Parallax scroll offset: stars and meteors drift with scroll to feel
    // like the frame is opening up more space as the user scrolls down,
    // while the black hole itself stays perfectly still on screen.
    const scrollContainer = document.getElementById("space-scroll-container");
    let scrollY = 0;
    const handleScroll = () => {
      scrollY = scrollContainer ? scrollContainer.scrollTop : window.scrollY;
    };
    scrollContainer?.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    const STAR_PARALLAX = 0.18;
    const METEOR_PARALLAX = 0.35;
    let lastScrollY = 0;
    let scrollVelocity = 0;

    const stars: Star[] = Array.from({ length: STAR_COUNT }, () =>
      createStar(width, height)
    );
    const meteors: Meteor[] = [];

    const animate = () => {
      ctx.fillStyle = "rgba(0, 0, 0, 1)";
      ctx.fillRect(0, 0, width, height);

      // ─── Stars with gravitational lensing ──────────────────────────────
      // Stars drift downward with a fraction of scroll (parallax), wrapping
      // around infinitely in Y so the field never runs out while scrolling.
      const starOffset = scrollY * STAR_PARALLAX;
      // Light consumption is driven by active scroll *motion*, not by
      // scroll position: it spikes while the user is scrolling (up or
      // down, transitioning between phases) and decays back to 0 quickly
      // once the scroll settles, restoring the calm baseline canvas.
      const rawScrollDelta = Math.abs(scrollY - lastScrollY);
      lastScrollY = scrollY;
      scrollVelocity = Math.max(rawScrollDelta, scrollVelocity * 0.9);
      const lightConsumption = clampOpacity(scrollVelocity / 40);

      for (const star of stars) {
        star.twinklePhase += star.twinkleSpeed * 16;
        const twinkle = Math.sin(star.twinklePhase);
        const baseOp = star.baseOpacity * (0.35 + Math.abs(twinkle) * 0.65);
        const baseR = star.baseRadius * (0.75 + Math.abs(twinkle) * 0.5);

        const wrappedY =
          ((star.oy + starOffset) % height + height) % height;

        const lensed = lensPoint(
          { x: star.ox, y: wrappedY },
          well
        );

        if (!lensed.visible) continue;

        const r = baseR * (1 + lensed.tangentialStretch * 0.8);
        const nearRing = Math.min(1, lensed.tangentialStretch);
        // Ambient stars that blend faintly into the background dim further
        // while light is being actively consumed by scroll motion.
        const ambientDamp = 1 - lightConsumption * 0.55 * (1 - nearRing);
        const op = baseOp * lensed.brightness * ambientDamp;

        // How much this star has dissolved into the ring: only engages
        // near the photon band, and only while actively scrolling.
        const dissolve = nearRing * lightConsumption;

        if (dissolve > 0.05) {
          // Merge into the black hole: draw a curved arc that follows the
          // same circular geometry as the photon ring (not a straight line
          // toward the center) — as the star dissolves, the arc's radius
          // eases toward the ring's radius and its angular length grows,
          // so it reads as the star's light being smeared along the
          // horizon's curve and becoming one with the ring.
          const angle = Math.atan2(lensed.y - well.y, lensed.x - well.x);
          const starDistance = Math.hypot(lensed.x - well.x, lensed.y - well.y);
          const arcRadius =
            starDistance + (well.photonRadius - starDistance) * dissolve;
          const arcHalfSpan = 0.05 + dissolve * 0.5; // radians, grows as it merges
          const arcSegments = 16;
          const lineOpBase = op * (0.5 + dissolve * 1.1);
          ctx.lineCap = "butt";

          for (let seg = 0; seg < arcSegments; seg++) {
            const t0 = seg / arcSegments;
            const t1 = (seg + 1) / arcSegments;
            // Centered on the star's angle, sweeping symmetrically.
            const a0 = angle + (t0 - 0.5) * 2 * arcHalfSpan;
            const a1 = angle + (t1 - 0.5) * 2 * arcHalfSpan;
            const sx = well.x + Math.cos(a0) * arcRadius;
            const sy = well.y + Math.sin(a0) * arcRadius;
            const ex = well.x + Math.cos(a1) * arcRadius;
            const ey = well.y + Math.sin(a1) * arcRadius;
            // Brightest at the star's own angle (t=0.5), fading toward the
            // tips of the arc so it blends smoothly into the ring.
            const edgeFade = 1 - Math.abs(t0 - 0.5) * 2;
            const segOpacity = lineOpBase * edgeFade * dissolve;
            if (segOpacity < 0.02) continue;
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(ex, ey);
            ctx.strokeStyle = `rgba(255, 255, 255, ${clampOpacity(segOpacity)})`;
            ctx.lineWidth = Math.max(0.5, r * 0.5 * (0.5 + dissolve * 0.5));
            ctx.stroke();
          }

          // The star point itself shrinks and fades as it merges into the
          // arc, then grows back to full size as it exits (dissolve → 0).
          const pointOpacity = op * (1 - dissolve);
          const pointRadius = r * (1 - dissolve * 0.85);
          if (pointOpacity > 0.02 && pointRadius > 0.15) {
            ctx.beginPath();
            ctx.arc(lensed.x, lensed.y, pointRadius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${pointOpacity})`;
            ctx.fill();
          }
        } else {
          ctx.beginPath();
          ctx.arc(lensed.x, lensed.y, r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${op})`;
          ctx.fill();
        }

        // Glow for bright moments
        if (twinkle > 0.6 || lensed.brightness > 1.3) {
          ctx.beginPath();
          ctx.arc(lensed.x, lensed.y, r * 3, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${(lensed.brightness - 0.8) * 0.12})`;
          ctx.fill();
        }
      }

      // ─── Accretion disk: continuous beamed band + secondary lensed arc ─
      const energy = accretionEnergyRef.current;
      const diskBrightness = 0.75 + energy * 0.55;
      const t = performance.now() * 0.00035;

      // Orbital perspective driven by scroll: as the user scrolls down it
      // feels like we are orbiting around the black hole and swinging
      // closer to it, then pulling back — the disk tilts toward face-on,
      // rotates its viewing angle, and breathes in scale, all as a
      // continuous periodic function of scroll depth (never runs out).
      const orbitPhase = scrollY * 0.0022;
      const orbitTilt = DISK_TILT + Math.sin(orbitPhase) * 0.22;
      const orbitScale = 1 + Math.sin(orbitPhase * 0.85 + 1.1) * 0.16;
      const orbitRotation = Math.sin(orbitPhase * 0.6) * 0.35;
      const orbitProximity = (Math.sin(orbitPhase + Math.PI / 2) + 1) / 2; // 0..1, 1 = closest pass
      const orbitBrightness = diskBrightness * (0.82 + orbitProximity * 0.5);

      // Draw the primary disk as a set of concentric orbits sampled densely
      // enough to read as a continuous glowing band rather than particles.
      // Layers go from wide/dim (outer disk) to narrow/bright (inner edge),
      // each with its own Doppler-beamed brightness per sample.
      const radiusRatios = [2.6, 2.1, 1.7, 1.35, 1.08];
      for (const ratio of radiusRatios) {
        const samples = sampleDisk(
          well,
          ratio * orbitScale,
          orbitTilt,
          t + orbitRotation,
          DISK_SAMPLES
        );
        for (let i = 0; i < samples.length; i++) {
          const s = samples[i];
          const next = samples[(i + 1) % samples.length];

          // Behind-the-horizon occlusion: skip segments that pass under the
          // shadow disc (both endpoints within the event horizon radius on
          // the far/lower side get hidden by the black silhouette drawn
          // after this pass anyway, but skipping keeps blend modes clean).
          const op = clampOpacity(s.brightness * orbitBrightness * 0.55);
          if (op < 0.015) continue;

          const hue = s.doppler > 0 ? 205 + s.doppler * 25 : 18 + s.doppler * -10;
          const light = 78 + s.doppler * 14;

          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(next.x, next.y);
          ctx.strokeStyle = `hsla(${hue}, 85%, ${light}%, ${op})`;
          ctx.lineWidth = s.width * (1 + energy * 0.6) * orbitScale;
          ctx.lineCap = "round";
          ctx.stroke();
        }
      }

      // Bright inner rim of the disk right before it plunges past the
      // photon sphere — the hottest, fastest-orbiting material.
      const innerSamples = sampleDisk(
        well,
        1.0 * orbitScale,
        orbitTilt,
        t + orbitRotation,
        DISK_SAMPLES
      );
      for (let i = 0; i < innerSamples.length; i++) {
        const s = innerSamples[i];
        const next = innerSamples[(i + 1) % innerSamples.length];
        const op = clampOpacity(s.brightness * orbitBrightness * 0.85);
        if (op < 0.02) continue;
        const hue = s.doppler > 0 ? 200 : 30;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(next.x, next.y);
        ctx.strokeStyle = `hsla(${hue}, 90%, 92%, ${op})`;
        ctx.lineWidth = s.width * 1.3 * (1 + energy * 0.8) * orbitScale;
        ctx.lineCap = "round";
        ctx.stroke();
      }

      // ─── Event horizon shadow (drawn over the far side of the disk) ───
      const shadowGrd = ctx.createRadialGradient(
        well.x,
        well.y,
        well.eventRadius * 0.6,
        well.x,
        well.y,
        well.photonRadius * 1.02
      );
      shadowGrd.addColorStop(0, "rgba(0,0,0,1)");
      shadowGrd.addColorStop(0.75, "rgba(0,0,0,0.97)");
      shadowGrd.addColorStop(1, "rgba(0,0,0,0)");
      ctx.beginPath();
      ctx.arc(well.x, well.y, well.photonRadius * 1.02, 0, Math.PI * 2);
      ctx.fillStyle = shadowGrd;
      ctx.fill();

      // Sharp horizon edge — the true event horizon, pure black.
      ctx.beginPath();
      ctx.arc(well.x, well.y, well.eventRadius, 0, Math.PI * 2);
      ctx.fillStyle = "#000";
      ctx.fill();

      // ─── Secondary (lensed) image: far side of the disk bent around the
      // photon sphere into a thin bright arc above the shadow — the
      // signature feature distinguishing a real black hole render from a
      // flat ring. Follows the same orbital perspective as the disk. ────
      const secondary = sampleSecondaryImage(well, t + orbitRotation, SECONDARY_SAMPLES);
      for (let i = 0; i < secondary.length - 1; i++) {
        const s = secondary[i];
        const next = secondary[i + 1];
        const op = clampOpacity(s.brightness * orbitBrightness * 0.7);
        if (op < 0.015) continue;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(next.x, next.y);
        ctx.strokeStyle = `hsla(${s.doppler > 0 ? 205 : 25}, 80%, 90%, ${op})`;
        ctx.lineWidth = s.width * (1 + energy * 0.6) * orbitScale;
        ctx.lineCap = "round";
        ctx.stroke();
      }

      // ─── Photon ring: thin, crisp, asymmetric line right at the shadow
      // boundary — brightest where the approaching disk material lenses
      // directly onto it. Radius breathes and rotates with orbital
      // perspective so it reads as swinging past the hole with the disk. ──
      const ringSamples = 140;
      const ringRadius = well.photonRadius * orbitScale;
      for (let i = 0; i < ringSamples; i++) {
        const angle = (i / ringSamples) * Math.PI * 2;
        const next = ((i + 1) / ringSamples) * Math.PI * 2;
        const approach = Math.cos(angle + t * 1.4 + orbitRotation);
        const rx = well.x + Math.cos(angle) * ringRadius;
        const ry = well.y + Math.sin(angle) * ringRadius;
        const rx2 = well.x + Math.cos(next) * ringRadius;
        const ry2 = well.y + Math.sin(next) * ringRadius;
        const op = clampOpacity(
          (0.18 + Math.pow(1 + approach * 0.85, 2.4) * 0.1 + energy * 0.25) *
            (0.85 + orbitProximity * 0.3)
        );
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx2, ry2);
        ctx.strokeStyle = `rgba(255, 255, 255, ${op})`;
        ctx.lineWidth = 1.5 + Math.max(0, approach) * 2 + energy * 2;
        ctx.stroke();
      }

      // ─── Meteors with gravitational effects ────────────────────────────
      // Scroll adds a bit more room/energy to the field: spawn rate and
      // fall speed scale up slightly with scroll depth, so the deeper the
      // user scrolls the busier and faster the meteor shower feels — while
      // the black hole itself never moves.
      const scrollFactor = Math.min(1, scrollY / (height * 2));
      const dynamicSpawnRate = METEOR_SPAWN_RATE * (1 + scrollFactor * METEOR_PARALLAX);
      const dynamicMeteorCount = Math.round(METEOR_COUNT * (1 + scrollFactor * 0.4));
      if (meteors.length < dynamicMeteorCount && Math.random() < dynamicSpawnRate) {
        meteors.push(createMeteor(width, height));
      }

      for (let i = meteors.length - 1; i >= 0; i--) {
        const m = meteors[i];

        // Apply gravity
        const grav = gravityEffect({ x: m.x, y: m.y }, well);
        m.vx += grav.acceleration.x;
        m.vy += grav.acceleration.y;
        m.x += m.vx;
        m.y += m.vy + scrollFactor * 0.6;
        m.life++;
        m.hue = (m.hue + m.hueSpeed) % 360;
        m.stretch = grav.tidalStretch;

        if (grav.absorbed) {
          m.absorbed = true;
          accretionEnergyRef.current = Math.min(1, energy + 0.35);
          meteors.splice(i, 1);
          continue;
        }

        const progress = m.life / m.maxLife;
        const fadeOut = progress > 0.7 ? 1 - (progress - 0.7) / 0.3 : 1;
        const fadeIn = progress < 0.06 ? progress / 0.06 : 1;
        const currentOpacity = m.opacity * fadeOut * fadeIn;

        if (m.life > m.maxLife || m.y > height + 100 || m.x > width + 200 || m.x < -200) {
          meteors.splice(i, 1);
          continue;
        }

        // Compute trail direction from velocity
        const speed = Math.hypot(m.vx, m.vy);
        const dirX = speed > 0 ? m.vx / speed : 0;
        const dirY = speed > 0 ? m.vy / speed : 0;

        ctx.font = `bold ${m.fontSize}px monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        for (let c = 0; c < m.chars.length; c++) {
          const charData = m.chars[c];
          // Tidal stretch: chars spread out more near the horizon
          const effectiveOffset = charData.offset * (1 + m.stretch * 3);
          const cx = m.x - dirX * effectiveOffset;
          const cy = m.y - dirY * effectiveOffset;
          // Sharp, fast falloff: the trail reads as a raw digital burst that
          // dissolves into noise almost immediately instead of a smooth tail.
          const t = c / m.chars.length;
          const trailFade = Math.pow(1 - t, 3.2);
          const charOpacity = currentOpacity * trailFade;

          if (charOpacity < 0.035) continue;

          const charHue = (m.hue + c * 20) % 360;
          // Crank saturation/contrast up and keep it there — no softening
          // toward gray as gravity pulls on it, so the color stays raw.
          const saturation = 100;
          const lightness = grav.influence > 0.5 ? 68 + grav.influence * 22 : 62;

          if (c === 0) {
            // Tight, hard-edged glow only on the leading character — crude
            // and punchy rather than a soft diffuse blur.
            ctx.shadowColor = `hsla(${charHue}, ${saturation}%, ${lightness}%, ${charOpacity})`;
            ctx.shadowBlur = 3 + m.stretch * 6;
          } else {
            ctx.shadowBlur = 0;
          }

          // Stretch chars when under tidal forces
          if (m.stretch > 0.2) {
            ctx.save();
            ctx.translate(cx, cy);
            const stretchAngle = Math.atan2(dirY, dirX);
            ctx.rotate(stretchAngle);
            ctx.scale(1 + m.stretch * 2, 1 - m.stretch * 0.3);
            ctx.fillStyle = `hsla(${charHue}, ${saturation}%, ${lightness}%, ${charOpacity})`;
            ctx.fillText(charData.char, 0, 0);
            ctx.restore();
          } else {
            ctx.fillStyle = `hsla(${charHue}, ${saturation}%, ${lightness}%, ${charOpacity})`;
            ctx.fillText(charData.char, cx, cy);
          }

          // High glyph-flicker rate: digits keep flipping between 0/1 so the
          // trail reads as raw, busy binary noise rather than static text.
          if (Math.random() < 0.22) charData.char = randomChar();
        }
        ctx.shadowBlur = 0;
      }

      // Decay accretion energy over time
      accretionEnergyRef.current = Math.max(0, energy - 0.004);

      animRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
      scrollContainer?.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-[1] h-screen w-screen"
      aria-hidden="true"
    />
  );
}
