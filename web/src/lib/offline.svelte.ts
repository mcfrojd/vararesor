import Dexie, { type EntityTable } from 'dexie';
import { invalidateAll } from '$app/navigation';
import { ClientResponseError } from 'pocketbase';
import { pb, type Photo, type Post } from './pb';
import type { PreparedPhoto } from './photos';

/**
 * Kö för inlägg som skapats utan nät. Inläggen sparas i IndexedDB på enheten
 * och skickas när nätet är tillbaka. Varje inlägg får sitt PocketBase-id redan
 * i appen, så att ett nytt försök aldrig kan skapa en dubblett: finns id:t
 * redan på servern har ett tidigare försök gått fram.
 */

/** Fälten som skickas till PocketBase (samma som formuläret skickar). */
export type PostData = Omit<Post, 'collectionId' | 'collectionName' | 'created' | 'expand'>;

export interface QueuedPost {
	id: string;
	data: PostData;
	/** När inlägget lades i kön (ISO). */
	queuedAt: string;
	/** Senaste felet från servern, om den sa nej (inte nätfel). */
	error?: string;
}

/** Fälten för en bild, utom filerna. */
export type PhotoData = Pick<
	Photo,
	'id' | 'trip' | 'post' | 'author' | 'day' | 'taken' | 'taken_at' | 'width' | 'height' | 'location' | 'location_source'
>;

/**
 * En bild som väntar på att laddas upp. Den skickas i två steg: först de små
 * webp-filerna (bilden syns direkt), sedan originalet, som kan vara stort.
 */
export interface QueuedPhoto {
	id: string;
	data: PhotoData;
	web: Blob;
	thumb: Blob;
	original: Blob;
	originalName: string;
	/** 'new' = inget skickat än, 'original' = bara originalet kvar. */
	stage: 'new' | 'original';
	queuedAt: string;
	error?: string;
}

/** Det sidorna behöver veta om en köad bild (utan de stora filerna). */
export interface PendingPhoto {
	id: string;
	/** Tomt för bilder som bara hör till dagen. */
	post: string;
	trip: string;
	day: string;
	/** Samma som på `Photo`. */
	taken: string;
	location: PhotoData['location'];
	stage: QueuedPhoto['stage'];
	error?: string;
	/** Lokal adress till miniatyren (blob:). */
	thumbUrl: string;
}

/** En uppladdad bild som ska flyttas till ett inlägg (t.ex. från dagens bilder). */
export interface QueuedMove {
	/** Bildens id. */
	id: string;
	post: string;
	queuedAt: string;
	error?: string;
}

const db = new Dexie('vararesor') as Dexie & {
	queue: EntityTable<QueuedPost, 'id'>;
	photos: EntityTable<QueuedPhoto, 'id'>;
	moves: EntityTable<QueuedMove, 'id'>;
};
db.version(1).stores({ queue: 'id, queuedAt' });
db.version(2).stores({ queue: 'id, queuedAt', photos: 'id, queuedAt, post' });
db.version(3).stores({ queue: 'id, queuedAt', photos: 'id, queuedAt, post', moves: 'id, queuedAt' });

/** Reaktivt tillstånd som sidorna läser. */
export const offline = $state({
	online: typeof navigator === 'undefined' ? true : navigator.onLine,
	queue: [] as QueuedPost[],
	photos: [] as PendingPhoto[],
	/** Bilder som väntar på att flyttas: bildens id → inläggets id. */
	moves: {} as Record<string, string>,
	syncing: false
});

/** Det som väntar på att skickas, i text: "2 inlägg och 5 bilder". Tomt om inget väntar. */
export function waitingLabel(): string {
	const posts = offline.queue.length;
	const photos = offline.photos.length;
	return [posts ? `${posts} inlägg` : '', photos ? `${photos} ${photos === 1 ? 'bild' : 'bilder'}` : '']
		.filter(Boolean)
		.join(' och ');
}

// Miniatyrernas blob-adresser skapas en gång per bild och släpps när bilden lämnat kön.
const thumbUrls = new Map<string, string>();

async function refresh() {
	try {
		offline.queue = await db.queue.orderBy('queuedAt').toArray();
		const photos = await db.photos.orderBy('queuedAt').toArray();
		for (const [id, url] of thumbUrls) {
			if (!photos.some((p) => p.id === id)) {
				URL.revokeObjectURL(url);
				thumbUrls.delete(id);
			}
		}
		offline.photos = photos.map((p) => {
			if (!thumbUrls.has(p.id)) thumbUrls.set(p.id, URL.createObjectURL(p.thumb));
			return {
				id: p.id,
				post: p.data.post,
				day: p.data.day.slice(0, 10),
				trip: p.data.trip,
				taken: p.data.taken,
				location: p.data.location,
				stage: p.stage,
				error: p.error,
				thumbUrl: thumbUrls.get(p.id)!
			};
		});
		offline.moves = Object.fromEntries((await db.moves.toArray()).map((m) => [m.id, m.post]));
	} catch {
		offline.queue = []; // IndexedDB blockerad (t.ex. privat läge)
		offline.photos = [];
		offline.moves = {};
	}
}

