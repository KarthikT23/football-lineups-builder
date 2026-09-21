import type { Player, SquadSize, TeamId } from './types';

// Formation logic — SECOND module to port to C. Still pure logic (structs + arrays + a
// couple of lookup tables), no rendering. In C this becomes a small header of enums/structs
// plus these functions operating on a fixed-size `Player squad[8]` array (8 is the largest
// squad size, so a plain fixed array avoids any dynamic allocation).

// outfield counts per squad size: [defenders, midfielders, forwards] (goalkeeper is separate).
// Two shape choices per size — this is what the "formation" <select> in the UI offers.
export type FormationShape = [number, number, number];

export const FORMATION_OPTIONS: Record<SquadSize, FormationShape[]> = {
  5: [
    [2, 1, 1],
    [1, 2, 1],
  ],
  6: [
    [2, 2, 1],
    [3, 1, 1],
  ],
  7: [
    [2, 3, 1],
    [3, 2, 1],
  ],
  8: [
    [3, 3, 1],
    [3, 2, 2],
  ],
};

export function formationLabel(shape: FormationShape): string {
  return shape.join('-');
}

/** Clamps a stored/typed formation index to a valid option for the given squad size. */
export function clampFormationIndex(size: SquadSize, index: number): number {
  const opts = FORMATION_OPTIONS[size];
  return Math.min(Math.max(index, 0), opts.length - 1);
}

export function formationForTeam(size: SquadSize, formationIndex: number): FormationShape {
  const opts = FORMATION_OPTIONS[size];
  return opts[clampFormationIndex(size, formationIndex)];
}

type Band = 'GK' | 'DEF' | 'DM' | 'AM' | 'FWD';
type Lateral = 'L' | 'C' | 'R';

// vertical zone (how advanced up the pitch) x lateral zone (how wide) -> a specific position tag
const POSITION_TABLE: Record<Band, Record<Lateral, string>> = {
  GK: { L: 'GK', C: 'GK', R: 'GK' },
  DEF: { L: 'LB', C: 'CB', R: 'RB' },
  DM: { L: 'DM', C: 'DM', R: 'DM' },
  AM: { L: 'LM', C: 'AM', R: 'RM' },
  FWD: { L: 'LW', C: 'CF', R: 'RW' },
};

// every tag the auto-system produces; typing anything outside this set locks the tag against drag updates
export const AUTO_TAGS = new Set(
  Object.values(POSITION_TABLE).flatMap((row) => Object.values(row))
);

/** 0 = own goal line, 1 = opponent's goal line. */
function advancement(team: TeamId, y: number): number {
  return team === 2 ? y : 1 - y;
}

export function verticalZone(team: TeamId, y: number): Band {
  const adv = advancement(team, y);
  if (adv < 0.08) return 'GK';
  if (adv < 0.2) return 'DEF';
  if (adv < 0.31) return 'DM';
  if (adv < 0.42) return 'AM';
  return 'FWD';
}

function lateralZone(x: number): Lateral {
  if (x < 0.34) return 'L';
  if (x > 0.66) return 'R';
  return 'C';
}

export function autoRole(team: TeamId, x: number, y: number): string {
  return POSITION_TABLE[verticalZone(team, y)][lateralZone(x)];
}

// default line depths — kept within each team's own half so the two forward lines
// don't collide at the halfway line, with a comfortable gap around the center circle
function bandY(team: TeamId, band: Band): number {
  const map1: Record<Band, number> = { GK: 0.97, DEF: 0.86, DM: 0.75, AM: 0.64, FWD: 0.55 };
  const map2: Record<Band, number> = { GK: 0.03, DEF: 0.14, DM: 0.25, AM: 0.36, FWD: 0.45 };
  return (team === 1 ? map1 : map2)[band];
}

/** Splits a formation's midfield count into a deeper (DM) line and an advanced (AM) line. */
function splitMid(mid: number): [number, number] {
  const dm = Math.floor(mid / 2);
  return [dm, mid - dm];
}

/**
 * Builds a fresh starting lineup for one team from a chosen formation shape.
 * This — plus autoRole/verticalZone above — is the function a C `layout_for_side()` should
 * reproduce field-for-field: same band ordering, same row-spacing formula, same numbering.
 */
export function generateLayout(shape: FormationShape, team: TeamId): Player[] {
  const [def, mid, fwd] = shape;
  const [dm, am] = splitMid(mid);
  const bands: Array<[Band, number]> = (
    [
      ['GK', 1],
      ['DEF', def],
      ['DM', dm],
      ['AM', am],
      ['FWD', fwd],
    ] as Array<[Band, number]>
  ).filter(([, count]) => count > 0);

  // build the flat row list first (one entry per player, tagged with its band and depth),
  // then position each row left-to-right by how many other players share that exact depth —
  // this mirrors the HTML version's two-pass approach exactly, rather than positioning
  // players within a band directly, so it stays correct if two different bands ever share a y.
  const rows: Array<{ band: Band; y: number }> = [];
  for (const [band, count] of bands) {
    for (let i = 0; i < count; i++) rows.push({ band, y: bandY(team, band) });
  }

  return rows.map((r, idx) => {
    const rowItems = rows.filter((x) => x.y === r.y);
    const rowIndex = rowItems.indexOf(r);
    const rowCount = rowItems.length;
    const x = rowCount === 1 ? 0.5 : 0.18 + (0.64 * rowIndex) / (rowCount - 1);
    const number = idx + 1;
    return {
      id: `t${team}-${number}`,
      team,
      number: String(number),
      name: r.band === 'GK' ? 'Keeper' : `Player ${number}`,
      role: autoRole(team, x, r.y),
      x,
      y: r.y,
    };
  });
}

/**
 * Recomputed from wherever the players actually are right now, not the starting preset —
 * this is what's shown live next to each team name and in the roster panel header.
 *
 * DEF-MID-FWD (3 numbers), matching the shape of what the formation dropdown offers — DM/AM
 * stay separate internally (verticalZone) for tagging a dragged player's specific position,
 * but are folded back into one "MID" count here so a "3-2-1" pick reads back as "3-2-1" when
 * nobody's been moved, not a more granular "3-1-1-1". (This was a real bug in an earlier
 * version: keeping DM/AM split all the way to this label made the live number never match
 * the preset you picked, which was confusing — worth remembering if this gets ported.)
 */
export function liveFormation(players: Player[], team: TeamId): string {
  const counts = { DEF: 0, MID: 0, FWD: 0 };
  for (const p of players) {
    if (p.team !== team) continue;
    const z = verticalZone(team, p.y);
    if (z === 'GK') continue;
    if (z === 'DM' || z === 'AM') counts.MID += 1;
    else counts[z] += 1;
  }
  return (['DEF', 'MID', 'FWD'] as const)
    .map((z) => counts[z])
    .filter((c) => c > 0)
    .join('-');
}
