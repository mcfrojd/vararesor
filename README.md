# Våra resor

En enkel och stilren resedagbok för familjen, byggd som en **PWA** (Progressive Web App).

> Status: idéstadiet. Dokumentet beskriver vad appen ska bli och fylls på efter hand.

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

## 8. Teknik (förslag)

| Del | Val |
|-----|-----|
| Databas, inloggning, API | [PocketBase](https://pocketbase.io/) |
| Fillagring | S3 (Synology) via PocketBase |
| Backup | PocketBase inbyggda S3-backup |
| Frontend | PWA (ramverk ej bestämt) |
| Drift | Docker / docker compose |
| Publicering | GitHub API → `hugo-mcfrojd/husbil` → Cloudflare Pages |

## 9. Drift och hosting

Målet är att det ska vara enkelt att köra appen var som helst:

```bash
git clone https://github.com/mcfrojd/vararesor.git
cd vararesor
docker compose up -d
```

- Körs i en enkel Ubuntu-baserad Docker-miljö.
- Hostas på någon av hemmaservrarna **eller** på Oracle-servern i molnet.
- Bakom en reverse proxy med HTTPS.

## 10. Öppna frågor

- [x] Vad körs husbilendoris.se på? **Hugo i `hugo-mcfrojd/husbil`, publiceras via Cloudflare Pages.**
- [x] Innehållsstruktur? **Page bundles `content/resor/<resa>/dagNN/` med `index.md`, `cover.webp` och `images/` (se avsnitt 6).**
- [ ] Bilderna ligger i repot idag (`content/resor` är ca 150 MB). Ska det fortsätta så, eller ska bilderna på sikt ligga i en publik lagring (t.ex. Cloudflare R2)?
- [ ] Ska Traccar-spåren även visas i appen (karta per dag)?
- [ ] Behövs offline-stöd när vi står utan täckning, med synk när nätet kommer tillbaka?
- [ ] Karta och GPS: automatisk position på inlägg? Spåra rutten under dagen?
- [ ] Vilket frontend-ramverk?
- [ ] Hur ska film hanteras (storlek, komprimering, publicering)?
- [ ] Vem ser vad? Är egna resor privata som standard?

## 11. Nästa steg

1. Förfina den här beskrivningen.
2. Välja frontend-ramverk.
3. Sätta upp PocketBase-schema (resor, dagar, inlägg, mallar, media, användare).
4. Skapa `docker compose`-skelett som går att klona och starta.
