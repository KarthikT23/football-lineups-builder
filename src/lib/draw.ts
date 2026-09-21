import type { Player, TeamsState } from './types';
import { PitchGeometry } from './geometry';
import { drawImageContain, drawImageCover, roundRectPath, type ImageSource } from './canvas-utils';
import { liveFormation } from './formation';

// Scene rendering — porting note: this is the module SDL2 (or later, u8g2/LVGL) replaces
// wholesale. Nothing here is meant to be ported line-for-line the way geometry.ts/formation.ts
// are; it's kept in TypeScript purely so this reference project still renders something you
// can visually compare your C version against. Treat this file as "what to draw", not "how" —
// the how (fillRect vs SDL_RenderFillRect vs u8g2_DrawBox) is different in every target anyway.

export const CANVAS_W = 760;
export const CORE_H = 1220; // title + pitch + team bars
export const ROSTER_W = 300; // width of the roster panel, drawn as its own canvas beside the pitch
export const ROSTER_H = 900; // matches the desktop pitch column's displayed height (560px wide * 1220/760)
export const CARD_HALF = 60; // half-extent of a player figure, for hit-testing and edge clamping

const Y_TOP = 0.02;
const Y_BOT = 0.98;

export interface SceneAssets {
  pitchImg: ImageSource | null; // a flat, top-down pitch photo with its own boundary/box lines baked in
}

export interface SceneState {
  players: Player[];
  teams: TeamsState;
  matchTag: string;
  pitchTitle: string; // shown on the canvas itself — defaults to "Saturday Matchday Football" but is editable
}

/** Finds the largest font size (within a max/min range) at which `text` still fits `maxWidth`. */
function fitFontSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxSize: number,
  minSize: number
): number {
  let size = maxSize;
  while (size > minSize) {
    ctx.font = `700 ${size}px Oswald, sans-serif`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 2;
  }
  return size;
}

function matchTagBaselineY(g: PitchGeometry): number {
  return g.topBar * 0.32 + 38;
}

/**
 * The clickable/tappable area around the match-tag line, in native canvas pixels — used by the
 * app to know where to open an inline text editor over the canvas when that line is clicked,
 * so it's editable right where it's shown (in addition to the "Match tag" field in the sidebar).
 */
export function matchTagBounds(g: PitchGeometry): { x: number; y: number; width: number; height: number } {
  const y = matchTagBaselineY(g);
  return { x: 16, y: y - 26, width: g.w - 32, height: 36 };
}

function titleBaselineY(g: PitchGeometry): number {
  return g.topBar * 0.32;
}

/**
 * The clickable/tappable area around the pitch title line, in native canvas pixels — mirrors
 * matchTagBounds above so the title can be edited directly on the canvas the same way the match
 * tag already is (in addition to the "Pitch title" field in the sidebar). Sized generously in
 * height since the title's own font size auto-shrinks between 22px and 44px depending on length.
 */
export function pitchTitleBounds(g: PitchGeometry): { x: number; y: number; width: number; height: number } {
  const y = titleBaselineY(g);
  return { x: 16, y: y - 40, width: g.w - 32, height: 54 };
}

function teamName(teams: TeamsState, team: 1 | 2): string {
  const n = teams[team].name.trim();
  return n ? n.toUpperCase() : `TEAM ${team}`;
}

function teamColor(teams: TeamsState, team: 1 | 2): string {
  return teams[team].color;
}

