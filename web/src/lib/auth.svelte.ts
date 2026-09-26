import { ClientResponseError } from 'pocketbase';
import { pb, type User } from './pb';

/** Reaktivt tillstånd för inloggad användare, synkat med PocketBase authStore. */
export const auth = $state({
	user: pb.authStore.isValid ? (pb.authStore.record as unknown as User) : null
});

pb.authStore.onChange(() => {
	auth.user = pb.authStore.isValid ? (pb.authStore.record as unknown as User) : null;
});

export async function login(email: string, password: string) {
	await pb.collection('users').authWithPassword(email, password);
}

let lastRefresh = 0;

/**
 * Hämtar det egna kontot på nytt och förlänger inloggningen. Annars visar
 * appen kontot som det var vid inloggningen på just den enheten (t.ex. utan
 * en profilbild som lagts till från datorn), och inloggningen går ut efter
 * en vecka. Utan nät görs inget; ogiltig inloggning loggas ut.
 */
export async function refreshAuth(force = false) {
	if (!pb.authStore.isValid || !navigator.onLine) return;
	if (!force && Date.now() - lastRefresh < 5 * 60_000) return;
	lastRefresh = Date.now();
	try {
		await pb.collection('users').authRefresh({ requestKey: null });
	} catch (err) {
		if (err instanceof ClientResponseError && [401, 403, 404].includes(err.status)) pb.authStore.clear();
	}
}

export function logout() {
	pb.authStore.clear();
}
