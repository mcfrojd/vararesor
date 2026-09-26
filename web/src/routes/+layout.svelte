<script lang="ts">
	import '../app.css';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { auth, refreshAuth } from '$lib/auth.svelte';
	import Avatar from '$lib/Avatar.svelte';
	import Icon, { type IconName } from '$lib/Icon.svelte';
	import { offline, startSync, waitingLabel } from '$lib/offline.svelte';
	import { registerSW } from 'virtual:pwa-register';

	let { children } = $props();

	const path = $derived(page.url.pathname);
	const isLogin = $derived(path === '/login');

	// Service worker: cachar appen så att den startar även utan nät.
	$effect(() => {
		registerSW({ immediate: true });
	});

	// Offline-kön: följ nätstatus och skicka väntande inlägg.
	$effect(() => {
		if (auth.user) startSync();
	});

	// Det egna kontot hämtas på nytt vid start, när appen kommer tillbaka i
	// förgrunden och när nätet kommer tillbaka (ändringar från en annan enhet).
	$effect(() => {
		void refreshAuth(true);
		const onVisible = () => document.visibilityState === 'visible' && refreshAuth();
		const onOnline = () => refreshAuth(true);
		document.addEventListener('visibilitychange', onVisible);
		window.addEventListener('online', onOnline);
		return () => {
			document.removeEventListener('visibilitychange', onVisible);
			window.removeEventListener('online', onOnline);
		};
	});

	const waiting = $derived(waitingLabel());

	$effect(() => {
		if (!auth.user && !isLogin) goto('/login', { replaceState: true });
		if (auth.user && isLogin) goto('/', { replaceState: true });
	});

	// Flikraden längst ner, som i Jorial.
	const tabs: { href: string; label: string; icon: IconName; match: (p: string) => boolean }[] = [
		{ href: '/', label: 'Resor', icon: 'journal', match: (p) => p === '/' || p.startsWith('/trips') },
		{ href: '/bilder', label: 'Bilder', icon: 'image', match: (p) => p.startsWith('/bilder') },
		{ href: '/kalender', label: 'Kalender', icon: 'calendar', match: (p) => p.startsWith('/kalender') },
		{ href: '/karta', label: 'Karta', icon: 'map', match: (p) => p.startsWith('/karta') },
		{ href: '/profil', label: 'Profil', icon: 'user', match: (p) => p.startsWith('/profil') }
	];
</script>

{#if auth.user && !isLogin}
	<header
		class="sticky top-0 z-30 px-3 pb-2"
		style="padding-top: max(0.75rem, env(safe-area-inset-top))"
	>
		<div
			class="mx-auto flex max-w-3xl items-center justify-between rounded-full border border-line bg-card/85 py-1.5 pl-2 pr-1.5 shadow-soft backdrop-blur-md"
		>
			<a href="/" class="flex items-center gap-2">
				<img src="/favicon.svg" alt="" class="h-8 w-8 rounded-xl" />
				<span class="font-serif text-xl font-medium tracking-tight text-ink">Våra resor</span>
			</a>
			<a href="/profil" aria-label="Profil" class="rounded-full">
				<Avatar user={auth.user} size="h-8 w-8 text-[10px]" />
			</a>
		</div>
		{#if !offline.online || waiting}
			<div
				role="status"
				class="mx-auto mt-2 flex max-w-3xl items-center justify-center gap-2 rounded-full px-4 py-1.5 text-center text-sm font-medium {offline.online
					? 'bg-accent-soft text-accent'
					: 'bg-rust-soft text-rust'}"
			>
				{#if !offline.online}
					<Icon name="cloudOff" class="h-4 w-4 shrink-0" />
					<span>
						Ingen uppkoppling.
						{waiting
							? `${waiting} väntar och skickas när nätet är tillbaka.`
							: 'Nya inlägg sparas på telefonen tills nätet är tillbaka.'}
					</span>
				{:else if offline.syncing}
					Skickar {waiting}…
				{:else}
					{waiting} väntar på att skickas.
				{/if}
			</div>
		{/if}
	</header>

	<main class="mx-auto max-w-3xl px-4 pb-36 pt-3">
		{@render children()}
	</main>

	<nav
		aria-label="Huvudmeny"
		class="fixed inset-x-0 bottom-0 z-30 px-3"
		style="padding-bottom: max(0.75rem, env(safe-area-inset-bottom))"
	>
		<div
			class="mx-auto grid max-w-lg grid-cols-5 gap-0.5 rounded-3xl border border-line bg-card/90 p-1.5 shadow-card backdrop-blur-md"
		>
			{#each tabs as tab (tab.href)}
				{@const active = tab.match(path)}
				<a
					href={tab.href}
					aria-current={active ? 'page' : undefined}
					class="flex flex-col items-center gap-0.5 rounded-2xl py-2 text-[10px] font-bold uppercase tracking-wider transition {active
						? 'bg-rust-soft text-rust'
						: 'text-muted hover:text-ink'}"
				>
					<Icon name={tab.icon} class="h-5 w-5" />
					{tab.label}
				</a>
			{/each}
		</div>
	</nav>
{:else if isLogin}
	{@render children()}
{/if}
