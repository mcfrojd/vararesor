<script lang="ts">
	import { goto } from '$app/navigation';
	import { auth } from '$lib/auth.svelte';
	import Avatar from '$lib/Avatar.svelte';
	import { dayNumber, formatDay } from '$lib/format';
	import { pb } from '$lib/pb';
	import { formatLocation, hasLocation, mapUrl, postKinds } from '$lib/posts';
	import Stars from '$lib/Stars.svelte';
	import { mapPoints } from '$lib/posts';
	import TripMap from '$lib/TripMap.svelte';

	let { data } = $props();

	const trip = $derived(data.trip);
	const post = $derived(data.post);
	const k = $derived(postKinds[post.kind]);
	const n = $derived(dayNumber(trip.start_date, post.day));
	const d = $derived(post.details ?? {});
	const isAuthor = $derived(post.author === auth.user?.id);
	const canDelete = $derived(isAuthor || trip.owner === auth.user?.id);

	// Mallfälten som har ett värde, i den ordning de visas.
	const facts = $derived(
		[
			['Vad vi åt och drack', d.what],
			[k.priceLabel ?? 'Pris', post.price],
			['Betalsätt', d.payment],
			['Öppettider', d.hours],
			['Underlag', d.surface],
			['Utsikt', d.view],
			['Ljudnivå', d.noise]
		].filter((f): f is [string, string] => !!f[1])
	);

	let error = $state('');

	async function remove() {
		if (!confirm('Ta bort inlägget? Det går inte att ångra.')) return;
		try {
			await pb.collection('posts').delete(post.id);
			goto(`/trips/${trip.id}`, { replaceState: true });
		} catch {
			error = 'Kunde inte ta bort inlägget.';
		}
	}
</script>

<svelte:head><title>{post.title || k.label} · {trip.title}</title></svelte:head>

<a href="/trips/{trip.id}#dag-{post.day.slice(0, 10)}" class="mb-4 inline-block text-sm text-muted hover:text-ink">
	← {trip.title}
</a>

<article class="space-y-4 rounded-2xl border border-line bg-card p-5">
	<div class="flex items-start justify-between gap-3">
		<div>
			<p class="text-xs font-medium uppercase tracking-wide text-accent">
				{k.icon}
				{[k.label, post.category].filter(Boolean).join(' · ')}
			</p>
			<h1 class="mt-1 text-2xl font-semibold tracking-tight">{post.title || k.label}</h1>
			<p class="text-sm text-muted">
				{n ? `Dag ${n} · ` : ''}{formatDay(post.day)}{post.time ? ` · ${post.time}` : ''}
			</p>
		</div>
		{#if isAuthor}
			<a
				href="/trips/{trip.id}/posts/{post.id}/edit"
				class="shrink-0 rounded-full border border-line px-3 py-1 text-sm hover:bg-accent-soft"
			>
				Redigera
			</a>
		{/if}
	</div>

	{#if post.rating}<p class="text-xl"><Stars value={post.rating} /></p>{/if}

	{#if facts.length > 0}
		<dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
			{#each facts as [label, value] (label)}
				<dt class="text-muted">{label}</dt>
				<dd>{value}</dd>
			{/each}
		</dl>
	{/if}

	{#if d.facilities?.length}
		<ul class="flex flex-wrap gap-2">
			{#each d.facilities as f (f)}
				<li class="rounded-full bg-accent-soft px-3 py-1 text-sm text-accent">{f}</li>
			{/each}
		</ul>
	{/if}

	{#if post.body}<p class="whitespace-pre-line">{post.body}</p>{/if}

	{#if hasLocation(post.location)}
		<TripMap points={mapPoints([post], trip.start_date)} class="h-52" />
		<a
			href={mapUrl(post.location)}
			target="_blank"
			rel="noopener"
			class="inline-block text-sm text-accent hover:underline"
		>
			📍 {formatLocation(post.location)} · Visa på karta
		</a>
	{/if}

	{#if post.expand?.author}
		<p class="flex items-center gap-2 border-t border-line pt-4 text-sm text-muted">
			<Avatar user={post.expand.author} size="h-6 w-6 text-[9px]" />
			{post.expand.author.name || post.expand.author.email}
		</p>
	{/if}
</article>

{#if canDelete}
	<button type="button" onclick={remove} class="mt-6 text-sm text-red-600 hover:underline">
		Ta bort inlägget
	</button>
	{#if error}<p class="mt-2 text-sm text-red-600">{error}</p>{/if}
{/if}
