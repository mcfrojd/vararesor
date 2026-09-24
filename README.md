# Våra resor

En enkel och stilren resedagbok för familjen, byggd som en **PWA** (Progressive Web App).

> Status: tidigt skede (inloggning, resor, dagar och inlägg med mallar, karta, offline). Bilder kommer härnäst. Dokumentet beskriver vad appen ska bli och fylls på efter hand.

---

## 1. Vad är det?

**Våra resor** är en app där vi dokumenterar våra resor: var vi varit, vad vi gjort, ätit och sett, med bilder och film.

- Snygg, stilren och enkel att använda.
- Fungerar lika bra på **mobilen** som på **laptopen**.
- Går att "installera" på hemskärmen som en vanlig app (PWA).
- Körs på egen server. Vi äger vår data.

## 2. Inspiration

[Jorial](https://jorial.app/) har ett bra grundupplägg och används som förebild:

- **Resa → dagar → inlägg/platser**
- Bilder kopplade till inlägg och platser
- Karta över resans rutt och platser
- Tidslinje att bläddra i

## 3. Typer av resor

| Typ | Beskrivning |
|-----|-------------|
| **Husbilsresa med Doris** | Resor med husbilen. Egna mallar för ställplatser, campingar m.m. Kan publiceras till [husbilendoris.se](https://husbilendoris.se). |
| **Gemensam semester** | Andra resor som familjen gör tillsammans (flyg, hotell, stugor…). |
| **Egen resa** | En av oss reser själv eller med kompisar. |

Varje resa har en **ägare** och **deltagare**.

## 4. Användare och inloggning

- Alla loggar in med eget konto.
- Varje inlägg, bild och anteckning visar **vem som lagt upp den**.
- Familjens medlemmar kan se och bidra till gemensamma resor.

## 5. Mallar för inlägg

Olika typer av inlägg har olika fält. Det gör det snabbt att fylla i på plats.

### Övernattning: ställplats, camping, fricamping
- Namn, typ (ställplats / camping / fricamping)
- Position (GPS / karta)
- Pris, betalsätt
- Faciliteter: el, vatten, tömning (grå-/svartvatten), dusch, WiFi
- Underlag, utsikt, ljudnivå
- Betyg och anteckning
- Bilder

### Mat och dryck
- Namn, typ (restaurang, café, bar, bryggeri, vingård…)
- Position
- Vad vi åt/drack, ungefärligt pris
- Betyg och anteckning
- Bilder

### Sevärdhet och nöje
- Namn, typ (natur, museum, stad, aktivitet…)
- Position
- Entré/pris, öppettider
- Betyg och anteckning
- Bilder

### Fri anteckning
- Vanlig dagbokstext med bilder, för allt annat.

## 6. Dagssammanfattning och publicering till husbilendoris.se

Extrafunktion utöver Jorial, för husbilsresorna:

1. På kvällen öppnar man **dagens sammanfattning**. Appen samlar dagens inlägg: rutt, övernattning, mat, sevärdheter och bilder.
2. Man läser igenom, justerar text och väljer vilka bilder som ska med.
3. Man **publicerar** till [husbilendoris.se](https://husbilendoris.se) med en knapp.

Varje dag har en **publiceringsstatus**:

| Status | Betydelse |
|--------|-----------|
| Ej publicerad | Dagen finns bara i appen. |
| Publicerad | Dagen ligger ute på hemsidan. |
| Ändrad efter publicering | Något har ändrats i appen sedan dagen publicerades. Kan publiceras om. |

Man kan alltså **gå tillbaka** och publicera dagar man missat, eller **uppdatera** tidigare dagar i efterhand.

### Hur publiceringen fungerar

husbilendoris.se är en Hugo-sajt (tema Beautiful Hugo) i det privata repot [`hugo-mcfrojd/husbil`](https://github.com/hugo-mcfrojd/husbil). En push till `master` gör att **Cloudflare Pages** bygger och publicerar sajten automatiskt.

Publicering från appen blir därför en **commit till det repot via GitHub API**. Sajten gör redan så för GPS-spåren (`functions/api/tracks/`), så mönstret är beprövat.

```
Våra resor (PocketBase)
   │  1. Bygger dagens index.md (front matter + text + shortcodes)
   │  2. Skapar cover.webp och webbanpassade bilder i images/
   ▼
GitHub API → en commit till hugo-mcfrojd/husbil (master)
   ▼
Cloudflare Pages kör build.sh → husbilendoris.se
```

#### Format som appen ska skapa

Samma struktur som sajtens befintliga dagar och `dag`-arketypen (`archetypes/dag.md`):

```
content/resor/<resa>/            t.ex. tyskland-2026
├── _index.md                    resans sida (skapas när resan publiceras första gången)
├── <resa>.webp                  resans omslagsbild
└── dagNN/                       dag01, dag02 …
    ├── index.md                 dagens text
    ├── cover.webp               stor rubrikbild (ca 2600×1040)
    └── images/*.webp            galleribilder (ca 800 px bred)
```

Front matter i `dagNN/index.md`:

```yaml
---
title: 'Dag 05 - 28 aug'
date: 2026-08-28T23:04:49+02:00
slug: dag05
draft: false
type: "post"
bigimg: [{src: "cover.webp"}]
image: /resor/tyskland-2026/dag05/cover.webp
description: "Husbilen Doris Tysklands resa dag 05, Dorfmark till Würzburg"
Params:
  tags: ["husbil", "husbilen", "doris", "resa", "resor", "tyskland-2026", "dag05"]
---
```

Därefter kommer dagens text, Instagram-rutan, galleriet och GPS-spåret:

```
{{< shortgallery match="images/*" ... >}}
{{< track files="doris-2026-08-28.kml" height="450" >}}
```

- **GPS-spår:** en befintlig GitHub Action hämtar varje morgon gårdagens spår från Traccar till `static/tracks/doris-ÅÅÅÅ-MM-DD.kml`. Appen behöver alltså inte skicka spåret, bara referera till rätt fil utifrån datumet.
- **Text:** appen föreslår dagens text utifrån inläggen (övernattning, mat och dryck, sevärdheter, fria anteckningar). Man redigerar den innan publicering.
- **Ompublicering:** varje dag har en fast sökväg (`dagNN/index.md`). En ny publicering skriver över samma filer i stället för att skapa nya. Bilder som tagits bort i appen tas också bort i repot.
- **En commit per publicering** (Git Data API: blobs → tree → commit), så att sajten bara byggs en gång.
- **Säkerhet:** anropet görs från servern (PocketBase), aldrig från webbläsaren. Nyckeln är en *fine-grained* GitHub-token med `Contents: write` bara för `husbil`-repot. Den skapas på kontot `hugo-mcfrojd`, eller på `mcfrojd` som är medarbetare i repot, och sparas som hemlighet på servern.
- **Spårbarhet:** appen sparar publicerad commit och en hash av innehållet per dag. Därigenom vet den när en dag är *ändrad efter publicering*.

## 7. Bilder och film

- Original lagras på vår privata **S3-lagring** (Synology hemma).
- Appen skapar automatiskt **webbanpassade versioner** i `.webp`, samma som sajten använder idag: galleribilder ca 800 px breda och en omslagsbild (`cover.webp`) ca 2600×1040.
- Originalen sparas alltid orörda.

## 8. Teknik

| Del | Val |
|-----|-----|
| Databas, inloggning, API | [PocketBase](https://pocketbase.io/) |
| Gränssnitt | [SvelteKit](https://svelte.dev/docs/kit) (Svelte 5, TypeScript) byggd som statisk app (SPA) |
| Utseende | [Tailwind CSS](https://tailwindcss.com/), ljust och mörkt tema efter enhetens inställning |
| PWA | [@vite-pwa/sveltekit](https://vite-pwa-org.netlify.app/frameworks/sveltekit): manifest och service worker |
| Offline | Service workern cachar appen, API-svar (nätet först) och bilder. Nya inlägg utan täckning köas i [Dexie](https://dexie.org/) (IndexedDB) och skickas när nätet är tillbaka. |
| Karta | [MapLibre GL](https://maplibre.org/) med gratis kartor från [OpenFreeMap](https://openfreemap.org/) (OpenStreetMap-data, ingen API-nyckel). Husbilsresor visar Doris körda spår. |
| Bilder | Skalas om till `.webp` i mobilen före uppladdning; originalet sparas också |
| Fillagring | S3 (Synology) via PocketBase |
| Backup | PocketBase inbyggda S3-backup |
| Publicering | PocketBase JS-hooks (`pb_hooks/`) → GitHub API → `hugo-mcfrojd/husbil` → Cloudflare Pages |
| Drift | En Docker-container: PocketBase serverar både API och appen |

### Projektstruktur

```
vararesor/
├── Dockerfile               bygger web/ och lägger det i PocketBase pb_public/
├── docker-compose.yml       en tjänst, data i ./pb_data
├── .env.example             mall för .env
├── pocketbase/
│   ├── pb_migrations/       databasschema (körs automatiskt vid start)
│   └── pb_hooks/            serverlogik, t.ex. publicering (kommer)
└── web/                     SvelteKit-appen
    └── src/
        ├── lib/             PocketBase-klient, inloggning, hjälpfunktioner
        └── routes/          sidor: / (resor), /login, /trips/new,
                             /trips/[id] (resa + dagar), /trips/[id]/edit,
                             /trips/[id]/posts/new, /trips/[id]/posts/[postId](/edit),
                             /karta (alla platser)
```

### Databas (hittills)

| Collection | Innehåll |
|------------|----------|
| `users` | Familjens konton (`name`, `email`, `avatar`). Egen registrering är avstängd; konton skapas i admin. Inloggade ser varandras namn och avatar (för att kunna välja deltagare), men e-post syns bara för en själv. |
| `trips` | Resor: `title`, `type` (`husbil` / `semester` / `egen`), `start_date`, `end_date`, `description`, `cover`, `owner`, `participants`. Syns bara för ägaren och deltagarna. Bara ägaren kan ändra och ta bort. |
| `posts` | Inlägg: `trip`, `author`, `kind` (`overnight` / `food` / `sight` / `note`), `day`, `time` (valfri, TT:MM; utan tid sorteras inlägget efter när det skapades), `title`, `category`, `body`, `rating` (0–5), `price`, `location` (geoPoint), `details` (JSON med mallens egna fält: faciliteter, betalsätt, underlag, utsikt, ljudnivå, vad vi åt, öppettider). Syns för resans ägare och deltagare, som också kan skriva. Bara författaren ändrar; författaren eller resans ägare kan ta bort. Tas bort med resan. |

### Karta

- **Resans sida:** inläggen med position som markörer. Husbilsresor visar också Doris körda spår (heldragen linje); andra resor får en streckad linje mellan inläggen i tidsordning.
- **Inlägg:** liten karta över platsen, plus länk till OpenStreetMap.
- **/karta:** alla platser från alla resor man har tillgång till.

- **Filter** (på resans karta och /karta): välj typer av inlägg (övernattning, mat, sevärt, anteckningar), GPS-spår av/på, och period: allt, senaste 3 dagarna, veckan, månaden eller valfria datum. Perioden gäller inläggens dag. Knapparna visar antal inom perioden. /karta kommer ihåg filtret på enheten. Filter för bilder kommer med bilduppladdningen.
- **Spår på /karta:** för husbilsresornas dagar inom perioden, högst de 60 senaste dagarna åt gången.

Kartbilderna hämtas från OpenFreeMap och sparas inte offline än.

### Offline

- **Läsa:** appen startar utan nät. Resor, inlägg och bilder man redan öppnat visas från cachen (nätet går först, cachen används när det inte svarar inom 6 s).
- **Skriva:** nya inlägg utan nät (eller när anropet inte kommer fram) läggs i en kö på enheten och visas streckade med "Väntar på nät". Kön skickas när nätet kommer tillbaka och var 30:e sekund. Inlägget får sitt id i appen, så ett nytt försök skapar aldrig dubbletter.
- **Inte offline än:** ändra eller ta bort befintliga inlägg, skapa resor, kartbilder.
- **Utloggning** tömmer kön och cachen på enheten, och varnar om något inte skickats.

Dagarna räknas fram ur resans datum (dag 1 = startdatum) och inläggens `day`; det finns ingen egen tabell för dagar än. Den kommer med publiceringen, där varje dag behöver egen status, sammanfattning och commit.

## 9. Kom igång

### Köra på en server (Ubuntu, hemma eller Oracle)

Kräver Docker med compose-plugin. Fungerar på både amd64 och arm64 (Oracle Ampere).

```bash
git clone https://github.com/mcfrojd/vararesor.git
cd vararesor
cp .env.example .env          # justera PORT vid behov
docker compose up -d --build
```

Skapa ett administratörskonto för PocketBase:

```bash
docker compose exec vararesor /pb/pocketbase superuser upsert din@epost.se ett-langt-losenord
```

Gå sedan till `http://<server>:8090/_/` och:

1. Skapa familjens konton under **users** (namn, e-post, lösenord, bocka i *verified*).
2. **Settings → Files storage:** koppla S3 mot Synology.
3. **Settings → Backups:** slå på schemalagd backup till S3.
4. Sätt **Settings → Application URL** till den publika adressen.

Appen nås på `http://<server>:8090/`. Lägg den bakom en reverse proxy med HTTPS (t.ex. Caddy, Nginx Proxy Manager eller Cloudflare Tunnel). PWA-installation och service worker kräver HTTPS.

**Uppdatera:** `git pull && docker compose up -d --build`. Databasen i `./pb_data` ligger kvar och nya migreringar körs automatiskt.

### Utveckla lokalt

```bash
docker compose up -d                 # PocketBase på :8090
cd web
npm install
npm run dev                          # appen på :5173, /api skickas vidare till :8090
```

`npm run check` kör typkontroll och `npm run build` bygger appen.

## 10. Öppna frågor

- [x] Vad körs husbilendoris.se på? **Hugo i `hugo-mcfrojd/husbil`, publiceras via Cloudflare Pages.**
- [x] Innehållsstruktur? **Page bundles `content/resor/<resa>/dagNN/` med `index.md`, `cover.webp` och `images/` (se avsnitt 6).**
- [ ] Bilderna ligger i repot idag (`content/resor` är ca 150 MB). Ska det fortsätta så, eller ska bilderna på sikt ligga i en publik lagring (t.ex. Cloudflare R2)?
- [x] Ska Traccar-spåren även visas i appen? **Ja, på husbilsresornas karta. Appen läser `husbilendoris.se/tracks/doris-ÅÅÅÅ-MM-DD.kml` direkt (publika, CORS öppet).**
- [x] Behövs offline-stöd när vi står utan täckning? **Ja: läsa det man redan öppnat och skriva nya inlägg, som skickas när nätet är tillbaka.**
- [ ] Karta och GPS: automatisk position på inlägg? Spåra rutten under dagen?
- [x] Vilket frontend-ramverk? **SvelteKit.**
- [ ] Hur ska film hanteras (storlek, komprimering, publicering)?
- [ ] Vem ser vad? Är egna resor privata som standard?

## 11. Nästa steg

1. ~~Välja frontend-ramverk.~~ SvelteKit.
2. ~~Skelett med PocketBase + SvelteKit i Docker, inloggning och resa-lista.~~
3. ~~Skapa och redigera resor (inklusive omslagsbild och deltagare).~~
4. ~~Dagar och inlägg med mallar (övernattning, mat och dryck, sevärdhet, fri anteckning).~~
5. Bilduppladdning med `.webp`-skalning och S3 mot Synology.
6. Dagssammanfattning och publicering till husbilendoris.se.
7. ~~Offline-kö. Karta.~~
