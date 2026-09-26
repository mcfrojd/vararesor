# Våra resor

En enkel och stilren resedagbok för familjen, byggd som en **PWA** (Progressive Web App).

> Status: tidigt skede (inloggning, resor, dagar och inlägg med mallar, bilder, karta, kalender, väder, offline). Publicering till husbilendoris.se kommer härnäst. Dokumentet beskriver vad appen ska bli och fylls på efter hand.

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

Så fungerar det i appen nu:

- **Lägga till:** i formuläret för inlägg, under "Bilder". Man kan välja flera bilder på en gång, från kameran eller biblioteket.
- **I mobilen** läses bilden in rättvänd och skalas till två webp-filer: `web` (längsta sida 1600 px, för att visa i appen) och `thumb` (480 px, för listor och kartan). Chrome och Firefox skapar webp själva; Safari kan inte, så där används en webp-kodare i WebAssembly (`@jsquash/webp`), som följer med appen och fungerar offline.
- **EXIF:** tid (med tidszon) och GPS läses ur bilden (`exifr`). Har inlägget ingen position föreslås bildens. Saknar bilden GPS (många mobiler tar bort den vid uppladdning från webben) tar servern positionen ur Doris spår vid bildens tidpunkt (se Karta). Går inte det heller visas bilden vid inläggets position.
- **Många bilder på en gång:** "Lägg till bilder" på resans sida (`/trips/<id>/photos`). Varje bild sorteras till dagen den togs (EXIF-tid; utan tid väljer man dag) och läggs i ett inlägg samma dag om bildens GPS är inom 300 m från inlägget, eller tiden är inom en timme från inläggets tid (inte om platserna är mer än 2 km isär). Annars hamnar den under dagen som "Dagens bilder". Förslagen visas innan något laddas upp och kan ändras per bild. Bilder som redan finns på resan (samma tidpunkt och storlek) känns igen och följer inte med om man inte bockar i dem. Logiken finns i `src/lib/photoMatch.ts`.
- **Bilder-fliken:** ett album per resa (omslag = resans omslagsbild, annars första bilden), och sist *Okategoriserat*. I ett album kan resans ägare öppna en bild och välja *Omslag* för att göra den till resans omslagsbild. *Ladda upp* sorterar bilder över alla resor: resan vars datum omfattar dagen bilden togs (tidigast startande om flera), sedan dag och inlägg som ovan. Passar ingen resa blir bilden okategoriserad (utan `trip`); sådana bilder syns bara för den som laddat upp dem. När en resa skapas eller får nya datum flyttar servern in de okategoriserade bilder som passar (dagen inom resan, och uppladdaren är ägare eller deltagare), under dagens bilder (`pb_hooks/albums.js`). En okategoriserad bild kan också läggas i en resa för hand. Tas en resa bort blir dess bilder okategoriserade i stället för att försvinna. I albumen visar en liten profilbild i hörnet vem som laddat upp bilden. I bildvisningen (överallt) öppnar kartknappen bildens position i Google Maps, om bilden har en. Bilder tas bort i visningen (papperskorgen) eller flera på en gång med *Ta bort* i albumet; den som laddat upp bilden och resans ägare får ta bort den.
- **Dagens bilder i ett nytt inlägg:** finns det dagens bilder när man skriver ett inlägg (eller redigerar ett) visas de överst: "Vill du ta med någon av dagens bilder?". Valda bilder flyttas in i inlägget när det sparas, även utan nät (flytten köas). Tid och plats hämtas från den tidigaste valda bilden så länge man inte fyllt i dem själv, och töms igen om man väljer bort bilden.
- **Uppladdning** går alltid via kön på enheten, i två steg: först de små webp-filerna (bilden syns direkt), sedan originalet. Utan nät väntar bilderna i kön; de skickas efter sitt inlägg.
- **Visa:** miniatyrer på inläggskorten, galleri på inlägget med helskärm (svep, piltangenter, tillbaka-knappen stänger) och länk till originalet. På kartan visas bilderna som miniatyrer, grupperade per inlägg och plats, med ett eget filter.
- **Offline:** miniatyrer och webbilder som visats cachas; originalen cachas inte.

