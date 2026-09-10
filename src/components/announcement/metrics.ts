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

/** The ink blot at the banner's top-left corner. */
export const blot = {
  /** The blot's canvas, px square, centred on the corner. */
  size: 132,
  /** Blot size relative to that canvas. */
  scale: 0.7,
  /** How much of the burst flies, 0..1. */
  spatter: 0.8,
  /** Surface tension and iridescence on the ink, 0..1: the callout lens's. */
  nacre: 0.85,
  /** The ink lands when the sink says the rise has settled; where it cannot
      say (the swallow tier), this long after the banner starts up, ms. */
  backstop: 4500,
} as const;
