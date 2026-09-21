// Pitch geometry — this is the FIRST module to port to C. It is pure arithmetic: no DOM,
// no canvas, no React. Every function takes plain numbers in and returns a plain number out,
// which is exactly the shape a C function should have too (e.g. a `PitchGeometry` struct plus
// a handful of `float pitch_*(const PitchGeometry *g, float yFrac)` functions).
//
// The pitch itself is a plain rectangle (the background asset is a straight top-down photo
// with no perspective), so every row is the same width. halfWidthAt/leftEdgeAt/rightEdgeAt are
// still written as functions of yFrac — rather than bare constants — on purpose: it keeps every
// other module (player layout, dragging, hit-testing) written in terms of "the pitch edge at
// this depth", so if a future version ever reintroduced perspective, only this one file changes.

export const CORE_H_FRAC = { topBar: 0.21, bottomBar: 0.06 }; // fractions of the "core" (title+pitch+bars) height

export class PitchGeometry {
  readonly w: number;
  readonly coreH: number; // height of the title+pitch+team-bars section (excludes the roster footer)
  readonly footerH: number; // height of the roster panel below the pitch
  readonly topBar: number;
  readonly bottomBar: number;
  readonly pitchH: number;
  readonly footerTop: number;
  readonly margin: number;

  constructor(w: number, coreH: number, footerH: number) {
    this.w = w;
    this.coreH = coreH;
    this.footerH = footerH;
    this.topBar = coreH * CORE_H_FRAC.topBar;
    this.bottomBar = coreH * CORE_H_FRAC.bottomBar;
    this.pitchH = coreH - this.topBar - this.bottomBar;
    this.footerTop = coreH;
    this.margin = w * 0.04;
  }

  get totalH(): number {
    return this.coreH + this.footerH;
  }

  // pitch is a plain rectangle, so half-width doesn't actually depend on yFrac today —
  // the parameter stays so every caller already reads correctly if that ever changes.
  halfWidthAt(_yFrac: number): number {
    return (this.w - 2 * this.margin) / 2;
  }

  leftEdgeAt(yFrac: number): number {
    return this.w / 2 - this.halfWidthAt(yFrac);
  }

  rightEdgeAt(yFrac: number): number {
    return this.w / 2 + this.halfWidthAt(yFrac);
  }

  yToScreen(yFrac: number): number {
    return this.topBar + yFrac * this.pitchH;
  }

  screenToYFrac(sy: number): number {
    return (sy - this.topBar) / this.pitchH;
  }

  fieldToScreenX(xFrac: number, yFrac: number): number {
    return this.leftEdgeAt(yFrac) + xFrac * 2 * this.halfWidthAt(yFrac);
  }

  screenToFieldX(sx: number, yFrac: number): number {
    return (sx - this.leftEdgeAt(yFrac)) / (2 * this.halfWidthAt(yFrac));
  }
}
