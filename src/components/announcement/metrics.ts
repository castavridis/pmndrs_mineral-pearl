/** Banner metrics in CSS px, the glass banner's (652 × 94). */
export const announcement = {
  width: 652,
  height: 94,
  radius: 8,
  /** Left of the content: the text starts a rem in from the slab's edge. */
  paddingX: 16,
  /** Above and below, and to the right, where the dismiss sits. */
  paddingY: 24,
  paddingRight: 24,
  /** Liquid kept around the banner, px: where its ripples and droplets run.
      As much room as the card afloat keeps on the study's pond, so the swallow
      has somewhere to throw its droplets instead of clipping at the rim. */
  bleed: 96,
} as const;