function drawPitch(ctx: CanvasRenderingContext2D, g: PitchGeometry, assets: SceneAssets) {
  const left = g.leftEdgeAt(Y_TOP);
  const right = g.rightEdgeAt(Y_TOP);
  const top = g.yToScreen(Y_TOP);
  const bottom = g.yToScreen(Y_BOT);

  const w = right - left;
  const h = bottom - top;

  if (assets.pitchImg) {
    // The source photo's aspect ratio doesn't always exactly match this rectangle's (which
    // shifts with font-driven top/bottom bar sizing), so the crisp photo itself is drawn
    // "contain" below — never cropped, so the goal boxes/corner arcs always show in full.
    // Whatever sliver that leaves on the wider axis is filled first with a blurred, cropped
    // ("cover") copy of the same photo, so there's no visible seam or mismatched color — it
    // just reads as a soft out-of-focus extension of the pitch itself.
    ctx.save();
    ctx.beginPath();
    ctx.rect(left, top, w, h);
    ctx.clip();
    ctx.filter = 'blur(18px)';
    drawImageCover(ctx, assets.pitchImg, left, top, w, h);
    ctx.restore();
    drawImageContain(ctx, assets.pitchImg, left, top, w, h);
  } else {
    // fallback flat green fill for when no pitch image has loaded yet
    ctx.fillStyle = '#2C7A46';
    ctx.fillRect(left, top, w, h);
  }
}

function drawChrome(ctx: CanvasRenderingContext2D, g: PitchGeometry, state: SceneState) {
  ctx.fillStyle = '#16211A';
  ctx.fillRect(0, 0, g.w, g.topBar);
  ctx.fillRect(0, g.topBar + g.pitchH, g.w, g.bottomBar);

  // title — user-editable text (defaults to "Saturday Matchday Football"). If it still
  // contains the word "matchday" (any case), that word is highlighted in amber like the
  // original fixed title; otherwise the whole thing is drawn in one plain color so an
  // arbitrary custom title never looks broken.
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  const title = state.pitchTitle.toUpperCase();
  // shrinks to fit so a longer custom title never runs off the edge of the canvas
  const titleSize = fitFontSize(ctx, title, g.w - 44, 44, 22);
  ctx.font = `700 ${titleSize}px Oswald, sans-serif`;
  const hi = title.indexOf('MATCHDAY');
  if (hi === -1) {
    ctx.fillStyle = '#F3EFE6';
    ctx.fillText(title, 22, g.topBar * 0.32);
  } else {
    const before = title.slice(0, hi);
    const word = title.slice(hi, hi + 'MATCHDAY'.length);
    const after = title.slice(hi + 'MATCHDAY'.length);
    ctx.fillStyle = '#F3EFE6';
    ctx.fillText(before, 22, g.topBar * 0.32);
    const w1 = ctx.measureText(before).width;
    ctx.fillStyle = '#E7A339';
    ctx.fillText(word, 22 + w1, g.topBar * 0.32);
    const w2 = ctx.measureText(word).width;
    ctx.fillStyle = '#F3EFE6';
    ctx.fillText(after, 22 + w1 + w2, g.topBar * 0.32);
  }

  // match tag — directly under the title, clickable in the app (see matchTagBounds below)
  ctx.font = '400 23px Oswald, sans-serif';
  ctx.fillStyle = 'rgba(243,239,230,0.65)';
  ctx.fillText(state.matchTag, 22, matchTagBaselineY(g));

  ctx.strokeStyle = 'rgba(243,239,230,0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(22, g.topBar * 0.68);
  ctx.lineTo(g.w - 22, g.topBar * 0.68);
  ctx.stroke();

  // team 2 (top half) name + live formation
  ctx.textBaseline = 'middle';
  ctx.font = '700 28px Oswald, sans-serif';
  ctx.fillStyle = teamColor(state.teams, 2);
  ctx.fillText(teamName(state.teams, 2), 22, g.topBar * 0.85);
  const t2w = ctx.measureText(teamName(state.teams, 2)).width;
  ctx.font = '700 26px Oswald, sans-serif';
  ctx.fillStyle = 'rgba(243,239,230,0.8)';
  ctx.fillText(liveFormation(state.players, 2), 22 + t2w + 14, g.topBar * 0.85);

  // team 1 (bottom half) name + live formation
  ctx.font = '700 26px Oswald, sans-serif';
  ctx.fillStyle = teamColor(state.teams, 1);
  ctx.fillText(teamName(state.teams, 1), 22, g.topBar + g.pitchH + g.bottomBar * 0.55);
  const t1w = ctx.measureText(teamName(state.teams, 1)).width;
  ctx.font = '700 24px Oswald, sans-serif';
  ctx.fillStyle = 'rgba(243,239,230,0.8)';
  ctx.fillText(
    liveFormation(state.players, 1),
    22 + t1w + 14,
    g.topBar + g.pitchH + g.bottomBar * 0.55
  );
}

