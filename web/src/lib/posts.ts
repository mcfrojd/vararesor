import { dayNumber, formatDay, localTime } from './format';
import type { GeoPoint, Photo, Post, PostKind, Trip } from './pb';
import { photoUrl } from './photos';
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

/**
 * Boende (övernattning på resor som inte är husbilsresor): hotell och liknande.
 * Ett boende kan gälla flera nätter, från inläggets dag till `details.until`.
 */
export const stayConfig: KindConfig = {
	label: 'Boende',
	icon: '🏨',
	titleLabel: 'Namn på boendet',
	categories: ['Hotell', 'Motell', 'Vandrarhem', 'Lägenhet', 'Stuga', 'Hos vänner/släkt', 'Annat'],
	priceLabel: 'Pris',
	rated: true,
	located: true,
	bodyLabel: 'Anteckning'
};

/** Övernattningen är ett boende (hotell m.m.), inte en ställplats. */
export function isStay(p: Pick<Post, 'kind' | 'category' | 'details'>): boolean {
	return p.kind === 'overnight' && (!!p.details?.until || stayConfig.categories.includes(p.category));
}

/** Mallen för inlägget: boende har egen ikon och egna namn. */
export function kindOf(p: Pick<Post, 'kind' | 'category' | 'details'>): KindConfig {
	return isStay(p) ? stayConfig : postKinds[p.kind];
}

/** Antal nätter på ett boende, eller 0. */
export function nights(p: Pick<Post, 'day' | 'details'>): number {
	const until = p.details?.until;
	return until ? Math.max(0, dayNumber(p.day, until) - 1) : 0;
}

export const nightsLabel = (n: number) => (n === 1 ? '1 natt' : `${n} nätter`);

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

/** Bildens position: från kameran, annars inläggets. */
export function photoLocation(photo: Photo, post?: Post): GeoPoint | null {
	if (hasLocation(photo.location)) return photo.location;
	return hasLocation(post?.location) ? post.location : null;
}

/**
 * Bilder som punkter för kartan. Bilder från samma inlägg och ungefär samma
 * plats blir en punkt (med antal), så att kartan inte fylls av staplade bilder.
 */
export function photoPoints<T extends Photo>(
	photos: T[],
	postOf: (p: T) => Post | undefined,
	tripOf: (p: T) => Pick<Trip, 'start_date' | 'title'> | undefined
): MapPoint[] {
	const groups = new Map<string, MapPoint>();
	for (const photo of photos) {
		const post = postOf(photo);
		const at = photoLocation(photo, post);
		if (!at) continue;
		const key = `${photo.post} ${at.lat.toFixed(4)} ${at.lon.toFixed(4)}`;
		const existing = groups.get(key);
		if (existing) {
			existing.count = (existing.count ?? 1) + 1;
			continue;
		}
		const trip = tripOf(photo);
		const n = trip ? dayNumber(trip.start_date, photo.day) : 0;
		groups.set(key, {
			id: `photo-${photo.id}`,
			lat: at.lat,
			lon: at.lon,
			kind: 'photo',
			title: post ? post.title || postKinds[post.kind].label : 'Dagens bilder',
			subtitle: [trip?.title, n ? `Dag ${n}` : '', formatDay(photo.day)].filter(Boolean).join(' · '),
			// Bilder utan inlägg visas under dagen på resans sida.
			href: photo.post ? `/trips/${photo.trip}/posts/${photo.post}` : `/trips/${photo.trip}#dag-${photo.day.slice(0, 10)}`,
			thumb: photoUrl(photo, 'thumb'),
			count: 1
		});
	}
	return [...groups.values()];
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
			icon: kindOf(p).icon,
			title: p.title || kindOf(p).label,
			subtitle: [tripTitle, n ? `Dag ${n}` : '', formatDay(p.day)].filter(Boolean).join(' · '),
			href: `/trips/${p.trip}/posts/${p.id}`
		};
	});
}
