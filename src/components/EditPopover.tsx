'use client';

import { useRef } from 'react';
import type { Player } from '@/lib/types';

interface EditPopoverProps {
  player: Player;
  style: React.CSSProperties;
  onChange: (patch: Partial<Player>) => void;
  onUploadPhoto: (file: File) => void;
  onRemovePhoto: () => void;
  onToggleCaptain: () => void;
  onDone: () => void;
  /** Saved squad-pool names, offered as autocomplete suggestions on the Name field. */
  poolNames?: string[];
}

export default function EditPopover({
  player,
  style,
  onChange,
  onUploadPhoto,
  onRemovePhoto,
  onToggleCaptain,
  onDone,
  poolNames = [],
}: EditPopoverProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      className="absolute z-10 flex w-[210px] flex-col gap-2 rounded border border-amber bg-panel p-3 shadow-xl"
      style={style}
    >
      <div className="flex gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-wide text-chalkdim">No.</label>
          <input
            type="text"
            maxLength={2}
            value={player.number}
            onChange={(e) => onChange({ number: e.target.value })}
            className="w-[50px] rounded border border-paneledge bg-ink px-2 py-1.5 text-center text-sm text-chalk"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-wide text-chalkdim">Position</label>
          <input
            type="text"
            maxLength={4}
            value={player.role}
            onChange={(e) => onChange({ role: e.target.value.toUpperCase() })}
            className="w-[66px] rounded border border-paneledge bg-ink px-2 py-1.5 text-center text-sm uppercase text-chalk"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[10px] uppercase tracking-wide text-chalkdim">Name</label>
        <input
          type="text"
          maxLength={16}
          value={player.name}
          onChange={(e) => onChange({ name: e.target.value })}
          className="w-full rounded border border-paneledge bg-ink px-2 py-1.5 text-sm text-chalk"
          list="poolNames"
          autoFocus
        />
        {poolNames.length > 0 && (
          <datalist id="poolNames">
            {poolNames.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[10px] uppercase tracking-wide text-chalkdim">Photo</label>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 rounded border border-paneledge bg-ink px-2 py-1.5 text-[11px] text-chalk hover:border-amber"
          >
            {player.photoUrl ? 'Change' : 'Upload'}
          </button>
          <button
            type="button"
            disabled={!player.photoUrl}
            onClick={onRemovePhoto}
            className="flex-1 rounded border border-paneledge bg-ink px-2 py-1.5 text-[11px] text-chalk hover:border-amber disabled:opacity-40"
          >
            Remove
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onUploadPhoto(file);
            e.target.value = '';
          }}
        />
      </div>

      <button
        type="button"
        onClick={onToggleCaptain}
        className="w-full rounded border border-paneledge bg-ink px-2 py-1.5 text-xs text-chalk hover:border-amber"
      >
        {player.captain ? 'Remove captain' : 'Set as captain'}
      </button>

      <p className="text-[10.5px] leading-tight text-chalkdim">
        Position updates automatically while you drag. Type a custom tag (e.g. CF, AM) to lock it in.
      </p>

      <button
        type="button"
        onClick={onDone}
        className="w-full rounded bg-amber px-2 py-1.5 text-xs font-semibold text-ink"
      >
        Done
      </button>
    </div>
  );
}
