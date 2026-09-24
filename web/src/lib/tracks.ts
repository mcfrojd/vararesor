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

/** Hämtar spåren för dagarna (ÅÅÅÅ-MM-DD). Dagar utan spår hoppas över. */
export async function loadDorisTracks(days: string[]): Promise<Line[]> {
	const results = await Promise.all(
		days.map(async (day) => {
			try {
				const res = await fetch(`${TRACKS_URL}/doris-${day}.kml`);
				// Saknas filen svarar sajten med sin 404-sida i HTML.
				if (!res.ok || !res.headers.get('content-type')?.includes('kml')) return [];
				return parseKml(await res.text());
			} catch {
				return [];
			}
		})
	);
	return results.flat();
}
