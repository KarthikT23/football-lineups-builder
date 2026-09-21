import type { Player, SquadSize, TeamId } from './types';
import { type FormationShape, generateLayout } from './formation';

// Team shuffling — porting note: `shuffleArray` is the textbook Fisher–Yates shuffle, which
// is exactly as simple in C. The only real difference is the random source: `Math.random()`
// here becomes `rand()` (seeded once via `srand(time(NULL))`, or on an MCU something like
// `esp_random()`) in C — everything else about the algorithm carries over unchanged.

export function shuffleArray<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Builds two freshly-shuffled squads. Prefers drawing names from the saved pool (if it has
 * enough names for both sides combined); otherwise reshuffles whoever's currently named.
 * Positions/roles come from generateLayout as normal — only the name assigned to each slot
 * is randomized, and any existing captain armbands are cleared (shuffling implies a new pick).
 */
export function shuffleTeams(
  size1: SquadSize,
  size2: SquadSize,
  shape1: FormationShape,
  shape2: FormationShape,
  currentPlayers: Player[],
  pool: string[]
): Player[] {
  const total = size1 + size2;

  let names: string[];
  if (pool.length >= total) {
    names = shuffleArray(pool).slice(0, total);
  } else {
    names = currentPlayers.map((p) => p.name);
    while (names.length < total) names.push(`Player ${names.length + 1}`);
  }
  names = shuffleArray(names);

  const team1: TeamId = 1;
  const team2: TeamId = 2;
  const newP1 = generateLayout(shape1, team1);
  const newP2 = generateLayout(shape2, team2);

  newP1.forEach((p, i) => {
    p.name = names[i] ?? p.name;
    p.captain = false;
  });
  newP2.forEach((p, i) => {
    p.name = names[size1 + i] ?? p.name;
    p.captain = false;
  });

  return [...newP1, ...newP2];
}
