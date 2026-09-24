<script lang="ts">
	import BackLink from '$lib/BackLink.svelte';
	import { goto } from '$app/navigation';
	import TripForm from '$lib/TripForm.svelte';
</script>

<svelte:head><title>Ny resa · Våra resor</title></svelte:head>

<BackLink href="/" label="Alla resor" />
<h1 class="title mb-6 text-4xl">Ny resa</h1>

<TripForm
	onsaved={(trip) => goto(`/trips/${trip.id}`, { replaceState: true })}
	oncancel={() => history.back()}
/>
