<script lang="ts">
	import { goto } from '$app/navigation';
	import { login } from '$lib/auth.svelte';

	let email = $state('');
	let password = $state('');
	let error = $state('');
	let busy = $state(false);

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		error = '';
		busy = true;
		try {
			await login(email, password);
			goto('/', { replaceState: true });
		} catch {
			error = 'Fel e-post eller lösenord.';
		} finally {
			busy = false;
		}
	}
</script>

<div class="flex min-h-dvh items-center justify-center px-4">
	<form onsubmit={submit} class="w-full max-w-sm space-y-5">
		<div class="text-center">
			<img src="/favicon.svg" alt="" class="mx-auto mb-3 h-14 w-14" />
			<h1 class="text-2xl font-semibold tracking-tight">Våra resor</h1>
			<p class="text-sm text-muted">Logga in för att fortsätta</p>
		</div>

		<label class="block space-y-1">
			<span class="text-sm font-medium">E-post</span>
			<input
				type="email"
				autocomplete="username"
				required
				bind:value={email}
				class="w-full rounded-xl border border-line bg-card px-3 py-2.5 outline-none focus:border-accent"
			/>
		</label>

		<label class="block space-y-1">
			<span class="text-sm font-medium">Lösenord</span>
			<input
				type="password"
				autocomplete="current-password"
				required
				bind:value={password}
				class="w-full rounded-xl border border-line bg-card px-3 py-2.5 outline-none focus:border-accent"
			/>
		</label>

		{#if error}
			<p class="text-sm text-red-600" role="alert">{error}</p>
		{/if}

		<button
			type="submit"
			disabled={busy}
			class="w-full rounded-xl bg-accent py-2.5 font-medium text-paper disabled:opacity-60"
		>
			{busy ? 'Loggar in…' : 'Logga in'}
		</button>
	</form>
</div>
