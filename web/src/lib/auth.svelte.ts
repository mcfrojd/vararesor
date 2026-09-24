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

export function logout() {
	pb.authStore.clear();
}
