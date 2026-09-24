<script lang="ts">
	import '../app.css';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { auth, logout } from '$lib/auth.svelte';
	import { registerSW } from 'virtual:pwa-register';

	let { children } = $props();

	const isLogin = $derived(page.url.pathname === '/login');

	// Service worker: cachar app-skalet så att appen startar även utan nät.
	$effect(() => {
		registerSW({ immediate: true });
	});

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
				<span class="text-muted">{auth.user.name || auth.user.email}</span>
				<button
					class="rounded-full border border-line px-3 py-1 hover:bg-accent-soft"
					onclick={logout}
				>
					Logga ut
				</button>
			</div>
		</div>
	</header>
	<main class="mx-auto max-w-3xl px-4 py-6">
		{@render children()}
	</main>
{:else if isLogin}
	{@render children()}
{/if}
