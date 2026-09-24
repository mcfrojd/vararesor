<script lang="ts">
	import { goto } from '$app/navigation';
	import { auth } from '$lib/auth.svelte';
	import PostForm from '$lib/PostForm.svelte';

	let { data } = $props();

	const trip = $derived(data.trip);
	const post = $derived(data.post);
</script>

<svelte:head><title>Redigera inlägg · {trip.title}</title></svelte:head>

<a href="/trips/{trip.id}/posts/{post.id}" class="mb-4 inline-block text-sm text-muted hover:text-ink">
	← Tillbaka
</a>
<h1 class="mb-5 text-2xl font-semibold tracking-tight">Redigera inlägg</h1>

{#if post.author !== auth.user?.id}
	<p class="text-muted">Bara den som skrivit inlägget kan ändra det.</p>
{:else}
	{#key post.id}
		<PostForm
			tripId={trip.id}
			{post}
			day={post.day}
			onsaved={(saved) => goto(`/trips/${trip.id}/posts/${saved.id}`, { replaceState: true })}
			oncancel={() => history.back()}
		/>
	{/key}
{/if}
