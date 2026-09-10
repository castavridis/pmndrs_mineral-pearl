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

/** The banner's face: the ink splat's nacre, flooded to the slab's box. */
export const nacreFace = {
  /** Surface tension and iridescence, 0..1: the callout lens's blot. */
  nacre: 0.85,
  /** The meniscus at the rim, px: where the lip darkens and the edge catches the light. */
  meniscus: 7,
} as const;
