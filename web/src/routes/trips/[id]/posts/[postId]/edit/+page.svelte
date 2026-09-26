<script lang="ts">
	import BackLink from '$lib/BackLink.svelte';
	import { goto } from '$app/navigation';
	import { auth } from '$lib/auth.svelte';
	import PostForm from '$lib/PostForm.svelte';

	let { data } = $props();

	const trip = $derived(data.trip);
	const post = $derived(data.post);
</script>

<svelte:head><title>Redigera inlägg · {trip.title}</title></svelte:head>

<BackLink href="/trips/{trip.id}/posts/{post.id}" label="Tillbaka" />
<h1 class="title mb-6 text-4xl">Redigera inlägg</h1>

{#if post.author !== auth.user?.id}
	<p class="text-muted">Bara den som skrivit inlägget kan ändra det.</p>
{:else}
	{#key post.id}
		<PostForm
			tripId={trip.id}
			{post}
			day={post.day}
			dayPhotos={data.dayPhotos}
			{trip}
			onsaved={(saved) => goto(`/trips/${trip.id}/posts/${saved.id}`, { replaceState: true })}
			oncancel={() => history.back()}
		/>
	{/key}
{/if}