/** Ett PocketBase-id: 15 tecken a-z0-9. */
export function newId(): string {
	const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
	const bytes = crypto.getRandomValues(new Uint8Array(15));
	return [...bytes].map((b) => chars[b % chars.length]).join('');
}

/** Nätfel (ingen kontakt, eller tidsgränsen löpte ut) till skillnad från att servern sa nej. */
export function isNetworkError(err: unknown): boolean {
	return err instanceof ClientResponseError && err.status === 0;
}

/** Tidsgräns för anrop på dålig täckning, så att knappen inte snurrar för evigt. */
export function timeout(ms = 20_000): AbortSignal {
	return AbortSignal.timeout(ms);
}

export async function enqueue(data: PostData) {
	await db.queue.put({ id: data.id, data, queuedAt: new Date().toISOString() });
	await refresh();
	void sync();
}

export async function removeQueued(id: string) {
	await db.queue.delete(id);
	// Bilderna hör till inlägget och kan inte skickas utan det. Uppladdade
	// bilder som skulle flyttas dit stannar där de är.
	await db.photos.filter((p) => p.data.post === id).delete();
	await db.moves.filter((m) => m.post === id).delete();
	await refresh();
}

/** Lägger bilder i kön. De skickas direkt om det finns nät. */
/** En bild att lägga i kön och vart den ska: ett inlägg, eller bara dagen (post = ''). */
export interface PhotoToQueue {
	photo: PreparedPhoto;
	post: string;
	day: string;
}

export async function enqueuePhotos(items: PhotoToQueue[], base: Pick<PhotoData, 'trip' | 'author'>) {
	const now = Date.now();
	await db.photos.bulkPut(
		items.map(({ photo: p, post, day }, i) => {
			const id = newId();
			return {
				id,
				data: {
					...base,
					id,
					post,
					day,
					taken: p.taken,
					taken_at: p.takenAt,
					width: p.width,
					height: p.height,
					// Bara bildens egen position. Saknas den försöker servern med Doris
					// spår, och annars visas bilden vid inläggets position.
					location: p.location ? { lat: p.location.lat, lon: p.location.lon } : { lat: 0, lon: 0 },
					location_source: p.location ? ('exif' as const) : ('' as const)
				},
				web: p.web,
				thumb: p.thumb,
				original: p.original,
				originalName: p.original.name || `${id}.jpg`,
				stage: 'new' as const,
				// Samma ordning i kön som man valde bilderna.
				queuedAt: new Date(now + i).toISOString()
			};
		})
	);
	await refresh();
	void sync();
}

/**
 * Lägger bilder i ett inlägg, t.ex. dagens bilder i ett nytt inlägg. Bilder som
 * ännu ligger i kön får bara nytt mål. Uppladdade bilder flyttas direkt om det
 * går, och annars när nätet är tillbaka (eller när inlägget skickats).
 */
export async function attachPhotos(ids: string[], post: string) {
	if (ids.length === 0) return;
	let queued = false;
	const postQueued = !!(await db.queue.get(post));
	for (const id of ids) {
		if (await db.photos.get(id)) {
			await db.photos.update(id, { 'data.post': post });
			continue;
		}
		if (navigator.onLine && !postQueued) {
			try {
				await pb.collection('photos').update(id, { post }, { signal: timeout(), requestKey: null });
				continue;
			} catch (err) {
				if (!isNetworkError(err)) throw err;
			}
		}
		await db.moves.put({ id, post, queuedAt: new Date().toISOString() });
		queued = true;
	}
	await refresh();
	if (queued) void sync();
}

export async function removeQueuedPhoto(id: string) {
	await db.photos.delete(id);
	await refresh();
}

/** Felmeddelandet från PocketBase i läsbar form. */
function serverMessage(e: ClientResponseError): string {
	const fields = Object.values(e.response?.data ?? {}) as { message?: string }[];
	return fields.map((f) => f.message).join(' ') || e.message || 'Servern sa nej.';
}

