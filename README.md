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

## 7. Bilder och film

- Original lagras på vår privata **S3-lagring** (Synology hemma).
- Appen skapar automatiskt **webbanpassade versioner** (storlek och kvalitet) för visning och publicering på hemsidan.
- Originalen sparas alltid orörda.

## 8. Teknik (förslag)

| Del | Val |
|-----|-----|
| Databas, inloggning, API | [PocketBase](https://pocketbase.io/) |
| Fillagring | S3 (Synology) via PocketBase |
| Backup | PocketBase inbyggda S3-backup |
| Frontend | PWA (ramverk ej bestämt) |
| Drift | Docker / docker compose |

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

- [ ] Vad körs husbilendoris.se på (WordPress eller annat)? Det avgör hur publiceringen byggs.
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
