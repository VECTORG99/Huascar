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
const METEOR_COUNT = 8;
const METEOR_SPAWN_RATE = 0.04;
const CHAR_SET = ["0", "1"];
const CHAR_SPACING = 16;

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
  const speed = Math.random() * 9 + 7;
  const trailLength = Math.floor(Math.random() * 6) + 5;
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
    opacity: Math.random() * 0.35 + 0.25,
    fontSize: Math.random() * 5 + 12,
    life: 0,
    maxLife: Math.random() * 80 + 60,
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

    // Black hole well positioned in the upper-left region. Sized to
    // dominate the frame like a real horizon-scale render rather than a
    // small decorative icon.
    const well: GravityWell = {
      x: width * 0.24,
      y: height * 0.3,
      eventRadius: Math.min(width, height) * 0.16,
      photonRadius: Math.min(width, height) * 0.205,
      influenceRadius: Math.min(width, height) * 0.75,
    };

    const stars: Star[] = Array.from({ length: STAR_COUNT }, () =>
      createStar(width, height)
    );
    const meteors: Meteor[] = [];

    const animate = () => {
      ctx.fillStyle = "rgba(0, 0, 0, 1)";
      ctx.fillRect(0, 0, width, height);

      // ─── Stars with gravitational lensing ──────────────────────────────
      for (const star of stars) {
        star.twinklePhase += star.twinkleSpeed * 16;
        const twinkle = Math.sin(star.twinklePhase);
        const baseOp = star.baseOpacity * (0.35 + Math.abs(twinkle) * 0.65);
        const baseR = star.baseRadius * (0.75 + Math.abs(twinkle) * 0.5);

        const lensed = lensPoint(
          { x: star.ox, y: star.oy },
          well
        );

        if (!lensed.visible) continue;

        const r = baseR * (1 + lensed.tangentialStretch * 0.8);
        const op = baseOp * lensed.brightness;

        ctx.beginPath();
        if (lensed.tangentialStretch > 0.3) {
          // Draw as arc/streak when heavily lensed
          const angle = Math.atan2(lensed.y - well.y, lensed.x - well.x);
          ctx.ellipse(
            lensed.x,
            lensed.y,
            r * (1 + lensed.tangentialStretch),
            r * 0.5,
            angle + Math.PI / 2,
            0,
            Math.PI * 2
          );
        } else {
          ctx.arc(lensed.x, lensed.y, r, 0, Math.PI * 2);
        }
        ctx.fillStyle = `rgba(255, 255, 255, ${op})`;
        ctx.fill();

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

      // Draw the primary disk as a set of concentric orbits sampled densely
      // enough to read as a continuous glowing band rather than particles.
      // Layers go from wide/dim (outer disk) to narrow/bright (inner edge),
      // each with its own Doppler-beamed brightness per sample.
      const radiusRatios = [2.6, 2.1, 1.7, 1.35, 1.08];
      for (const ratio of radiusRatios) {
        const samples = sampleDisk(well, ratio, DISK_TILT, t, DISK_SAMPLES);
        for (let i = 0; i < samples.length; i++) {
          const s = samples[i];
          const next = samples[(i + 1) % samples.length];

          // Behind-the-horizon occlusion: skip segments that pass under the
          // shadow disc (both endpoints within the event horizon radius on
          // the far/lower side get hidden by the black silhouette drawn
          // after this pass anyway, but skipping keeps blend modes clean).
          const op = clampOpacity(s.brightness * diskBrightness * 0.55);
          if (op < 0.015) continue;

          const hue = s.doppler > 0 ? 205 + s.doppler * 25 : 18 + s.doppler * -10;
          const light = 78 + s.doppler * 14;

          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(next.x, next.y);
          ctx.strokeStyle = `hsla(${hue}, 85%, ${light}%, ${op})`;
          ctx.lineWidth = s.width * (1 + energy * 0.6);
          ctx.lineCap = "round";
          ctx.stroke();
        }
      }

      // Bright inner rim of the disk right before it plunges past the
      // photon sphere — the hottest, fastest-orbiting material.
      const innerSamples = sampleDisk(well, 1.0, DISK_TILT, t, DISK_SAMPLES);
      for (let i = 0; i < innerSamples.length; i++) {
        const s = innerSamples[i];
        const next = innerSamples[(i + 1) % innerSamples.length];
        const op = clampOpacity(s.brightness * diskBrightness * 0.85);
        if (op < 0.02) continue;
        const hue = s.doppler > 0 ? 200 : 30;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(next.x, next.y);
        ctx.strokeStyle = `hsla(${hue}, 90%, 92%, ${op})`;
        ctx.lineWidth = s.width * 1.3 * (1 + energy * 0.8);
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
      // flat ring. ──────────────────────────────────────────────────────
      const secondary = sampleSecondaryImage(well, t, SECONDARY_SAMPLES);
      for (let i = 0; i < secondary.length - 1; i++) {
        const s = secondary[i];
        const next = secondary[i + 1];
        const op = clampOpacity(s.brightness * diskBrightness * 0.7);
        if (op < 0.015) continue;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(next.x, next.y);
        ctx.strokeStyle = `hsla(${s.doppler > 0 ? 205 : 25}, 80%, 90%, ${op})`;
        ctx.lineWidth = s.width * (1 + energy * 0.6);
        ctx.lineCap = "round";
        ctx.stroke();
      }

      // ─── Photon ring: thin, crisp, asymmetric line right at the shadow
      // boundary — brightest where the approaching disk material lenses
      // directly onto it. ─────────────────────────────────────────────────
      const ringSamples = 140;
      for (let i = 0; i < ringSamples; i++) {
        const angle = (i / ringSamples) * Math.PI * 2;
        const next = ((i + 1) / ringSamples) * Math.PI * 2;
        const approach = Math.cos(angle + t * 1.4);
        const rx = well.x + Math.cos(angle) * well.photonRadius;
        const ry = well.y + Math.sin(angle) * well.photonRadius;
        const rx2 = well.x + Math.cos(next) * well.photonRadius;
        const ry2 = well.y + Math.sin(next) * well.photonRadius;
        const op = clampOpacity(
          (0.18 + Math.pow(1 + approach * 0.85, 2.4) * 0.1 + energy * 0.25)
        );
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx2, ry2);
        ctx.strokeStyle = `rgba(255, 255, 255, ${op})`;
        ctx.lineWidth = 1.5 + Math.max(0, approach) * 2 + energy * 2;
        ctx.stroke();
      }

      // ─── Meteors with gravitational effects ────────────────────────────
      if (meteors.length < METEOR_COUNT && Math.random() < METEOR_SPAWN_RATE) {
        meteors.push(createMeteor(width, height));
      }

      for (let i = meteors.length - 1; i >= 0; i--) {
        const m = meteors[i];

        // Apply gravity
        const grav = gravityEffect({ x: m.x, y: m.y }, well);
        m.vx += grav.acceleration.x;
        m.vy += grav.acceleration.y;
        m.x += m.vx;
        m.y += m.vy;
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
        const fadeOut = progress > 0.75 ? 1 - (progress - 0.75) / 0.25 : 1;
        const fadeIn = progress < 0.1 ? progress / 0.1 : 1;
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
          const trailFade = 1 - c / m.chars.length;
          const charOpacity = currentOpacity * trailFade;

          if (charOpacity < 0.02) continue;

          const charHue = (m.hue + c * 20) % 360;
          const saturation = grav.influence > 0.3 ? 100 - grav.influence * 40 : 100;
          const lightness = grav.influence > 0.5 ? 60 + grav.influence * 20 : 60;

          if (c === 0) {
            ctx.shadowColor = `hsla(${charHue}, ${saturation}%, ${lightness}%, ${charOpacity})`;
            ctx.shadowBlur = 8 + m.stretch * 12;
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

          if (Math.random() < 0.03) charData.char = randomChar();
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
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 z-[1] h-full w-full"
      aria-hidden="true"
    />
  );
}
