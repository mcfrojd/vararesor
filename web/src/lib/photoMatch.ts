import { localTime } from './format';
import type { GeoPoint, Photo, Post } from './pb';
import type { PreparedPhoto } from './photos';
import { hasLocation } from './posts';

/**
 * Förslag på var en bild hör hemma när många bilder laddas upp på en gång:
 * dagen tas ur kamerans klockslag, och bilden läggs i ett inlägg samma dag om
 * platsen eller tiden stämmer. Annars hamnar den under dagen ("dagens bilder").
 */

/** Så nära ett inlägg en bild med GPS ska vara för att höra dit. */
export const NEAR_METERS = 300;
/** Längre bort än så hör bilden inte till inlägget, även om tiden stämmer. */
const FAR_METERS = 2000;
/** Så nära i tid (minuter) en bild ska vara ett inlägg utan position. */
export const NEAR_MINUTES = 60;

export interface Destination {
	day: string;
	/** Inläggets id, eller tomt för dagens bilder. */
	post: string;
	/** Varför: 'place' = nära inläggets plats, 'time' = nära i tid. */
	reason: '' | 'place' | 'time';
}

/** Avstånd i meter (haversine). */
export function distance(a: GeoPoint, b: GeoPoint): number {
	const rad = Math.PI / 180;
	const dLat = (b.lat - a.lat) * rad;
	const dLon = (b.lon - a.lon) * rad;
	const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
	return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

function minutes(hhmm: string): number | null {
	const m = hhmm.match(/^(\d{2}):(\d{2})/);
	return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** Inläggets klockslag: angiven tid, annars när det skrevs. */
function postMinutes(post: Post): number | null {
	return minutes(post.time || localTime(post.created));
}

export function suggest(
	photo: Pick<PreparedPhoto, 'taken' | 'location'>,
	posts: Post[],
	fallbackDay: string
): Destination {
	const day = photo.taken ? photo.taken.slice(0, 10) : fallbackDay;
	const sameDay = posts.filter((p) => p.day.slice(0, 10) === day);
	const at = photo.location;

	// 1. Plats: närmaste inlägg inom NEAR_METERS.
	if (at) {
		let best: { post: Post; d: number } | null = null;
		for (const post of sameDay) {
			if (!hasLocation(post.location)) continue;
			const d = distance(at, post.location);
			if (d <= NEAR_METERS && (!best || d < best.d)) best = { post, d };
		}
		if (best) return { day, post: best.post.id, reason: 'place' };
	}

	// 2. Tid: närmaste inlägg inom NEAR_MINUTES, men inte om platserna är långt isär.
	const t = minutes(photo.taken.slice(11));
	if (t !== null) {
		let best: { post: Post; dt: number } | null = null;
		for (const post of sameDay) {
			const pt = postMinutes(post);
			if (pt === null) continue;
			if (at && hasLocation(post.location) && distance(at, post.location) > FAR_METERS) continue;
			const dt = Math.abs(pt - t);
			if (dt <= NEAR_MINUTES && (!best || dt < best.dt)) best = { post, dt };
		}
		if (best) return { day, post: best.post.id, reason: 'time' };
	}

	return { day, post: '', reason: '' };
}

/** Samma bild finns redan på resan: samma exakta tidpunkt och storlek. */
export function isDuplicate(photo: PreparedPhoto, existing: Pick<Photo, 'taken_at' | 'width' | 'height'>[]): boolean {
	if (!photo.takenAt) return false;
	const t = Date.parse(photo.takenAt);
	return existing.some(
		(e) =>
			e.taken_at &&
			Math.abs(Date.parse(e.taken_at.replace(' ', 'T')) - t) < 1000 &&
			e.width === photo.width &&
			e.height === photo.height
	);
}
