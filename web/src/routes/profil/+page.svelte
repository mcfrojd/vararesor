<script lang="ts">
	import { auth, logout } from '$lib/auth.svelte';
	import Avatar from '$lib/Avatar.svelte';
	import Icon from '$lib/Icon.svelte';
	import { clearOfflineData, isNetworkError, offline, timeout, waitingLabel } from '$lib/offline.svelte';
	import { pb, type User } from '$lib/pb';
	import { prepareAvatar } from '$lib/photos';

	const waiting = $derived(waitingLabel());

	let avatarBusy = $state(false);
	let avatarError = $state('');

	/** Sparar ändringen på kontot och uppdaterar inloggningen, så att bilden syns överallt direkt. */
	async function saveAvatar(avatar: File | null) {
		if (!auth.user) return;
		avatarBusy = true;
		avatarError = '';
		try {
			const form = new FormData();
			if (avatar) form.append('avatar', avatar);
			else form.append('avatar', '');
			const user = await pb.collection('users').update<User>(auth.user.id, form, { signal: timeout() });
			pb.authStore.save(pb.authStore.token, user as never);
		} catch (err) {
			avatarError = isNetworkError(err)
				? 'Ingen kontakt med servern. Profilbilden kan bara bytas med nät.'
				: 'Kunde inte spara profilbilden.';
		} finally {
			avatarBusy = false;
		}
	}

	async function pickAvatar(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		try {
			avatarBusy = true;
			const blob = await prepareAvatar(file);
			await saveAvatar(new File([blob], 'avatar.webp', { type: 'image/webp' }));
		} catch (err) {
			avatarError = err instanceof Error ? err.message : 'Kunde inte läsa bilden.';
			avatarBusy = false;
		}
	}

	function removeAvatar() {
		if (confirm('Ta bort profilbilden?')) void saveAvatar(null);
	}

	async function signOut() {
		if (
			waiting &&
			!confirm(`${waiting} har inte skickats än och försvinner om du loggar ut. Logga ut ändå?`)
		)
			return;
		await clearOfflineData();
		logout();
	}
</script>

<svelte:head><title>Profil · Våra resor</title></svelte:head>

<h1 class="title mb-6 text-4xl">Profil</h1>

{#if auth.user}
	<section class="card p-5">
		<div class="flex items-center gap-4">
			<!-- Tryck på bilden för att byta. -->
			<label class="relative shrink-0 cursor-pointer rounded-full" aria-label="Byt profilbild">
				<Avatar user={auth.user} size="h-20 w-20 text-xl" />
				<span
					class="absolute -bottom-0.5 -right-0.5 flex h-8 w-8 items-center justify-center rounded-full border-2 border-card bg-accent text-paper shadow-md"
				>
					<Icon name="camera" class="h-4 w-4" />
				</span>
				{#if avatarBusy}
					<span class="absolute inset-0 flex items-center justify-center rounded-full bg-ink/50 text-xs font-semibold text-paper">
						Sparar…
					</span>
				{/if}
				<input type="file" accept="image/*" onchange={pickAvatar} disabled={avatarBusy} class="sr-only" />
			</label>
			<div class="min-w-0">
				<p class="title truncate text-2xl">{auth.user.name || 'Utan namn'}</p>
				<p class="truncate text-sm text-muted">{auth.user.email}</p>
				{#if auth.user.avatar && !avatarBusy}
					<button type="button" onclick={removeAvatar} class="mt-1 text-xs font-medium text-muted underline hover:text-ink">
						Ta bort profilbild
					</button>
				{/if}
			</div>
		</div>
		{#if avatarError}<p class="mt-3 text-sm text-red-600" role="alert">{avatarError}</p>{/if}
	</section>

	<section class="card mt-4 space-y-1 p-5">
		<p class="label">Synk</p>
		<p class="flex items-center gap-2 text-ink">
			<span
				class="h-2.5 w-2.5 rounded-full {offline.online ? 'bg-accent' : 'bg-rust'}"
				aria-hidden="true"
			></span>
			{offline.online ? 'Uppkopplad' : 'Ingen uppkoppling'}
		</p>
		<p class="text-sm text-muted">
			{waiting ? `${waiting} väntar på att skickas från den här enheten.` : 'Allt är skickat.'}
		</p>
	</section>

	<button type="button" onclick={signOut} class="btn-ghost mt-6 w-full text-rust">
		<Icon name="logout" class="h-5 w-5" />
		Logga ut
	</button>
{/if}
