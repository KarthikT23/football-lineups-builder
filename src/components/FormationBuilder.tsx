'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Player, SquadSize, TeamId, TeamsState } from '@/lib/types';
import {
  AUTO_TAGS,
  autoRole,
  clampFormationIndex,
  FORMATION_OPTIONS,
  formationForTeam,
  formationLabel,
  generateLayout,
} from '@/lib/formation';
import { PitchGeometry } from '@/lib/geometry';
import {
  CANVAS_W,
  CARD_HALF,
  CORE_H,
  drawRosterPanel,
  drawScene,
  matchTagBounds,
  pitchTitleBounds,
  ROSTER_H,
  ROSTER_W,
} from '@/lib/draw';
import { syncCanvasDPR, type ImageSource } from '@/lib/canvas-utils';
import { addToPool, removeFromPool } from '@/lib/pool';
import { shuffleTeams as shuffleTeamsLogic } from '@/lib/shuffle';
import { DEFAULT_PITCH_TITLE, parseAppState, playersFromState, serializeState } from '@/lib/state';
import { decodeShareFragment, encodeShareState, shareableState } from '@/lib/share';
import EditPopover from './EditPopover';

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const STORAGE_KEY = 'smf_state_v1';
const POOL_KEY = 'smf_pool_v1';

function initialTeams(): TeamsState {
  return {
    1: { name: '', color: '#F4A261', size: 6, formationIndex: 0 },
    2: { name: '', color: '#5DADE2', size: 6, formationIndex: 0 },
  };
}

function initialPlayers(teams: TeamsState): Player[] {
  return [
    ...generateLayout(formationForTeam(teams[1].size, teams[1].formationIndex), 1),
    ...generateLayout(formationForTeam(teams[2].size, teams[2].formationIndex), 2),
  ];
}