Webbversionerna för husbilendoris.se (800 px och `cover.webp`) skapas vid publiceringen, från originalen.

## 8. Teknik

| Del | Val |
|-----|-----|
| Databas, inloggning, API | [PocketBase](https://pocketbase.io/) |
| Gränssnitt | [SvelteKit](https://svelte.dev/docs/kit) (Svelte 5, TypeScript) byggd som statisk app (SPA) |
| Utseende | [Tailwind CSS](https://tailwindcss.com/), ljust och mörkt tema efter enhetens inställning. Stil efter [jorial.app](https://jorial.app/): krämig bakgrund, vita kort, Newsreader (serif) i rubriker och Plus Jakarta Sans i text (paketerade med appen), salviagrönt och terrakotta, flikrad längst ner och rund plusknapp. Gemensamma klasser (`card`, `field`, `label`, `chip`, `btn-primary` …) i `web/src/app.css`. |
| PWA | [@vite-pwa/sveltekit](https://vite-pwa-org.netlify.app/frameworks/sveltekit): manifest och service worker |
| Offline | Service workern cachar appen, API-svar (nätet först) och bilder. Nya inlägg utan täckning köas i [Dexie](https://dexie.org/) (IndexedDB) och skickas när nätet är tillbaka. |
| Karta | [MapLibre GL](https://maplibre.org/) med gratis kartor från [OpenFreeMap](https://openfreemap.org/) (OpenStreetMap-data, ingen API-nyckel). Husbilsresor visar Doris körda spår. |
| Bilder | Skalas om till `.webp` i mobilen före uppladdning; originalet sparas också |
| Fillagring | S3 (Synology) via PocketBase |
| Backup | PocketBase inbyggda S3-backup |
| Väder | [Open-Meteo](https://open-meteo.com/) (gratis, ingen API-nyckel). Hämtas av servern (`pb_hooks/weather.js`) och sparas på inlägget. |
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
│   └── pb_hooks/            serverlogik: väder (weather.js), publicering (kommer)
└── web/                     SvelteKit-appen
    └── src/
        ├── lib/             PocketBase-klient, inloggning, hjälpfunktioner
        └── routes/          sidor: / (resor), /login, /profil, /kalender, /trips/new,
                             /trips/[id] (resa + dagar), /trips/[id]/edit,
                             /trips/[id]/posts/new, /trips/[id]/posts/[postId](/edit),
                             /karta (alla platser)
```

### Databas (hittills)

| Collection | Innehåll |
|------------|----------|
| `users` | Familjens konton (`name`, `email`, `avatar`). Egen registrering är avstängd; konton skapas i admin. Inloggade ser varandras namn och avatar (för att kunna välja deltagare), men e-post syns bara för en själv. |
| `trips` | Resor: `title`, `type` (`husbil` / `semester` / `egen`), `start_date`, `end_date`, `description`, `cover`, `owner`, `participants`. Syns bara för ägaren och deltagarna. Bara ägaren kan ändra och ta bort. |
| `photos` | Bilder: `trip` (tomt = okategoriserad), `post` (tomt = dagens bilder), `author`, `day`, `taken` (ÅÅÅÅ-MM-DD TT:MM enligt kameran), `taken_at` (samma tidpunkt i UTC), `location` (geoPoint från EXIF eller Doris spår, annars 0,0), `location_source` (`exif`/`track`), `width`, `height`, `original` (orört, upp till 60 MB), `web` och `thumb` (webp). Samma behörighet som inläggen; bara den som laddat upp ändrar bilden. Alla på resan kan flytta en bild mellan inlägg och dagen inom resan, men inte ändra något annat på andras bilder. Tas bort med inlägget; blir okategoriserad när resan tas bort. |
| `posts` | Inlägg: `trip`, `author`, `kind` (`overnight` / `food` / `sight` / `note`), `day`, `time` (valfri, TT:MM; utan tid sorteras inlägget efter när det skapades), `title`, `category`, `body`, `rating` (0–5), `price`, `location` (geoPoint), `location_source` (`manual`/`photo`/`track`), `weather` (JSON, sätts av servern), `details` (JSON med mallens egna fält: faciliteter, betalsätt, underlag, utsikt, ljudnivå, vad vi åt, öppettider). Syns för resans ägare och deltagare, som också kan skriva. Bara författaren ändrar; författaren eller resans ägare kan ta bort. Tas bort med resan. |

### Karta

- **Resans sida:** inläggen med position som markörer. Husbilsresor visar också Doris körda spår (heldragen linje); andra resor får en streckad linje mellan inläggen i tidsordning.
- **Spåren** läses i första hand som GPX (`husbilendoris.se/tracks/gpx/doris-ÅÅÅÅ-MM-DD.gpx`, med tid på varje punkt) och annars som KML (`tracks/doris-ÅÅÅÅ-MM-DD.kml`). En fil per svensk kalenderdag; gårdagens spår läggs ut på morgonen.
- **Position från spåret:** på husbilsresor får bilder utan GPS och inlägg med tid men utan position den plats där Doris var vid den tidpunkten (`pb_hooks/tracks.js`). Inläggets tid tolkas som svensk tid, bildens tid tas ur EXIF med tidszon. Positionen märks "från Doris spår", eftersom den visar var bilen stod, inte var vi var. Luckor i spåret på mer än 45 minuter används inte. Ett timjobb (`tracks`) försöker igen för den senaste veckan, eftersom spåret kommer dagen efter. Servern rör aldrig en position vi satt, ändrat eller tömt själva (`location_source = 'manual'`).
- **Inlägg:** liten karta över platsen, plus länk till OpenStreetMap.
- **/karta:** alla platser från alla resor man har tillgång till.

- **Filter** (på resans karta och /karta): välj typer av inlägg (övernattning, mat, sevärt, anteckningar), GPS-spår av/på, och period: allt, senaste 3 dagarna, veckan, månaden eller valfria datum. Bilder av/på. Perioden gäller inläggens och bildernas dag. Knapparna visar antal inom perioden. På /karta finns också en rad med resorna: slå av och på enskilda resor, *Alla* eller *Ingen* (välj sedan en resa för att se bara den). På resans karta väljer man i stället dag: *Alla dagar*, *Dag 1*, *Dag 2* … /karta kommer ihåg filtret på enheten.
- **Spår på /karta:** för husbilsresornas dagar inom perioden, högst de 60 senaste dagarna åt gången.

Kartbilderna hämtas från OpenFreeMap och sparas inte offline än.

### Offline

- **Läsa:** appen startar utan nät. Resor, inlägg och bilder man redan öppnat visas från cachen (nätet går först, cachen används när det inte svarar inom 6 s).
- **Bilder:** väntar i kön med sina filer och skickas efter inlägget (se avsnitt 7).
- **Skriva:** nya inlägg utan nät (eller när anropet inte kommer fram) läggs i en kö på enheten och visas streckade med "Väntar på nät". Kön skickas när nätet kommer tillbaka och var 30:e sekund. Inlägget får sitt id i appen, så ett nytt försök skapar aldrig dubbletter.
- **Inte offline än:** ändra eller ta bort befintliga inlägg, skapa resor, kartbilder.
- **Utloggning** tömmer kön och cachen på enheten, och varnar om något inte skickats.

### Väder

Varje inlägg med position får dagens väder: lägsta, högsta och snitttemperatur, väderkod och nederbörd. Servern hämtar det från Open-Meteo när inlägget sparas eller får ny dag eller plats, och sparar det på inlägget. Dagar som inte är över får en prognos, som byts mot riktiga värden av ett jobb varje timme (`cronAdd` i `pb_hooks/weather.pb.js`). Samma jobb fyller i väder som saknas, t.ex. för äldre inlägg eller när Open-Meteo inte svarade. Äldre dagar än ca 80 dagar hämtas från Open-Meteos arkiv. Inläggets koordinater skickas till Open-Meteo, men inget annat.

Vädret visas som en pastill på inlägget och i dagens rubrik (från första inlägget med väder).

### Kalender

`/kalender` visar en månad i taget, med början på måndag. Dagar under en resa är markerade och visar ikoner för dagens inlägg och väder. Tryck på en dag för att se inläggen och lägga till nya på resan den dagen. Vald dag och månad ligger i adressen.

Dagarna räknas fram ur resans datum (dag 1 = startdatum) och inläggens `day`; det finns ingen egen tabell för dagar än. Den kommer med publiceringen, där varje dag behöver egen status, sammanfattning och commit.

### Säkerhet

Appen nås i dag bara via Tailscale och används av två personer, så säkerheten är medvetet enkel. **Innan appen görs nåbar utan Tailscale (publik adress, Cloudflare Tunnel eller liknande) måste säkerheten ses över ordentligt**, bland annat:

- Filer är inte skyddade: den som har en fil-länk (omslag, bilder, original) kan se filen utan att vara inloggad. Gör fälten `protected` och använd fil-token i appen.
- Begränsa inloggningsförsök (rate limit) och överväg MFA/OTP i PocketBase.
- Admin-gränssnittet `/_/` ska inte vara nåbart utifrån.
- Säkra PocketBase-inställningar: Application URL, betrodda proxy-huvuden (för rätt IP i loggar och rate limit), CORS.
- Gå igenom API-reglerna för alla collections, t.ex. att deltagare bara ser det de ska.
- Kör en säkerhetsgranskning av koden och beroendena.

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
2. Sätt **Settings → Application URL** till den publika adressen.

Fillagring och backup mot S3 ställs in i `.env` (se `.env.example`), inte i admin-gränssnittet: `pocketbase/pb_hooks/storage.pb.js` skriver in dem vid varje start.

### S3 på Synology (Garage)

Tre buckets, var och en med en egen nyckel som bara har läs/skriv på sin bucket (ingen `owner`, ingen webbåtkomst):

| Bucket | Används av | Innehåll |
|---|---|---|
| `vararesor-media` | produktion | original och webp-versioner |
| `vararesor-backup` | produktion | PocketBase-backup av databasen (varje natt, 14 sparas) |
| `vararesor-test` | testmiljön | testbilder, kvot 20 GiB |

Den riktiga appen (`docker-compose.yml`, port 8090, `pb_data/`) läser `.env` och använder `vararesor-media` och `vararesor-backup`. Testmiljön körs bredvid med egen databas och testbucketen:

```bash
docker compose -f docker-compose.test.yml up -d --build   # port 8091, pb_data_test/, läser .env.test
```

Automatiska tester körs bara mot testmiljön, aldrig mot den riktiga appen.

Garage nås via Tailscale (`http://100.114.28.40:3900`, region `garage`, path-style). Bilderna visas alltid via PocketBase (`/api/files/…`), aldrig direkt från NAS:en.

PocketBase-backupen innehåller **inte** filerna i S3, och Garage har ingen versionshantering. Skydda därför Garages datamapp på Synology med Btrfs-snapshots och Hyper Backup till extern disk eller moln, och sätt `metadata_auto_snapshot_interval = "6h"` i `garage.toml`.

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
- [ ] Förslag på namn utifrån positionen (omvänd geokodning, t.ex. Nominatim eller Photon från OpenStreetMap): en lista med ställen i närheten att välja som namn på inlägget.
- [ ] Hur ska film hanteras (storlek, komprimering, publicering)?
- [ ] Vem ser vad? Är egna resor privata som standard?

## 11. Nästa steg

1. ~~Välja frontend-ramverk.~~ SvelteKit.
2. ~~Skelett med PocketBase + SvelteKit i Docker, inloggning och resa-lista.~~
3. ~~Skapa och redigera resor (inklusive omslagsbild och deltagare).~~
4. ~~Dagar och inlägg med mallar (övernattning, mat och dryck, sevärdhet, fri anteckning).~~
5. ~~Bilduppladdning med `.webp`-skalning och S3 mot Synology.~~
6. Dagssammanfattning och publicering till husbilendoris.se.
7. ~~Offline-kö. Karta.~~
