<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { defaultDay } from '$lib/format';
	import type { PostKind } from '$lib/pb';
	import PostForm from '$lib/PostForm.svelte';
	import { postKinds } from '$lib/posts';

	let { data } = $props();

	const trip = $derived(data.trip);
	const kindParam = page.url.searchParams.get('kind');
	const kind = kindParam && kindParam in postKinds ? (kindParam as PostKind) : undefined;
	// svelte-ignore state_referenced_locally
	const day = page.url.searchParams.get('day') || defaultDay(trip.start_date, trip.end_date);
</script>

<svelte:head><title>Nytt inlägg · {trip.title}</title></svelte:head>

<a href="/trips/{trip.id}" class="mb-4 inline-block text-sm text-muted hover:text-ink">
	← {trip.title}
</a>
<h1 class="mb-5 text-2xl font-semibold tracking-tight">Nytt inlägg</h1>

<PostForm
	tripId={trip.id}
	{kind}
	{day}
	onsaved={(post) => goto(`/trips/${trip.id}#dag-${post.day.slice(0, 10)}`, { replaceState: true })}
	oncancel={() => history.back()}
/>
