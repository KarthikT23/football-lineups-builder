# Saturday Matchday Football

A lineup/formation builder for 5–8-a-side football. Pick a squad size and kit
color for each team, pick one of two formation shapes per size, drag players
into position (their position tag — CB, DM, AM, CF, etc. — updates live as
you move them), add photos or a captain's armband, shuffle both squads from a
saved player pool, and export a shareable matchday graphic. Everything —
lineup, formations, squad pool — autosaves in the browser and reloads
automatically next time you open the page.

Built with Next.js (static export), TypeScript, Tailwind CSS, and the HTML
Canvas API — no backend, everything runs in the browser.

## Running it locally

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## Building a static site

```bash
npm run build
```

This produces a fully static `out/` folder (via Next's `output: 'export'`)
that you can host anywhere — GitHub Pages, Netlify, S3, or just open
`out/index.html` directly.

## Deploying to GitHub Pages

A ready-made workflow is included at `.github/workflows/deploy.yml`. To use it:

1. Push this repo to GitHub.
2. In the repo's **Settings → Pages**, set **Source** to **GitHub Actions**.
3. Push to `main` (or run the workflow manually from the **Actions** tab).

The site will be published at `https://<your-username>.github.io/<repo-name>/`.

The workflow automatically sets `NEXT_PUBLIC_BASE_PATH` to `/<repo-name>` so
that all the app's asset links (the pitch photo, etc.) resolve correctly under
that subpath. Two things worth knowing if your setup differs:

- **User/organization page** (a repo literally named `<your-username>.github.io`,
  served at the domain root): edit the workflow and change
  `NEXT_PUBLIC_BASE_PATH: /${{ github.event.repository.name }}` to
  `NEXT_PUBLIC_BASE_PATH: ""`.
- **Custom domain**: same as above — the site lives at the domain root, so
  `NEXT_PUBLIC_BASE_PATH` should be empty.

## Project layout

```
src/
  app/                 Next.js App Router entry (layout, page, global CSS)
  components/
    FormationBuilder.tsx  Main interactive component: canvas, drag/edit, controls,
                           autosave/restore, squad pool modal, shuffle, share link
    EditPopover.tsx        Floating panel for editing a selected player
                            (name field autocompletes from the saved squad pool)
  lib/
    types.ts             Player / team types
    formation.ts          Formation option tables (2 shapes per squad size),
                           position zones, layout generation, live formation string
    geometry.ts            Flat pitch dimensions/coordinate math
    state.ts                Serialize/deserialize app state (autosave + share link)
    pool.ts                  Saved squad-pool list (add/remove names)
    shuffle.ts                Fisher–Yates shuffle + team-shuffle logic
    share.ts                   Share-link encode/decode (URL fragment)
    draw.ts                     All canvas rendering (pitch, chrome, players, roster)
    canvas-utils.ts               Drawing primitives + image helpers
    color.ts                       Small hex color shading helper
public/
  pitch.png             Bundled default pitch photo (flat top-down, used as-is)
```

## Notes

- The default pitch photo (`public/pitch.png`) is a flat top-down shot used
  directly, no rotation or perspective warp. Anyone using the site can upload
  a different one per-session via "Change pitch photo".
- Uploaded photos (pitch or player) never leave the browser — they're read
  with `FileReader` into memory and drawn straight to the canvas, nothing is
  sent anywhere.
- Position tags auto-update based on where a player is standing (both depth
  and side) unless you type a custom tag in the edit panel, which locks it.
- Lineup, formations, match tag, and the saved squad pool all autosave to
  `localStorage` and restore automatically on reload. This is per-browser,
  per-origin storage — it won't follow you to a different browser, device, or
  URL (e.g. `localhost` during dev vs. your deployed GitHub Pages URL are
  separate origins).
