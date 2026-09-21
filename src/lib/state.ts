import type { Player, TeamsState } from './types';

// State persistence — porting note: this whole file is the browser-JSON equivalent of
// packing/unpacking a struct for flash storage. `AppState` below is the "struct definition";
// serialize/deserialize are the pack/unpack pair. In C, this becomes a `AppState` struct
// (fixed-size arrays, no pointers) plus `app_state_pack(const AppState*, uint8_t *buf)` and
// `app_state_unpack(const uint8_t *buf, AppState*)` writing/reading a flat byte layout —
// genuinely the same shape of problem as an NVS blob, just swap JSON.stringify for your own
// binary format. `photoUrl` doesn't have a flash-storage equivalent (it's a big base64 image
// string) — a real embedded port would drop that field entirely, which is why `shareableState`
// in share.ts already strips it out for a similar reason (a URL has a length limit).

export interface SerializedPlayer {
  team: 1 | 2;
  number: string;
  name: string;
  role: string;
  x: number;
  y: number;
  captain: boolean;
  photoUrl: string | null;
}

export interface AppState {
  teams: TeamsState;
  matchTag: string;
  pitchTitle: string;
  players: SerializedPlayer[];
}

export function serializeState(
  teams: TeamsState,
  matchTag: string,
  players: Player[],
  pitchTitle: string
): AppState {
  return {
    teams,
    matchTag,
    pitchTitle,
    players: players.map((p) => ({
      team: p.team,
      number: p.number,
      name: p.name,
      role: p.role,
      x: p.x,
      y: p.y,
      captain: !!p.captain,
      photoUrl: p.photoUrl ?? null,
    })),
  };
}

/** Reconstructs the live Player list from a saved/shared state, assigning fresh element ids. */
export function playersFromState(state: AppState): Player[] {
  return state.players.map((p, i) => ({
    id: `t${p.team}-restored-${i}`,
    team: p.team,
    number: p.number,
    name: p.name,
    role: p.role,
    x: p.x,
    y: p.y,
    captain: p.captain,
    photoUrl: p.photoUrl ?? undefined,
  }));
}

/** Type-narrows unknown JSON (from localStorage or a URL) into an AppState, or null if malformed. */
export const DEFAULT_PITCH_TITLE = 'Saturday Matchday Football';

export function parseAppState(raw: unknown): AppState | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  if (!obj.teams || !Array.isArray(obj.players)) return null;
  // pitchTitle didn't exist in state saved before this field was added — default it so old
  // saved/shared lineups still restore cleanly instead of showing a blank canvas title.
  if (typeof obj.pitchTitle !== 'string' || !obj.pitchTitle.trim()) {
    obj.pitchTitle = DEFAULT_PITCH_TITLE;
  }
  return obj as unknown as AppState;
}
