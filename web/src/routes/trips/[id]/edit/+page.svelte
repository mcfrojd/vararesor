<script lang="ts">
	import BackLink from '$lib/BackLink.svelte';
	import Icon from '$lib/Icon.svelte';
	import { goto } from '$app/navigation';
	import { auth } from '$lib/auth.svelte';
	import { pb } from '$lib/pb';
	import TripForm from '$lib/TripForm.svelte';

	let { data } = $props();

	const trip = $derived(data.trip);
	let deleting = $state(false);
	let error = $state('');

	async function remove() {
		if (!confirm(`Ta bort "${trip.title}" och alla dess inlägg? Det går inte att ångra. Bilderna blir kvar under Bilder → Okategoriserat.`)) return;
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

<BackLink href="/trips/{trip.id}" label={trip.title} />
<h1 class="title mb-6 text-4xl">Redigera resa</h1>

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
			class="inline-flex items-center gap-1.5 text-sm font-medium text-red-600 hover:underline disabled:opacity-60"
		>
			<Icon name="trash" class="h-4 w-4" />{deleting ? 'Tar bort…' : 'Ta bort resan'}
		</button>
		{#if error}<p class="mt-2 text-sm text-red-600">{error}</p>{/if}
	</div>
{/if}
