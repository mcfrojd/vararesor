import { dayNumber, formatDay, localTime } from './format';
import type { GeoPoint, Post, PostKind } from './pb';
import type { MapPoint } from './TripMap.svelte';

export interface KindConfig {
	label: string;
	icon: string;
	/** Rubrik för namnfältet, t.ex. "Namn på ställplatsen". */
	titleLabel: string;
	categories: string[];
	priceLabel?: string;
	rated: boolean;
	located: boolean;
	bodyLabel: string;
}

export const postKinds: Record<PostKind, KindConfig> = {
	overnight: {
		label: 'Övernattning',
		icon: '🏕️',
		titleLabel: 'Namn',
		categories: ['Ställplats', 'Camping', 'Fricamping'],
		priceLabel: 'Pris per natt',
		rated: true,
		located: true,
		bodyLabel: 'Anteckning'
	},
	food: {
		label: 'Mat och dryck',
		icon: '🍽️',
		titleLabel: 'Namn på stället',
		categories: ['Restaurang', 'Café', 'Bar', 'Bryggeri', 'Vingård', 'Glass', 'Annat'],
		priceLabel: 'Ungefärligt pris',
		rated: true,
		located: true,
		bodyLabel: 'Anteckning'
	},
	sight: {
		label: 'Sevärdhet och nöje',
		icon: '🏛️',
		titleLabel: 'Namn',
		categories: ['Natur', 'Museum', 'Stad', 'Aktivitet', 'Annat'],
		priceLabel: 'Entré/pris',
		rated: true,
		located: true,
		bodyLabel: 'Anteckning'
	},
	note: {
		label: 'Anteckning',
		icon: '📝',
		titleLabel: 'Rubrik',
		categories: [],
		rated: false,
		located: true,
		bodyLabel: 'Text'
	}
};

export const facilities = ['El', 'Vatten', 'Gråvattentömning', 'Toatömning', 'Toalett', 'Dusch', 'WiFi'];
export const noiseLevels = ['Lugnt', 'Visst ljud', 'Högljutt'];

/**
 * Inläggen i tidsordning: dag, sedan tid. Inlägg utan tid sorteras efter när
 * de skapades, vilket oftast är ungefär när det hände.
 */
export function sortPosts<T extends Post>(posts: T[]): T[] {
	const key = (p: T) => `${p.day.slice(0, 10)} ${p.time || localTime(p.created)}`;
	return [...posts].sort((a, b) => key(a).localeCompare(key(b)));
}

/** PocketBase lagrar en tom position som 0,0. */
export function hasLocation(p: GeoPoint | null | undefined): p is GeoPoint {
	return !!p && (p.lat !== 0 || p.lon !== 0);
}

export function formatLocation(p: GeoPoint): string {
	return `${p.lat.toFixed(5)}, ${p.lon.toFixed(5)}`;
}

/** Läser "52.52, 13.405" (t.ex. kopierat från en kartapp). */
export function parseLocation(text: string): GeoPoint | null {
	const m = text.trim().match(/^(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)$/);
	if (!m) return null;
	const lat = Number(m[1]);
	const lon = Number(m[2]);
	if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
	return { lat, lon };
}

export function mapUrl(p: GeoPoint): string {
	return `https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lon}#map=16/${p.lat}/${p.lon}`;
}

/** Inläggen som har position, som punkter för kartan (i ordning). */
export function mapPoints(posts: Post[], tripStart = '', tripTitle = ''): MapPoint[] {
	return posts.filter((p) => hasLocation(p.location)).map((p) => {
		const n = dayNumber(tripStart, p.day);
		return {
			id: p.id,
			lat: p.location.lat,
			lon: p.location.lon,
			kind: p.kind,
			title: p.title || postKinds[p.kind].label,
			subtitle: [tripTitle, n ? `Dag ${n}` : '', formatDay(p.day)].filter(Boolean).join(' · '),
			href: `/trips/${p.trip}/posts/${p.id}`
		};
	});
}