/**
 * Draws the roster list into its own canvas, sized to sit beside the pitch (same height, its
 * own width) rather than as a footer strip below it. One team stacked per half of the height —
 * team 2 (top half on the pitch) on top, team 1 (bottom half) below it — so the panel reads in
 * the same top/bottom order as the pitch itself.
 */
export function drawRosterPanel(ctx: CanvasRenderingContext2D, w: number, h: number, state: SceneState) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#16211A';
  ctx.fillRect(0, 0, w, h);

  const pad = 22;
  const sectionH = h / 2;

  ([2, 1] as const).forEach((team, idx) => {
    const top = idx * sectionH;
    const color = teamColor(state.teams, team);

    if (idx === 1) {
      ctx.strokeStyle = 'rgba(243,239,230,0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, top);
      ctx.lineTo(w, top);
      ctx.stroke();
    }

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = '700 23px Oswald, sans-serif';
    ctx.fillStyle = color;
    ctx.fillText(teamName(state.teams, team), pad, top + 34);
    const tw = ctx.measureText(teamName(state.teams, team)).width;
    ctx.font = '600 16px Oswald, sans-serif';
    ctx.fillStyle = 'rgba(243,239,230,0.6)';
    ctx.fillText(liveFormation(state.players, team), pad + tw + 10, top + 34);

    const teamPlayers = state.players
      .filter((p) => p.team === team)
      .slice()
      .sort((a, b) => parseInt(a.number, 10) - parseInt(b.number, 10));
    const rowStart = top + 56;
    const rowH = Math.min(38, (sectionH - 70) / Math.max(teamPlayers.length, 1));

    ctx.textBaseline = 'middle';
    teamPlayers.forEach((p, i) => {
      const ry = rowStart + i * rowH + rowH / 2;

      ctx.beginPath();
      ctx.arc(pad + 11, ry, 11, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.textAlign = 'center';
      ctx.font = '700 12px Oswald, sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(p.number, pad + 11, ry + 1);

      let nameX = pad + 30;
      if (p.captain) {
        ctx.beginPath();
        ctx.arc(nameX + 7, ry, 7, 0, Math.PI * 2);
        ctx.fillStyle = '#E7A339';
        ctx.fill();
        ctx.font = '700 9px Oswald, sans-serif';
        ctx.fillStyle = '#0F1712';
        ctx.fillText('C', nameX + 7, ry + 1);
        nameX += 18;
      }

      ctx.textAlign = 'left';
      ctx.font = '600 15px Oswald, sans-serif';
      ctx.fillStyle = '#F3EFE6';
      ctx.fillText(p.name, nameX, ry + 1);

      ctx.textAlign = 'right';
      ctx.font = '700 13px Oswald, sans-serif';
      ctx.fillStyle = 'rgba(243,239,230,0.55)';
      ctx.fillText(p.role, w - pad, ry + 1);
    });
  });
}

