<script lang="ts">
	import '../app.css';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { auth, logout } from '$lib/auth.svelte';
	import { clearOfflineData, offline, startSync } from '$lib/offline.svelte';
	import { registerSW } from 'virtual:pwa-register';

	let { children } = $props();

	const isLogin = $derived(page.url.pathname === '/login');

	// Service worker: cachar app-skalet så att appen startar även utan nät.
	$effect(() => {
		registerSW({ immediate: true });
	});

	// Offline-kön: följ nätstatus och skicka väntande inlägg.
	$effect(() => {
		if (auth.user) startSync();
	});

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

	$effect(() => {
		if (!auth.user && !isLogin) goto('/login', { replaceState: true });
		if (auth.user && isLogin) goto('/', { replaceState: true });
	});
</script>

{#if auth.user && !isLogin}
	<header class="sticky top-0 z-10 border-b border-line bg-paper/90 backdrop-blur">
		<div class="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
			<a href="/" class="text-lg font-semibold tracking-tight">Våra resor</a>
			<div class="flex items-center gap-3 text-sm">
				<a href="/karta" class="text-muted hover:text-ink">🗺️ Karta</a>
				<span class="text-muted">{auth.user.name || auth.user.email}</span>
				<button
					class="rounded-full border border-line px-3 py-1 hover:bg-accent-soft"
					onclick={signOut}
				>
					Logga ut
				</button>
			</div>
		</div>
		{#if !offline.online || waiting > 0}
			<div
				role="status"
				class="border-t border-line px-4 py-1.5 text-center text-sm {offline.online
					? 'bg-accent-soft text-accent'
					: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200'}"
			>
				{#if !offline.online}
					Ingen uppkoppling.
					{waiting > 0
						? `${waiting} inlägg väntar och skickas när nätet är tillbaka.`
						: 'Nya inlägg sparas på telefonen tills nätet är tillbaka.'}
				{:else if offline.syncing}
					Skickar {waiting} inlägg…
				{:else}
					{waiting} inlägg väntar på att skickas.
				{/if}
			</div>
		{/if}
	</header>
	<main class="mx-auto max-w-3xl px-4 py-6">
		{@render children()}
	</main>
{:else if isLogin}
	{@render children()}
{/if}