export default function FormationBuilder() {
  const [teams, setTeams] = useState<TeamsState>(initialTeams);
  const [players, setPlayers] = useState<Player[]>(() => initialPlayers(initialTeams()));
  const [matchTag, setMatchTag] = useState('Sat · 7:00 AM · Turf 3');
  const [pitchTitle, setPitchTitle] = useState(DEFAULT_PITCH_TITLE);
  const [pitchImg, setPitchImg] = useState<ImageSource | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingMatchTag, setEditingMatchTag] = useState(false);
  const [editingPitchTitle, setEditingPitchTitle] = useState(false);
  const [renderTick, setRenderTick] = useState(0);
  const [pool, setPool] = useState<string[]>([]);
  const [poolOpen, setPoolOpen] = useState(false);
  const [poolDraft, setPoolDraft] = useState('');
  const [shareFeedback, setShareFeedback] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rosterCanvasRef = useRef<HTMLCanvasElement>(null);
  const pitchFileRef = useRef<HTMLInputElement>(null);
  const defaultPitchRef = useRef<HTMLImageElement | null>(null);
  const photoImagesRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const dragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const lastTapRef = useRef<{ id: string; time: number } | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydratedRef = useRef(false);

  // footerH is 0 here — the roster panel is its own canvas now, not appended below the pitch
  const geometry = useMemo(() => new PitchGeometry(CANVAS_W, CORE_H, 0), []);

  // ---------------- startup: restore a shared link, else this browser's autosave ----------------
  useEffect(() => {
    try {
      const fromHash = decodeShareFragment(location.hash);
      const stored = fromHash ?? parseAppState(JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'));
      if (stored) {
        setTeams(stored.teams);
        setPlayers(playersFromState(stored));
        setMatchTag(stored.matchTag);
        setPitchTitle(stored.pitchTitle || DEFAULT_PITCH_TITLE);
      }
      const storedPool = JSON.parse(localStorage.getItem(POOL_KEY) || '[]');
      if (Array.isArray(storedPool)) setPool(storedPool);
    } catch {
      // malformed saved/shared state — fall back to the defaults already in place
    } finally {
      hydratedRef.current = true;
    }
  }, []);

  // autosave (debounced) whenever the lineup actually changes, once startup restore has run
  useEffect(() => {
    if (!hydratedRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(serializeState(teams, matchTag, players, pitchTitle))
        );
      } catch {
        // best-effort only — a full browser storage quota shouldn't break the app
      }
    }, 400);
  }, [teams, matchTag, players, pitchTitle]);

  useEffect(() => {
    try {
      localStorage.setItem(POOL_KEY, JSON.stringify(pool));
    } catch {
      // best-effort
    }
  }, [pool]);

  // load the bundled default pitch photo once — a flat top-down image, used as-is
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      defaultPitchRef.current = img;
      setPitchImg((current) => current ?? img);
    };
    img.src = `${BASE_PATH}/pitch.png`;
  }, []);

  // redraw once web fonts are ready (canvas text drawn before that falls back to a system font)
  useEffect(() => {
    if (typeof document !== 'undefined' && 'fonts' in document) {
      document.fonts.ready.then(() => setRenderTick((t) => t + 1));
    }
  }, []);

  // main draw effect — both canvases are resized to the device pixel ratio on every draw so
  // text/lines stay crisp on retina-class screens (syncCanvasDPR is a no-op resize when the
  // size hasn't changed); drawing code itself still only ever deals in fixed logical units.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = syncCanvasDPR(canvas, CANVAS_W, CORE_H);
    if (!ctx) return;
    drawScene(ctx, geometry, { players, teams, matchTag, pitchTitle }, { pitchImg }, photoImagesRef.current);

    const rosterCanvas = rosterCanvasRef.current;
    if (rosterCanvas) {
      const rosterCtx = syncCanvasDPR(rosterCanvas, ROSTER_W, ROSTER_H);
      if (rosterCtx) {
        drawRosterPanel(rosterCtx, ROSTER_W, ROSTER_H, { players, teams, matchTag, pitchTitle });
      }
    }
  }, [players, teams, matchTag, pitchTitle, pitchImg, renderTick, geometry]);

  const updatePlayer = useCallback((id: string, patch: Partial<Player>) => {
    setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }, []);

  const regenerateTeam = useCallback(
    (team: TeamId, size: SquadSize, formationIndex: number) => {
      const shape = formationForTeam(size, formationIndex);
      setPlayers((prev) => [...prev.filter((p) => p.team !== team), ...generateLayout(shape, team)]);
    },
    []
  );

  const resetLayout = useCallback(() => {
    setPlayers(initialPlayers(teams));
    setEditingId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teams]);

  const handleShuffle = useCallback(() => {
    setPlayers((prev) =>
      shuffleTeamsLogic(
        teams[1].size,
        teams[2].size,
        formationForTeam(teams[1].size, teams[1].formationIndex),
        formationForTeam(teams[2].size, teams[2].formationIndex),
        prev,
        pool
      )
    );
    setEditingId(null);
  }, [teams, pool]);

  // ---------------- pointer interaction ----------------
  const getCanvasPos = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    // Use the fixed logical size, not canvas.width/height — those now hold the DPR-scaled
    // backing-store resolution (see syncCanvasDPR), which no longer matches the logical
    // coordinate space that drawScene/geometry/hit-testing all operate in.
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CORE_H / rect.height;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  }, []);

  const playerAt = useCallback(
    (pos: { x: number; y: number }): Player | null => {
      for (let i = players.length - 1; i >= 0; i--) {
        const p = players[i];
        const px = geometry.fieldToScreenX(p.x, p.y);
        const py = geometry.yToScreen(p.y);
        const dx = pos.x - px;
        const dy = pos.y - py;
        if (Math.sqrt(dx * dx + dy * dy) <= CARD_HALF) return p;
      }
      return null;
    },
    [players, geometry]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const pos = getCanvasPos(e.clientX, e.clientY);
      const hit = playerAt(pos);
      if (!hit) {
        // not a player — check whether the click landed on the title or the match-tag line
        // itself, so either can be edited right there on the canvas (in addition to their
        // matching fields in the sidebar). Same e.preventDefault() fix both times: without it,
        // the browser's own default mousedown-focus behavior runs right after our state update
        // and immediately un-focuses the input we just opened (it steals focus back to the
        // canvas/body), so the editor would open and instantly close again.
        const tb = pitchTitleBounds(geometry);
        if (pos.x >= tb.x && pos.x <= tb.x + tb.width && pos.y >= tb.y && pos.y <= tb.y + tb.height) {
          e.preventDefault();
          setEditingPitchTitle(true);
          return;
        }
        const b = matchTagBounds(geometry);
        if (pos.x >= b.x && pos.x <= b.x + b.width && pos.y >= b.y && pos.y <= b.y + b.height) {
          e.preventDefault();
          setEditingMatchTag(true);
        }
        return;
      }

      const now = Date.now();
      const last = lastTapRef.current;
      if (last && last.id === hit.id && now - last.time < 320) {
        setEditingId(hit.id);
        lastTapRef.current = null;
        return;
      }
      lastTapRef.current = { id: hit.id, time: now };

      const px = geometry.fieldToScreenX(hit.x, hit.y);
      const py = geometry.yToScreen(hit.y);
      dragRef.current = { id: hit.id, offsetX: pos.x - px, offsetY: pos.y - py };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [getCanvasPos, playerAt, geometry]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const drag = dragRef.current;
      if (!drag) return;
      const pos = getCanvasPos(e.clientX, e.clientY);
      const targetScreenX = pos.x - drag.offsetX;
      const targetScreenY = pos.y - drag.offsetY;

      let yFrac = geometry.screenToYFrac(targetScreenY);
      yFrac = Math.min(0.96, Math.max(0.04, yFrac));
      let xFrac = geometry.screenToFieldX(targetScreenX, yFrac);
      xFrac = Math.min(0.95, Math.max(0.05, xFrac));

      setPlayers((prev) =>
        prev.map((p) => {
          if (p.id !== drag.id) return p;
          const role = AUTO_TAGS.has(p.role) ? autoRole(p.team, xFrac, yFrac) : p.role;
          return { ...p, x: xFrac, y: yFrac, role };
        })
      );
    },
    [getCanvasPos, geometry]
  );

  const handlePointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  // ---------------- player photo upload ----------------
  const handlePlayerPhoto = useCallback(
    (id: string, file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        const url = String(reader.result);
        const img = new Image();
        img.onload = () => {
          photoImagesRef.current.set(id, img);
          setRenderTick((t) => t + 1);
        };
        img.src = url;
        updatePlayer(id, { photoUrl: url });
      };
      reader.readAsDataURL(file);
    },
    [updatePlayer]
  );

  const handleRemovePlayerPhoto = useCallback(
    (id: string) => {
      photoImagesRef.current.delete(id);
      updatePlayer(id, { photoUrl: undefined });
    },
    [updatePlayer]
  );

  const toggleCaptain = useCallback((id: string) => {
    setPlayers((prev) => {
      const target = prev.find((p) => p.id === id);
      if (!target) return prev;
      const makingCaptain = !target.captain;
      return prev.map((p) => {
        if (p.team !== target.team) return p;
        if (p.id === id) return { ...p, captain: makingCaptain };
        return { ...p, captain: false };
      });
    });
  }, []);

  // ---------------- pitch photo ----------------
  const handlePitchPhotoFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => setPitchImg(img);
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  }, []);

  const resetPitchPhoto = useCallback(() => {
    setPitchImg(defaultPitchRef.current);
  }, []);

  // ---------------- squad pool ----------------
  const handleAddPoolName = useCallback(() => {
    setPool((prev) => addToPool(prev, poolDraft));
    setPoolDraft('');
  }, [poolDraft]);

  const handleRemovePoolName = useCallback((index: number) => {
    setPool((prev) => removeFromPool(prev, index));
  }, []);

  // ---------------- share link ----------------
  const handleShare = useCallback(async () => {
    const encoded = encodeShareState(shareableState(serializeState(teams, matchTag, players, pitchTitle)));
    const url = `${location.origin}${location.pathname}#s=${encoded}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = url;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      try {
        document.execCommand('copy');
      } finally {
        document.body.removeChild(ta);
      }
    }
    setShareFeedback(true);
    setTimeout(() => setShareFeedback(false), 1500);
  }, [teams, matchTag, players, pitchTitle]);

  // ---------------- download ----------------
  const handleDownload = useCallback(() => {
    setEditingId(null);
    const canvas = canvasRef.current;
    const rosterCanvas = rosterCanvasRef.current;
    if (!canvas) return;
    requestAnimationFrame(() => {
      const t1 = (teams[1].name.trim() || 'team-1').replace(/\s+/g, '-').toLowerCase();
      const t2 = (teams[2].name.trim() || 'team-2').replace(/\s+/g, '-').toLowerCase();

      // stitch the pitch canvas and the roster canvas side-by-side into one exported image,
      // so the download matches the on-screen desktop layout (pitch left, roster right)
      // regardless of how narrow the browser window actually is.
      const combined = document.createElement('canvas');
      combined.width = canvas.width + (rosterCanvas?.width ?? 0);
      combined.height = Math.max(canvas.height, rosterCanvas?.height ?? 0);
      const ctx = combined.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = '#0F1712';
      ctx.fillRect(0, 0, combined.width, combined.height);
      ctx.drawImage(canvas, 0, 0);
      if (rosterCanvas) ctx.drawImage(rosterCanvas, canvas.width, 0);

      const link = document.createElement('a');
      link.download = `saturday-matchday-${t1}-vs-${t2}.png`;
      link.href = combined.toDataURL('image/png');
      link.click();
    });
  }, [teams]);

  const editingPlayer = players.find((p) => p.id === editingId) ?? null;

  const popoverStyle = useMemo((): React.CSSProperties => {
    if (!editingPlayer || !canvasRef.current) return {};
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleDisplay = rect.width / CANVAS_W;
    const px = geometry.fieldToScreenX(editingPlayer.x, editingPlayer.y) * scaleDisplay;
    const py = geometry.yToScreen(editingPlayer.y) * scaleDisplay;
    return {
      left: Math.min(Math.max(0, px - 100), rect.width - 210),
      top: Math.max(0, py - 150),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingPlayer, renderTick]);

  const matchTagInputStyle = useMemo((): React.CSSProperties => {
    if (!editingMatchTag || !canvasRef.current) return {};
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleDisplay = rect.width / CANVAS_W;
    const b = matchTagBounds(geometry);
    return {
      left: b.x * scaleDisplay,
      top: b.y * scaleDisplay,
      width: b.width * scaleDisplay,
      height: b.height * scaleDisplay,
      fontSize: 23 * scaleDisplay,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingMatchTag, renderTick, geometry]);

  const pitchTitleInputStyle = useMemo((): React.CSSProperties => {
    if (!editingPitchTitle || !canvasRef.current) return {};
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleDisplay = rect.width / CANVAS_W;
    const b = pitchTitleBounds(geometry);
    return {
      left: b.x * scaleDisplay,
      top: b.y * scaleDisplay,
      width: b.width * scaleDisplay,
      height: b.height * scaleDisplay,
      fontSize: 30 * scaleDisplay,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingPitchTitle, renderTick, geometry]);

  return (
    <div className="flex min-h-screen flex-col items-center bg-ink text-chalk">
      <div className="w-full max-w-[1400px] px-5 py-6">
        {/*
          Generic page label — deliberately not the same text as the pitch canvas's own title
          below (that one defaults to "Saturday Matchday Football" but is user-editable via the
          "Pitch title" field, since not everyone using this app is running a Saturday match).
        */}
        <h1 className="mb-4 font-display text-2xl font-bold uppercase tracking-wide text-chalk">
          Football Lineups Builder
        </h1>

        {/*
          Desktop (lg+): three columns side by side — controls sidebar, pitch, roster —
          so the page uses the full width instead of leaving empty margins beside a
          centered pitch. Below lg: stacks vertically in the same order, as before.
        */}
        <div className="flex flex-col items-stretch gap-5 lg:flex-row lg:justify-center">
          <div className="w-full rounded border border-paneledge bg-panel p-4 lg:w-[300px] lg:shrink-0">
            <div className="flex flex-wrap gap-3.5">
            <TeamPanel
              label="Team 2 · top half"
              accent={teams[2].color}
              team={teams[2]}
              onNameChange={(name) => setTeams((t) => ({ ...t, 2: { ...t[2], name } }))}
              onColorChange={(color) => setTeams((t) => ({ ...t, 2: { ...t[2], color } }))}
              onSizeChange={(size) => {
                const formationIndex = 0;
                setTeams((t) => ({ ...t, 2: { ...t[2], size, formationIndex } }));
                regenerateTeam(2, size, formationIndex);
              }}
              onFormationChange={(formationIndex) => {
                setTeams((t) => ({ ...t, 2: { ...t[2], formationIndex } }));
                regenerateTeam(2, teams[2].size, formationIndex);
              }}
            />
            <TeamPanel
              label="Team 1 · bottom half"
              accent={teams[1].color}
              team={teams[1]}
              onNameChange={(name) => setTeams((t) => ({ ...t, 1: { ...t[1], name } }))}
              onColorChange={(color) => setTeams((t) => ({ ...t, 1: { ...t[1], color } }))}
              onSizeChange={(size) => {
                const formationIndex = 0;
                setTeams((t) => ({ ...t, 1: { ...t[1], size, formationIndex } }));
                regenerateTeam(1, size, formationIndex);
              }}
              onFormationChange={(formationIndex) => {
                setTeams((t) => ({ ...t, 1: { ...t[1], formationIndex } }));
                regenerateTeam(1, teams[1].size, formationIndex);
              }}
            />
            </div>

            <div className="mt-3 flex flex-col gap-1">
              <label className="text-xs uppercase tracking-wide text-chalkdim">
                Pitch title
              </label>
              <input
                type="text"
                maxLength={40}
                value={pitchTitle}
                onChange={(e) => setPitchTitle(e.target.value)}
                placeholder={DEFAULT_PITCH_TITLE}
                className="rounded border border-paneledge bg-ink px-2.5 py-1.5 text-base text-chalk"
              />
            </div>
            <div className="mt-3 flex flex-col gap-1">
              <label className="text-xs uppercase tracking-wide text-chalkdim">
                Match tag
              </label>
              <input
                type="text"
                maxLength={28}
                value={matchTag}
                onChange={(e) => setMatchTag(e.target.value)}
                className="rounded border border-paneledge bg-ink px-2.5 py-1.5 text-base text-chalk"
              />
            </div>
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <button type="button" onClick={handleShuffle} className="btn-outline">
                Shuffle teams
              </button>
              <button type="button" onClick={() => setPoolOpen(true)} className="btn-outline">
                Manage squad
              </button>
              <button type="button" onClick={handleShare} className="btn-outline">
                {shareFeedback ? 'Link copied!' : 'Copy share link'}
              </button>
              <button type="button" onClick={() => pitchFileRef.current?.click()} className="btn-outline">
                Change pitch photo
              </button>
              <button type="button" onClick={resetPitchPhoto} className="btn-outline">
                Reset to our pitch
              </button>
              <button type="button" onClick={resetLayout} className="btn-outline">
                Reset layout
              </button>
              <button
                type="button"
                onClick={handleDownload}
                className="w-full rounded bg-amber px-3.5 py-2 text-sm font-semibold text-ink hover:opacity-90"
              >
                Download lineups
              </button>
              <input
                ref={pitchFileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handlePitchPhotoFile(file);
                  e.target.value = '';
                }}
              />
            </div>
            <p className="mt-2.5 text-xs tracking-wide text-chalkdim">
              Your lineup, squad list, and settings save automatically in this browser.
            </p>
          </div>

          <div className="relative mx-auto w-full max-w-[540px] touch-none lg:mx-0 lg:w-[560px] lg:max-w-none lg:shrink-0">
            <canvas
              ref={canvasRef}
              width={CANVAS_W}
              height={CORE_H}
              className="block w-full rounded border border-paneledge"
              style={{ cursor: dragRef.current ? 'grabbing' : 'grab' }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            />
            {editingPlayer && (
              <EditPopover
                player={editingPlayer}
                style={popoverStyle}
                poolNames={pool}
                onChange={(patch) => updatePlayer(editingPlayer.id, patch)}
                onUploadPhoto={(file) => handlePlayerPhoto(editingPlayer.id, file)}
                onRemovePhoto={() => handleRemovePlayerPhoto(editingPlayer.id)}
                onToggleCaptain={() => toggleCaptain(editingPlayer.id)}
                onDone={() => setEditingId(null)}
              />
            )}
            {editingMatchTag && (
              <input
                type="text"
                maxLength={28}
                autoFocus
                value={matchTag}
                onChange={(e) => setMatchTag(e.target.value)}
                onBlur={() => setEditingMatchTag(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur();
                }}
                style={matchTagInputStyle}
                className="absolute z-10 rounded border border-amber bg-ink px-2 text-chalk"
              />
            )}
            {editingPitchTitle && (
              <input
                type="text"
                maxLength={40}
                autoFocus
                value={pitchTitle}
                onChange={(e) => setPitchTitle(e.target.value)}
                onBlur={() => setEditingPitchTitle(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur();
                }}
                style={pitchTitleInputStyle}
                className="absolute z-10 rounded border border-amber bg-ink px-2 font-bold uppercase text-chalk"
              />
            )}
          </div>

          <div className="mx-auto w-full max-w-[540px] lg:mx-0 lg:w-[300px] lg:max-w-none lg:shrink-0">
            <canvas
              ref={rosterCanvasRef}
              width={ROSTER_W}
              height={ROSTER_H}
              className="block w-full rounded border border-paneledge"
            />
          </div>
        </div>

        <p className="mx-auto mt-4 max-w-[1200px] px-1 text-center text-sm tracking-wide text-chalkdim">
          Drag a player to move them — their position tag updates as you go · double-click (or
          double-tap) to edit number, name, photo, or captaincy
        </p>
      </div>

      {poolOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/75 p-5"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPoolOpen(false);
          }}
        >
          <div className="w-full max-w-sm rounded border border-amber bg-panel p-5">
            <h3 className="mb-1.5 text-lg font-semibold tracking-wide">Manage your squad</h3>
            <p className="mb-3.5 text-xs leading-relaxed text-chalkdim">
              Save your regulars here — they&apos;ll autocomplete when you edit a player&apos;s
              name, and &quot;Shuffle teams&quot; draws from this list first.
            </p>
            <div className="max-h-64 overflow-y-auto">
              {pool.length === 0 ? (
                <p className="text-sm text-chalkdim">No saved players yet — add your regulars below.</p>
              ) : (
                pool.map((name, i) => (
                  <div
                    key={`${name}-${i}`}
                    className="flex items-center justify-between gap-2.5 border-b border-paneledge py-1.5 text-sm"
                  >
                    <span>{name}</span>
                    <button type="button" onClick={() => handleRemovePoolName(i)} className="btn-outline text-[11px]">
                      Remove
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="mt-3.5 flex gap-2">
              <input
                type="text"
                maxLength={20}
                value={poolDraft}
                placeholder="Add a player name"
                onChange={(e) => setPoolDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddPoolName();
                }}
                className="flex-1 rounded border border-paneledge bg-ink px-2.5 py-2 text-sm text-chalk"
              />
              <button
                type="button"
                onClick={handleAddPoolName}
                className="rounded bg-amber px-3.5 py-2 text-sm font-semibold text-ink"
              >
                Add
              </button>
            </div>
            <button type="button" onClick={() => setPoolOpen(false)} className="btn-outline mt-3.5 w-full">
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface TeamPanelProps {
  label: string;
  accent: string;
  team: TeamsState[TeamId];
  onNameChange: (name: string) => void;
  onColorChange: (color: string) => void;
  onSizeChange: (size: SquadSize) => void;
  onFormationChange: (formationIndex: number) => void;
}

function TeamPanel({
  label,
  accent,
  team,
  onNameChange,
  onColorChange,
  onSizeChange,
  onFormationChange,
}: TeamPanelProps) {
  const formationOptions = FORMATION_OPTIONS[team.size];
  const safeIndex = clampFormationIndex(team.size, team.formationIndex);

  return (
    <div className="min-w-[230px] flex-1 rounded border border-paneledge p-2.5">
      <div className="mb-1.5 text-sm font-semibold tracking-wide" style={{ color: accent }}>
        {label}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="color"
          value={team.color}
          onChange={(e) => onColorChange(e.target.value)}
          className="h-8 w-8 shrink-0 rounded border border-paneledge bg-ink p-0"
        />
        <input
          type="text"
          placeholder={`${label.split(' ')[0]} ${label.split(' ')[1]} (optional)`}
          maxLength={18}
          value={team.name}
          onChange={(e) => onNameChange(e.target.value)}
          className="rounded border border-paneledge bg-ink px-2.5 py-1.5 text-base text-chalk placeholder:text-chalkdim/70"
        />
        <select
          value={team.size}
          onChange={(e) => onSizeChange(Number(e.target.value) as SquadSize)}
          className="rounded border border-paneledge bg-ink px-2.5 py-1.5 text-base text-chalk"
        >
          <option value={5}>5-a-side</option>
          <option value={6}>6-a-side</option>
          <option value={7}>7-a-side</option>
          <option value={8}>8-a-side</option>
        </select>
        <select
          value={safeIndex}
          onChange={(e) => onFormationChange(Number(e.target.value))}
          className="rounded border border-paneledge bg-ink px-2.5 py-1.5 text-base text-chalk"
        >
          {formationOptions.map((shape, i) => (
            <option key={i} value={i}>
              {formationLabel(shape)}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
