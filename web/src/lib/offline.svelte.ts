import Dexie, { type EntityTable } from 'dexie';
import { invalidateAll } from '$app/navigation';
import { ClientResponseError } from 'pocketbase';
import { pb, type Post } from './pb';

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

const db = new Dexie('vararesor') as Dexie & { queue: EntityTable<QueuedPost, 'id'> };
db.version(1).stores({ queue: 'id, queuedAt' });

/** Reaktivt tillstånd som sidorna läser. */
export const offline = $state({
	online: typeof navigator === 'undefined' ? true : navigator.onLine,
	queue: [] as QueuedPost[],
	syncing: false
});

async function refresh() {
	try {
		offline.queue = await db.queue.orderBy('queuedAt').toArray();
	} catch {
		offline.queue = []; // IndexedDB blockerad (t.ex. privat läge)
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
	await refresh();
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
					const fields = Object.values(e.response?.data ?? {}) as { message?: string }[];
					const error = fields.map((f) => f.message).join(' ') || e.message || 'Servern sa nej.';
					await db.queue.update(item.id, { error });
				}
			}
		}
	} finally {
		offline.syncing = false;
		await refresh();
	}
	if (sent > 0) await invalidateAll();
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
		if (offline.queue.some((q) => !q.error)) void sync();
	}, 30_000);
	void refresh().then(sync);
}

/** Vid utloggning: töm kön och cachade svar, så att nästa användare inte ser dem. */
export async function clearOfflineData() {
	await db.queue.clear().catch(() => {});
	offline.queue = [];
	if ('caches' in window) {
		for (const name of await caches.keys()) {
			if (name.startsWith('api-')) await caches.delete(name);
		}
	}
}
