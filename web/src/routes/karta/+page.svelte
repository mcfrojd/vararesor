<script lang="ts">
	import { postKinds } from '$lib/posts';
	import { mapPoints } from '$lib/posts';
	import TripMap from '$lib/TripMap.svelte';

	let { data } = $props();

	const points = $derived(
		data.posts.flatMap((p) =>
			mapPoints([p], p.expand?.trip?.start_date ?? '', p.expand?.trip?.title ?? '')
		)
	);
</script>

<svelte:head><title>Karta · Våra resor</title></svelte:head>

<h1 class="mb-4 text-2xl font-semibold tracking-tight">Där vi varit</h1>

{#if points.length === 0}
	<div class="rounded-2xl border border-dashed border-line p-10 text-center">
		<p class="text-4xl">🗺️</p>
		<p class="mt-2 font-medium">Inga platser än</p>
		<p class="text-sm text-muted">Inlägg med position hamnar här.</p>
	</div>
{:else}
	<TripMap {points} class="h-[70dvh]" />
	<p class="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
		{#each Object.values(postKinds) as k (k.label)}
			<span>{k.icon} {k.label}</span>
		{/each}
	</p>
{/if}