/** Skickar en köad bild ett steg i taget. Kastar vid nätfel. */
async function sendPhoto(item: QueuedPhoto) {
	if (item.stage === 'new') {
		const form = new FormData();
		// Vanliga fält som JSON bredvid filerna, så att positionen tolkas rätt.
		form.append('@jsonPayload', JSON.stringify(item.data));
		form.append('web', item.web, `${item.id}.webp`);
		form.append('thumb', item.thumb, `${item.id}-thumb.webp`);
		try {
			await pb.collection('photos').create(form, { signal: timeout(90_000), requestKey: null });
		} catch (err) {
			// Id:t finns redan: ett tidigare försök gick fram.
			if (!(err instanceof ClientResponseError && err.response?.data?.id)) throw err;
		}
		await db.photos.update(item.id, { stage: 'original' });
		item.stage = 'original';
		await refresh();
	}
	const form = new FormData();
	form.append('original', item.original, item.originalName);
	// Originalet kan vara stort; ge det gott om tid.
	await pb.collection('photos').update(item.id, form, { signal: timeout(10 * 60_000), requestKey: null });
	await db.photos.delete(item.id);
}

/** Skickar köade inlägg i tur och ordning. Avbryter vid nätfel och försöker senare. */
export async function sync() {
	if (offline.syncing || !navigator.onLine || !pb.authStore.isValid) return;
	offline.syncing = true;
	let sent = 0;
	try {
		for (const item of await db.queue.orderBy('queuedAt').toArray()) {
			if (item.error) continue; // servern har redan sagt nej; väntar på att tas bort
			try {
				await pb.collection('posts').create(item.data, { signal: timeout(), requestKey: null });
				await db.queue.delete(item.id);
				sent++;
			} catch (err) {
				if (isNetworkError(err)) break;
				const e = err as ClientResponseError;
				if (e.response?.data?.id) {
					// Id:t finns redan: ett tidigare försök gick fram.
					await db.queue.delete(item.id);
					sent++;
				} else if (e.status === 401 || e.status === 403) {
					break; // utloggad; försök igen efter inloggning
				} else {
					await db.queue.update(item.id, { error: serverMessage(e) });
				}
			}
		}
		// Flyttar och bilder efter inläggen, eftersom de pekar på dem.
		if (navigator.onLine)
			for (const move of await db.moves.orderBy('queuedAt').toArray()) {
				if (move.error || (await db.queue.get(move.post))) continue;
				try {
					await pb.collection('photos').update(move.id, { post: move.post }, { signal: timeout(), requestKey: null });
					await db.moves.delete(move.id);
					sent++;
				} catch (err) {
					if (isNetworkError(err)) break;
					const e = err as ClientResponseError;
					if (e.status === 401) break;
					// Bilden eller inlägget finns inte längre: inget att flytta.
					if (e.status === 404) await db.moves.delete(move.id);
					else await db.moves.update(move.id, { error: serverMessage(e) });
				}
			}
		if (navigator.onLine)
			for (const item of await db.photos.orderBy('queuedAt').toArray()) {
				if (item.error) continue;
				if (item.data.post && (await db.queue.get(item.data.post))) continue; // inlägget är inte skickat än
				try {
					await sendPhoto(item);
					sent++;
				} catch (err) {
					if (isNetworkError(err)) break;
					const e = err as ClientResponseError;
					if (e.status === 401) break;
					await db.photos.update(item.id, { error: serverMessage(e) });
				}
			}
	} finally {
		// Hämta om sidorna först, så att de skickade inläggen finns i datan innan
		// de försvinner ur kön. Annars blinkar de bort en stund.
		if (sent > 0) await invalidateAll().catch(() => {});
		offline.syncing = false;
		await refresh();
	}
}

let started = false;

/** Startas en gång från layouten: följer nätstatus och försöker skicka kön. */
export function startSync() {
	if (started) return;
	started = true;
	const update = () => {
		offline.online = navigator.onLine;
		if (offline.online) void sync();
	};
	window.addEventListener('online', update);
	window.addEventListener('offline', update);
	// "online" kommer inte alltid (t.ex. när täckningen bara är dålig), så försök
	// också med jämna mellanrum så länge något väntar.
	setInterval(() => {
		if (offline.queue.some((q) => !q.error) || offline.photos.some((p) => !p.error) || Object.keys(offline.moves).length)
			void sync();
	}, 30_000);
	void refresh().then(sync);
}

/** Vid utloggning: töm kön och cachade svar, så att nästa användare inte ser dem. */
export async function clearOfflineData() {
	await db.queue.clear().catch(() => {});
	await db.photos.clear().catch(() => {});
	await db.moves.clear().catch(() => {});
	offline.queue = [];
	offline.photos = [];
	offline.moves = {};
	if ('caches' in window) {
		for (const name of await caches.keys()) {
			if (name.startsWith('api-')) await caches.delete(name);
		}
	}
}
