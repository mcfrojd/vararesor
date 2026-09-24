<script lang="ts">
	import { goto } from '$app/navigation';
	import TripForm from '$lib/TripForm.svelte';
</script>

<svelte:head><title>Ny resa · Våra resor</title></svelte:head>

<h1 class="mb-5 text-2xl font-semibold tracking-tight">Ny resa</h1>

<TripForm
	onsaved={(trip) => goto(`/trips/${trip.id}`, { replaceState: true })}
	oncancel={() => history.back()}
/>
