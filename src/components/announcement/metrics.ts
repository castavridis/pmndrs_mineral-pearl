/** Banner metrics in CSS px, the glass banner's (652 wide). */
export const announcement = {
  width: 652,
  radius: 8,
  /** Left of the content: the text starts a rem in from the slab's edge. */
  paddingX: 16,
  /** Above and below, and to the right, where the dismiss sits. */
  paddingY: 8,
  paddingRight: 24,
  /** Liquid kept around the banner, px: where its ripples and droplets run.
      As much room as the card afloat keeps on the study's pond, so the swallow
      has somewhere to throw its droplets instead of clipping at the rim. */
  bleed: 96,
} as const;

/**
 * The ink banner: a blot lands in the middle of the banner and floods out to
 * its rounded edge, the way the first ink callouts did.
 */
export const inkBanner = {
  /** Room around the banner for the blot's overhang and its spatter, px. */
  bleed: 56,
  /** Blot size, relative to the canvas's longer edge (the banner's width). */
  scale: 0.24,
  /** How much of the burst flies, 0..1: less than a full splat, so the
      spatter stays near a banner that has other things round it. */
  spatter: 0.6,
  /** Surface tension and iridescence on the ink, 0..1. */
  nacre: 0.8,
} as const;
