import type { Post } from './pb';

/** Väder som servern sparar på inlägget (från Open-Meteo, se pb_hooks/weather.js). */
export interface Weather {
	min: number | null;
	max: number | null;
	mean: number | null;
	/** WMO-väderkod. */
	code: number | null;
	/** Nederbörd i mm. */
	precip: number | null;
	day: string;
	lat: number;
	lon: number;
	/** false = prognos; byts mot riktiga värden när dagen är över. */
	final: boolean;
}

// WMO-koder: https://open-meteo.com/en/docs (avsnittet "Weather variable documentation").
const codes: [number[], string, string][] = [
	[[0], '☀️', 'Klart'],
	[[1], '🌤️', 'Mestadels klart'],
	[[2], '⛅', 'Växlande molnighet'],
	[[3], '☁️', 'Mulet'],
	[[45, 48], '🌫️', 'Dimma'],
	[[51, 53, 55, 56, 57], '🌦️', 'Duggregn'],
	[[61, 63, 80, 81], '🌧️', 'Regn'],
	[[65, 82], '🌧️', 'Kraftigt regn'],
	[[66, 67], '🌧️', 'Underkylt regn'],
	[[71, 73, 75, 77, 85, 86], '🌨️', 'Snö'],
	[[95, 96, 99], '⛈️', 'Åska']
];

export function weatherInfo(code: number | null): { icon: string; label: string } {
	const hit = codes.find(([list]) => code !== null && list.includes(code));
	return hit ? { icon: hit[1], label: hit[2] } : { icon: '🌡️', label: '' };
}

const deg = (n: number) => `${Math.round(n)}°`;

/** "12–18°" */
export function tempRange(w: Weather): string {
	if (w.min === null || w.max === null) return w.mean !== null ? deg(w.mean) : '';
	return `${Math.round(w.min)}–${deg(w.max)}`;
}

/** Dagens väder: från första inlägget den dagen som har väder. */
export function dayWeather(posts: Pick<Post, 'weather'>[]): Weather | null {
	return posts.find((p) => p.weather)?.weather ?? null;
}
