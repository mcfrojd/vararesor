<script lang="ts">
	import { auth, logout } from '$lib/auth.svelte';
	import Avatar from '$lib/Avatar.svelte';
	import Icon from '$lib/Icon.svelte';
	import { clearOfflineData, offline } from '$lib/offline.svelte';

	const waiting = $derived(offline.queue.length);

	async function signOut() {
		if (
			waiting > 0 &&
			!confirm(`${waiting} inlägg har inte skickats än och försvinner om du loggar ut. Logga ut ändå?`)
		)
			return;
		await clearOfflineData();
		logout();
	}
</script>

<svelte:head><title>Profil · Våra resor</title></svelte:head>

<h1 class="title mb-6 text-4xl">Profil</h1>

{#if auth.user}
	<section class="card flex items-center gap-4 p-5">
		<Avatar user={auth.user} size="h-16 w-16 text-lg" />
		<div class="min-w-0">
			<p class="title truncate text-2xl">{auth.user.name || 'Utan namn'}</p>
			<p class="truncate text-sm text-muted">{auth.user.email}</p>
		</div>
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
			{waiting === 0
				? 'Allt är skickat.'
				: `${waiting} inlägg väntar på att skickas från den här enheten.`}
		</p>
	</section>

	<button type="button" onclick={signOut} class="btn-ghost mt-6 w-full text-rust">
		<Icon name="logout" class="h-5 w-5" />
		Logga ut
	</button>
{/if}
