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

Klart:
- Skelett med inloggning, egen registrering avstängd, Docker för amd64/arm64.
- Resor (`trips`): skapa, visa, redigera, ta bort, omslagsbild och deltagare. Bara ägare/deltagare ser, bara ägaren ändrar.
- Dagar och inlägg (`posts`) med mallar: övernattning, mat och dryck, sevärdhet, anteckning. Dagarna räknas fram ur resans datum.
- Karta (MapLibre + OpenFreeMap, ingen nyckel) på resa, inlägg och `/karta`, med Doris GPS-spår och filter för typ, spår och period.
- Tid på inlägg, startsida med pågående/kommande/tidigare resor, kalender (`/kalender`).
- Väder per inlägg från Open-Meteo via `pocketbase/pb_hooks/weather.js` (hookar i `weather.pb.js`, timjobb `weather`). Hookar körs isolerat: delad kod via `require(`${__hooks}/weather.js`)`. Spara utan nya hookar med `app.unsafeWithoutHooks().save()`.
- Utseende i stil med jorial.app: se klasserna i `web/src/app.css` (`card`, `field`, `label`, `chip`, `title`, `btn-*`) och komponenterna `Icon`, `Fab`, `BackLink`. Använd dem i stället för egna Tailwind-kombinationer.
- S3 (Garage på Synology via Tailscale) för filer och backup, styrt av `.env` via `pocketbase/pb_hooks/storage.pb.js`. Den riktiga appen (port 8090, `pb_data/`, `.env`) använder `vararesor-media` och `vararesor-backup`. Testmiljön (`docker-compose.test.yml`, port 8091, `pb_data_test/`, `.env.test`) använder `vararesor-test` och ingen S3-backup. Ändra aldrig S3 i admin-gränssnittet när `S3_ENDPOINT` är satt: det skrivs över vid omstart.
- Bilder (`photos`): skalas till webp (`web` 1600 px, `thumb` 480 px) i mobilen i `src/lib/photos.ts`, med `@jsquash/webp` som reserv i Safari. EXIF läses med `exifr`. Laddas alltid upp via kön i `offline.svelte.ts` (små filer först, sedan originalet). Visas med `PhotoPicker`, `PhotoGallery`, på `PostCard` och på kartan. Hämtas med `expand: 'photos_via_post'` på inläggen. Bilder kan sakna inlägg (`post = ""`) och hör då bara till dagen ("Dagens bilder"). Många bilder på en gång: `/trips/[id]/photos`, sortering i `src/lib/photoMatch.ts`. `PostForm` låter en välja dagens bilder (prop `dayPhotos`) och fyller tid och plats från dem; flytten görs med `attachPhotos` (köas i Dexie-tabellen `moves` utan nät). Alla på resan får ändra `post` på andras bilder, inget annat. Fliken Bilder (`/bilder`): ett album per resa, omslagsbild från en bild, uppladdning över alla resor (`/bilder/ladda-upp`, `tripForDay` i `photoMatch.ts`). Bilder som inte passar någon resa saknar `trip` (okategoriserade, syns bara för den som laddat upp) och flyttas av `pb_hooks/albums.js` när en resa med rätt datum skapas eller ändras.
- Doris spår: kartan läser GPX (`tracks/gpx/…gpx`) och annars KML (`src/lib/tracks.ts`). Servern sätter position från spåret på bilder utan GPS och inlägg med tid men utan position, på husbilsresor (`pb_hooks/tracks.js`, hookar och timjobb `tracks` i `tracks.pb.js`). `location_source` visar varifrån positionen kommer; `manual` rörs aldrig.
- Offline: appen och lästa data cachas av service workern; nya inlägg köas i Dexie (`src/lib/offline.svelte.ts`) och skickas när nätet är tillbaka.

Nästa steg: publicering till husbilendoris.se (väntar på användaren).

**Säkerhet:** appen körs bara via Tailscale för två användare, så säkerheten är medvetet enkel (t.ex. är filer inte `protected`). Innan appen blir nåbar utan Tailscale måste säkerheten ses över rejält; se README, avsnittet Säkerhet. Påminn användaren om det om frågan om publik åtkomst kommer upp.

**Testa aldrig mot den riktiga appen på 8090**; den har familjens data och produktionens bucket. Kör tester mot testmiljön på 8091 (`docker compose -f docker-compose.test.yml up -d --build` efter ändringar; `docker exec vararesor-test …` för superuser). Tips vid test: skapa en tillfällig superuser och testkonton `*@example.com`, och ta bort dem efteråt. MapLibre i headless Chromium behöver `--use-angle=swiftshader --enable-unsafe-swiftshader`. Offline testas med `context.setOffline(true)` efter att service workern tagit kontroll (`navigator.serviceWorker.controller`).

## Publicering till husbilendoris.se

Sajten är Hugo i det privata repot `hugo-mcfrojd/husbil` (Cloudflare Pages bygger från `master`). Formatet som appen ska skapa står i README.md avsnitt 6. I korthet:

- `content/resor/<resa>/dagNN/index.md` + `cover.webp` (ca 2600×1040) + `images/*.webp` (ca 800 px breda).
- GPS-spår hämtas redan av en GitHub Action till `static/tracks/doris-ÅÅÅÅ-MM-DD.kml`; appen refererar bara till filen via `{{< track files="..." >}}`.
- Publicering sker från servern (pb_hooks) via GitHub API, en commit per publicering. Token får aldrig nå webbläsaren.
- **Testmiljön får aldrig publicera till `master`.** Målbranch ska styras via `.env` och vara en testbranch (eller avstängd) utanför produktion.

## Miljö

Utvecklingen sker i en LXC på Proxmox (Debian/Ubuntu, Docker, Node 22, Tailscale). Appen testas från mobilen via `tailscale serve` (HTTPS krävs för PWA/service worker). Tester körs mot testmiljön på port 8091 med testbucketen på Synology.
