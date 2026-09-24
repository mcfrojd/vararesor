# CLAUDE.md

Vägledning för Claude Code i det här repot. Läs även [README.md](README.md), som är projektets beskrivning och plan.

## Projektet

**Våra resor**: familjens resedagbok som PWA, inspirerad av Jorial. Fokus på husbilsresor med Doris, men även semestrar och egna resor. Svenska i UI, kod-kommentarer och dokumentation.

## Stack

- **PocketBase** (v0.40.x, pinnad i `Dockerfile` via `PB_VERSION`): databas, auth, filer (S3 mot Synology), backup.
- **SvelteKit** i `web/`: Svelte 5 (runes), TypeScript, Tailwind v4, `@vite-pwa/sveltekit`. Byggs som statisk SPA (`adapter-static`, `fallback: index.html`, `ssr = false`) och serveras av PocketBase från `pb_public/`.
- **En Docker-container** (`Dockerfile`, `docker-compose.yml`), data i `./pb_data`.
- Schema som JS-migreringar i `pocketbase/pb_migrations/` (v0.23+-syntax: `new Collection({ fields: [...] })`). Serverlogik i `pocketbase/pb_hooks/`.

## Kommandon

```bash
# Hela appen i Docker
docker compose up -d --build
docker compose exec vararesor /pb/pocketbase superuser upsert EPOST LÖSEN

# Utveckling
docker compose up -d          # PocketBase på :8090
cd web && npm install
npm run dev                   # :5173, /api och /_ proxas till :8090
npm run check                 # typkontroll – ska ge 0 fel
npm run build
```

Verifiera UI-ändringar med Playwright (Chromium) i både mobilbredd (390px) och laptop, ljust och mörkt tema.

## Status

Klart: skelett med inloggning, resa-lista, `trips`-collection med regler (bara ägare/deltagare ser, bara ägare ändrar), egen registrering avstängd, Docker för amd64/arm64.

Nästa steg: se avsnitt 11 i README.md (skapa/redigera resor → dagar och inlägg med mallar → bilder med webp-skalning → publicering → offline och karta).

## Publicering till husbilendoris.se

Sajten är Hugo i det privata repot `hugo-mcfrojd/husbil` (Cloudflare Pages bygger från `master`). Formatet som appen ska skapa står i README.md avsnitt 6. I korthet:

- `content/resor/<resa>/dagNN/index.md` + `cover.webp` (ca 2600×1040) + `images/*.webp` (ca 800 px breda).
- GPS-spår hämtas redan av en GitHub Action till `static/tracks/doris-ÅÅÅÅ-MM-DD.kml`; appen refererar bara till filen via `{{< track files="..." >}}`.
- Publicering sker från servern (pb_hooks) via GitHub API, en commit per publicering. Token får aldrig nå webbläsaren.
- **Testmiljön får aldrig publicera till `master`.** Målbranch ska styras via `.env` och vara en testbranch (eller avstängd) utanför produktion.

## Miljö

Utvecklingen sker i en LXC på Proxmox (Debian/Ubuntu, Docker, Node 22, Tailscale). Appen testas från mobilen via `tailscale serve` (HTTPS krävs för PWA/service worker). Använd en separat testbucket på Synology.
