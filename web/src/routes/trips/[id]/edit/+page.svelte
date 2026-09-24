<script lang="ts">
	import { goto } from '$app/navigation';
	import { auth } from '$lib/auth.svelte';
	import { pb } from '$lib/pb';
	import TripForm from '$lib/TripForm.svelte';

	let { data } = $props();

	const trip = $derived(data.trip);
	let deleting = $state(false);
	let error = $state('');

	async function remove() {
		if (!confirm(`Ta bort "${trip.title}" och alla dess inlägg? Det går inte att ångra.`)) return;
		deleting = true;
		error = '';
		try {
			await pb.collection('trips').delete(trip.id);
			goto('/', { replaceState: true });
		} catch {
			error = 'Kunde inte ta bort resan.';
			deleting = false;
		}
	}
</script>

<svelte:head><title>Redigera {trip.title} · Våra resor</title></svelte:head>

<h1 class="mb-5 text-2xl font-semibold tracking-tight">Redigera resa</h1>

{#if trip.owner !== auth.user?.id}
	<p class="text-muted">Bara den som skapat resan kan ändra den.</p>
{:else}
	{#key trip.id}
		<TripForm
			{trip}
			onsaved={(saved) => goto(`/trips/${saved.id}`, { replaceState: true, invalidateAll: true })}
			oncancel={() => history.back()}
		/>
	{/key}

	<div class="mt-10 border-t border-line pt-5">
		<button
			type="button"
			onclick={remove}
			disabled={deleting}
			class="text-sm text-red-600 hover:underline disabled:opacity-60"
		>
			{deleting ? 'Tar bort…' : 'Ta bort resan'}
		</button>
		{#if error}<p class="mt-2 text-sm text-red-600">{error}</p>{/if}
	</div>
{/if}
