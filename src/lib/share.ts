import type { AppState } from './state';

// Share links — encodes the current lineup into a URL fragment so it can be pasted anywhere;
// opening the link restores that exact lineup (see applyState-equivalent logic in the app).
//
// Porting note: this is the one pure-logic module with no clean embedded equivalent, because
// the *point* of it is producing a URL a browser understands — there's no "share link" on an
// MCU. If a C version keeps the idea at all, it'd most likely become a lower-tech save/load
// format instead (e.g. dump a compact string to serial/BLE, or write it to a file the user
// copies off), not a URL. `shareableState` (deciding WHAT to serialize) is still worth
// porting as-is; `encodeURIComponent`/JSON.stringify are the parts that don't survive the move
// to C and would need a hand-rolled JSON writer + percent-encoder, or dropped in favor of your
// own compact binary format entirely (same as the note in state.ts).

/** Strips fields too large or meaningless for a URL — chiefly player photos (base64 images). */
export function shareableState(full: AppState): AppState {
  return {
    teams: full.teams,
    matchTag: full.matchTag,
    pitchTitle: full.pitchTitle,
    players: full.players.map(({ photoUrl: _photoUrl, ...rest }) => ({ ...rest, photoUrl: null })),
  };
}

export function encodeShareState(state: AppState): string {
  return encodeURIComponent(JSON.stringify(state));
}

export function decodeShareFragment(hash: string): AppState | null {
  const m = hash.match(/#s=(.+)/);
  if (!m) return null;
  try {
    return JSON.parse(decodeURIComponent(m[1])) as AppState;
  } catch {
    return null;
  }
}
