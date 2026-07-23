export interface Point {
  x: number;
  y: number;
}

export interface GravityWell extends Point {
  eventRadius: number;
  photonRadius: number;
  influenceRadius: number;
}

export interface LensedPoint extends Point {
  visible: boolean;
  brightness: number;
  tangentialStretch: number;
}

export interface GravityEffect {
  acceleration: Point;
  influence: number;
  tidalStretch: number;
  absorbed: boolean;
}

/** A single sampled point along the accretion disk's visible band. */
export interface DiskSample extends Point {
  /** 0..1, relative brightness after Doppler beaming + gravitational redshift. */
  brightness: number;
  /** -1 (receding, redshifted) .. 1 (approaching, blueshifted). */
  doppler: number;
  /** Line width to draw at this sample, already lens-magnified. */
  width: number;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/**
 * Samples the near (primary) image of the accretion disk as seen projected
 * onto the observer's plane, tilted almost edge-on like real EHT imagery.
 * `tilt` is the vertical squash factor (0 = perfect edge-on line, 1 = a
 * face-on circle). `spin` drives which side approaches the observer for
 * Doppler beaming, and `time` animates orbital motion.
 */
export function sampleDisk(
  well: GravityWell,
  radiusRatio: number,
  tilt: number,
  time: number,
  sampleCount: number,
): DiskSample[] {
  const samples: DiskSample[] = [];
  const radius = well.photonRadius * radiusRatio;

  for (let i = 0; i < sampleCount; i++) {
    const angle = (i / sampleCount) * Math.PI * 2;
    const orbitAngle = angle + time * (1.4 / radiusRatio);

    const x = well.x + Math.cos(orbitAngle) * radius;
    const y = well.y + Math.sin(orbitAngle) * radius * tilt;

    // Approaching side of the disk is the one moving toward +x screen
    // motion on the near edge (top per convention used below).
    const approach = Math.cos(orbitAngle);
    const doppler = approach;

    // Relativistic-style beaming: approaching material is strongly
    // brightened and blue-hot, receding material is dim and cool.
    const beaming = Math.pow(1 + doppler * 0.9, 3.2) * 0.35;
    // Gravitational redshift/limb effect: material behind the hole (far
    // edge, smaller |sin|) dims slightly from path length through glow.
    const limb = 0.55 + 0.45 * Math.abs(Math.sin(orbitAngle));

    const brightness = clamp(beaming * limb, 0.04, 3.2);
    const width = well.photonRadius * (0.05 + 0.03 * (1 - radiusRatio));

    samples.push({ x, y, brightness, doppler, width });
  }

  return samples;
}

/**
 * Produces the secondary (lensed) image of the far side of the disk that
 * appears to arc over the top of the shadow — the signature feature of
 * real black hole renders (e.g. Interstellar's Gargantua, EHT's M87*).
 * It is a thin, bright arc hugging the photon ring on the side opposite
 * strong Doppler dimming.
 */
export function sampleSecondaryImage(
  well: GravityWell,
  time: number,
  sampleCount: number,
): DiskSample[] {
  const samples: DiskSample[] = [];
  const radius = well.photonRadius * 1.02;
  // Arc spans the upper hemisphere where the far side of the disk gets
  // bent around the photon sphere into view.
  const arcStart = Math.PI * 1.08;
  const arcEnd = Math.PI * 1.92;

  for (let i = 0; i < sampleCount; i++) {
    const t = i / (sampleCount - 1);
    const angle = arcStart + (arcEnd - arcStart) * t;
    const orbitAngle = angle + time * 0.9;

    const x = well.x + Math.cos(angle) * radius;
    const y = well.y + Math.sin(angle) * radius * 0.99;

    const approach = Math.cos(orbitAngle);
    const edgeFade = Math.sin(((angle - arcStart) / (arcEnd - arcStart)) * Math.PI);
    const brightness = clamp(
      (0.5 + approach * 0.3) * edgeFade * 1.4,
      0,
      1.6,
    );

    samples.push({
      x,
      y,
      brightness,
      doppler: approach,
      width: well.photonRadius * 0.035,
    });
  }

  return samples;
}

/**
 * Approximate gravitational lensing for a background point. It is not a
 * relativistic ray tracer, but follows the visual behavior of one: images
 * close to the photon sphere are pushed outward, twisted tangentially and
 * magnified, while anything crossing the event horizon disappears.
 */
export function lensPoint(point: Point, well: GravityWell): LensedPoint {
  const dx = point.x - well.x;
  const dy = point.y - well.y;
  const distance = Math.hypot(dx, dy);

  if (distance <= well.eventRadius) {
    return {
      x: well.x,
      y: well.y,
      visible: false,
      brightness: 0,
      tangentialStretch: 0,
    };
  }

  if (distance >= well.influenceRadius) {
    return {
      ...point,
      visible: true,
      brightness: 1,
      tangentialStretch: 0,
    };
  }

  const angle = Math.atan2(dy, dx);
  const influence = 1 - distance / well.influenceRadius;
  const ringWidth = Math.max(1, well.photonRadius * 0.22);
  const ringDistance = (distance - well.photonRadius) / ringWidth;
  const photonBand = Math.exp(-(ringDistance * ringDistance));
  const horizonFade = clamp(
    (distance - well.eventRadius) /
      Math.max(1, well.photonRadius - well.eventRadius),
    0,
    1,
  );

  const radialDisplacement =
    well.photonRadius * (0.28 * photonBand + 0.06 * influence * influence);
  const angularDeflection =
    influence * influence * 0.42 + photonBand * 0.22;
  const lensedRadius = distance + radialDisplacement;
  const lensedAngle = angle + angularDeflection;

  return {
    x: well.x + Math.cos(lensedAngle) * lensedRadius,
    y: well.y + Math.sin(lensedAngle) * lensedRadius,
    visible: horizonFade > 0.02,
    brightness: horizonFade * (1 + photonBand * 1.8),
    tangentialStretch: photonBand * 2.2,
  };
}

/**
 * Approximate acceleration and tidal stretching for a moving body. The force
 * ramps smoothly inside the influence radius, curves trajectories around the
 * well, and marks bodies inside the event horizon as absorbed.
 */
export function gravityEffect(point: Point, well: GravityWell): GravityEffect {
  const dx = well.x - point.x;
  const dy = well.y - point.y;
  const distance = Math.max(0.001, Math.hypot(dx, dy));
  const absorbed = distance <= well.eventRadius;

  if (distance >= well.influenceRadius) {
    return {
      acceleration: { x: 0, y: 0 },
      influence: 0,
      tidalStretch: 0,
      absorbed,
    };
  }

  const influence = clamp(1 - distance / well.influenceRadius, 0, 1);
  const horizonProximity = clamp(
    (well.photonRadius * 1.35 - distance) /
      Math.max(1, well.photonRadius * 1.35 - well.eventRadius),
    0,
    1,
  );
  const force = 0.12 + influence * influence * 0.62;
  const radialX = (dx / distance) * force;
  const radialY = (dy / distance) * force;
  const swirl = influence * influence * 0.16;

  return {
    acceleration: {
      x: radialX - (dy / distance) * swirl,
      y: radialY + (dx / distance) * swirl,
    },
    influence,
    tidalStretch: horizonProximity * horizonProximity,
    absorbed,
  };
}