function drawPlayer(
  ctx: CanvasRenderingContext2D,
  g: PitchGeometry,
  p: Player,
  color: string,
  photoImg: HTMLImageElement | undefined
) {
  const px = g.fieldToScreenX(p.x, p.y);
  const py = g.yToScreen(p.y);
  const hasPhoto = Boolean(p.photoUrl && photoImg && photoImg.complete);

  const figTop = py - 18;
  const figH = 36;
  const figBottom = figTop + figH;

  // drop shadow
  ctx.beginPath();
  ctx.ellipse(px, figBottom + 3, 18, 5, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fill();

  if (hasPhoto && photoImg) {
    // the player's photo entirely replaces the jersey icon — a clean square, not a circle crop
    const half = figH / 2;
    roundRectPath(ctx, px - half, figTop, figH, figH, 3);
    ctx.save();
    ctx.clip();
    drawImageCover(ctx, photoImg, px - half, figTop, figH, figH);
    ctx.restore();
    roundRectPath(ctx, px - half, figTop, figH, figH, 3);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#FFFFFF';
    ctx.stroke();
  } else {
    // plain jersey icon — shirt with sleeves and a collar, no face at all
    ctx.beginPath();
    ctx.moveTo(px - 13, figTop + 5);
    ctx.lineTo(px - 22, figTop + 3);
    ctx.lineTo(px - 19, figTop + 18);
    ctx.lineTo(px - 13, figTop + 15);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(px + 13, figTop + 5);
    ctx.lineTo(px + 22, figTop + 3);
    ctx.lineTo(px + 19, figTop + 18);
    ctx.lineTo(px + 13, figTop + 15);
    ctx.closePath();
    ctx.fill();

    roundRectPath(ctx, px - 15, figTop, 30, figH, 6);
    ctx.fillStyle = color;
    ctx.fill();

    // collar (V-neck)
    ctx.beginPath();
    ctx.moveTo(px - 6, figTop);
    ctx.lineTo(px, figTop + 8);
    ctx.lineTo(px + 6, figTop);
    ctx.closePath();
    ctx.fillStyle = 'rgba(15,23,18,0.55)';
    ctx.fill();
  }

  // captain armband
  if (p.captain) {
    ctx.beginPath();
    ctx.arc(px - figH / 2 + 2, figTop + 2, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#E7A339';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#FFFFFF';
    ctx.stroke();
    ctx.font = '700 9px Oswald, sans-serif';
    ctx.fillStyle = '#0F1712';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('C', px - figH / 2 + 2, figTop + 3);
  }

  // jersey number — printed on the player, not floating beside them
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (hasPhoto) {
    const numY = figBottom - 11;
    ctx.beginPath();
    ctx.arc(px + figH / 2 - 9, numY, 10, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#FFFFFF';
    ctx.stroke();
    ctx.font = '700 11px Oswald, sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(p.number, px + figH / 2 - 9, numY + 1);
  } else {
    ctx.font = '700 18px Oswald, sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(p.number, px, figTop + figH / 2 + 3);
  }

  // position — its own small tag, below the figure and above the name
  ctx.font = '700 10px Oswald, sans-serif';
  const posW = ctx.measureText(p.role).width + 12;
  const posH = 14;
  const posX = px - posW / 2;
  const posY = figBottom + 5;
  roundRectPath(ctx, posX, posY, posW, posH, 3);
  ctx.fillStyle = 'rgba(15,23,18,0.85)';
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(p.role, px, posY + posH / 2 + 1);

  // name plate
  ctx.font = '600 13px Oswald, sans-serif';
  const label = p.name.toUpperCase();
  const textW = ctx.measureText(label).width;
  const plateW = textW + 16;
  const plateH = 18;
  const plateX = px - plateW / 2;
  const plateY = posY + posH + 4;
  roundRectPath(ctx, plateX, plateY, plateW, plateH, 4);
  ctx.fillStyle = '#E7A339';
  ctx.fill();
  ctx.fillStyle = '#0F1712';
  ctx.fillText(label, px, plateY + plateH / 2 + 1);
}

export function drawScene(
  ctx: CanvasRenderingContext2D,
  g: PitchGeometry,
  state: SceneState,
  assets: SceneAssets,
  photoImages: Map<string, HTMLImageElement>
) {
  ctx.clearRect(0, 0, g.w, g.coreH);
  drawPitch(ctx, g, assets);
  drawChrome(ctx, g, state);

  const sorted = [...state.players].sort((a, b) => a.y - b.y);
  for (const p of sorted) {
    drawPlayer(ctx, g, p, state.teams[p.team].color, p.photoUrl ? photoImages.get(p.id) : undefined);
  }
}
