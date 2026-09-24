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

<div class="flex min-h-dvh items-center justify-center px-4 py-10">
	<div class="w-full max-w-sm">
		<div class="mb-8 text-center">
			<img src="/favicon.svg" alt="" class="mx-auto mb-5 h-16 w-16 rounded-2xl shadow-soft" />
			<h1 class="title text-5xl">Våra resor</h1>
			<p class="mt-2 text-body">Familjens resedagbok.</p>
		</div>

		<form onsubmit={submit} class="card space-y-5 p-6">
			<label class="block space-y-1.5">
				<span class="label">E-post</span>
				<input type="email" autocomplete="username" required bind:value={email} class="field" />
			</label>

			<label class="block space-y-1.5">
				<span class="label">Lösenord</span>
				<input
					type="password"
					autocomplete="current-password"
					required
					bind:value={password}
					class="field"
				/>
			</label>

			{#if error}
				<p class="text-sm text-red-600" role="alert">{error}</p>
			{/if}

			<button type="submit" disabled={busy} class="btn-primary w-full">
				{busy ? 'Loggar in…' : 'Logga in'}
			</button>
		</form>
	</div>
</div>
