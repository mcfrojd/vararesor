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
export type PhotoData = Pick<Photo, 'id' | 'trip' | 'post' | 'author' | 'day' | 'taken' | 'width' | 'height'> & {
	location: Photo['location'];
};

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
	post: string;
	trip: string;
	stage: QueuedPhoto['stage'];
	error?: string;
	/** Lokal adress till miniatyren (blob:). */
	thumbUrl: string;
}

const db = new Dexie('vararesor') as Dexie & {
	queue: EntityTable<QueuedPost, 'id'>;
	photos: EntityTable<QueuedPhoto, 'id'>;
};
db.version(1).stores({ queue: 'id, queuedAt' });
db.version(2).stores({ queue: 'id, queuedAt', photos: 'id, queuedAt, post' });

/** Reaktivt tillstånd som sidorna läser. */
export const offline = $state({
	online: typeof navigator === 'undefined' ? true : navigator.onLine,
	queue: [] as QueuedPost[],
	photos: [] as PendingPhoto[],
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
				trip: p.data.trip,
				stage: p.stage,
				error: p.error,
				thumbUrl: thumbUrls.get(p.id)!
			};
		});
	} catch {
		offline.queue = []; // IndexedDB blockerad (t.ex. privat läge)
		offline.photos = [];
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
	// Bilderna hör till inlägget och kan inte skickas utan det.
	await db.photos.where('post').equals(id).delete();
	await refresh();
}

/** Lägger bilder i kön. De skickas direkt om det finns nät. */
export async function enqueuePhotos(
	photos: PreparedPhoto[],
	base: Pick<PhotoData, 'trip' | 'post' | 'author' | 'day'>,
	fallback: Photo['location'] | null
) {
	const now = Date.now();
	await db.photos.bulkPut(
		photos.map((p, i) => {
			const id = newId();
			const at = p.location ?? fallback;
			return {
				id,
				data: {
					...base,
					id,
					taken: p.taken,
					width: p.width,
					height: p.height,
					location: at ? { lat: at.lat, lon: at.lon } : { lat: 0, lon: 0 }
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
		// Bilderna efter inläggen, eftersom de pekar på dem.
		if (navigator.onLine)
			for (const item of await db.photos.orderBy('queuedAt').toArray()) {
				if (item.error) continue;
				if (await db.queue.get(item.data.post)) continue; // inlägget är inte skickat än
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
		if (offline.queue.some((q) => !q.error) || offline.photos.some((p) => !p.error)) void sync();
	}, 30_000);
	void refresh().then(sync);
}

/** Vid utloggning: töm kön och cachade svar, så att nästa användare inte ser dem. */
export async function clearOfflineData() {
	await db.queue.clear().catch(() => {});
	await db.photos.clear().catch(() => {});
	offline.queue = [];
	offline.photos = [];
	if ('caches' in window) {
		for (const name of await caches.keys()) {
			if (name.startsWith('api-')) await caches.delete(name);
		}
	}
}
