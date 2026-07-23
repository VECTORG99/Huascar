"use client";

import dynamic from "next/dynamic";
import { HeroSection, ContentSections } from "@/features/landing";

const SpaceSimulation = dynamic(
  () =>
    import("@/features/landing/components/space-simulation").then(
      (m) => m.SpaceSimulation
    ),
  { ssr: false }
);

const Spaceship = dynamic(
  () =>
    import("@/features/landing/components/spaceship").then(
      (m) => m.Spaceship
    ),
  { ssr: false }
);

const StickyHeader = dynamic(
  () =>
    import("@/features/landing/components/sticky-nav").then(
      (m) => m.StickyHeader
    ),
  { ssr: false }
);

const StickyFooter = dynamic(
  () =>
    import("@/features/landing/components/sticky-nav").then(
      (m) => m.StickyFooter
    ),
  { ssr: false }
);

export default function HomePage() {
  return (
    <>
      {/* Ship (fixed center, behind content) */}
      <Spaceship />

      {/* Navigation */}
      <StickyHeader />
      <StickyFooter />

      {/* Scrollable content with unified space simulation as background */}
      <div className="relative h-screen snap-y snap-mandatory overflow-x-hidden overflow-y-auto">
        {/* The simulation renders the black hole + stars + meteors together
            as one Canvas inside the scrollable area — so the black hole
            stays with the hero and exits upward on scroll. */}
        <SpaceSimulation />
        <HeroSection />
        <ContentSections />
      </div>
    </>
  );
}
