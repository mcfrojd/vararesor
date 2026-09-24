/**
 * Doris GPS-spår. En GitHub Action hämtar varje morgon gårdagens spår från
 * Traccar till husbilendoris.se/tracks/doris-ÅÅÅÅ-MM-DD.kml. Filerna är
 * publika och har CORS öppet, så appen läser dem direkt.
 */
const TRACKS_URL = 'https://husbilendoris.se/tracks';

export type Line = [number, number][];

/** Läser alla <coordinates> ("lon,lat[,höjd]" separerade med blanksteg) i en KML. */
function parseKml(text: string): Line[] {
	const doc = new DOMParser().parseFromString(text, 'application/xml');
	return [...doc.getElementsByTagName('coordinates')]
		.map((el) =>
			(el.textContent ?? '')
				.trim()
				.split(/\s+/)
				.map((c) => c.split(',').map(Number))
				.filter(([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat))
				.map(([lon, lat]) => [lon, lat] as [number, number])
		)
		.filter((line) => line.length > 1);
}

// Spåren ändras inte i efterhand, så de hämtas bara en gång per dag och sidvisning.
const cache = new Map<string, Promise<Line[]>>();

function loadDay(day: string): Promise<Line[]> {
	let p = cache.get(day);
	if (!p) {
		p = fetch(`${TRACKS_URL}/doris-${day}.kml`)
			.then(async (res) => {
				// Saknas filen svarar sajten med sin 404-sida i HTML.
				if (!res.ok || !res.headers.get('content-type')?.includes('kml')) return [];
				return parseKml(await res.text());
			})
			.catch(() => {
				cache.delete(day); // försök igen nästa gång, t.ex. när nätet är tillbaka
				return [];
			});
		cache.set(day, p);
	}
	return p;
}

/** Hämtar spåren för dagarna (ÅÅÅÅ-MM-DD), per dag. Dagar utan spår får en tom lista. */
export async function loadDorisTracks(days: string[]): Promise<Record<string, Line[]>> {
	const lines = await Promise.all(days.map(loadDay));
	return Object.fromEntries(days.map((d, i) => [d, lines[i]]));
}
