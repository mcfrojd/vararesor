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
	import WeatherPill from '$lib/WeatherPill.svelte';
	import BackLink from '$lib/BackLink.svelte';
	import Icon from '$lib/Icon.svelte';
	import PhotoGallery from '$lib/PhotoGallery.svelte';

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
		const n = post.expand?.photos_via_post?.length ?? 0;
		if (!confirm(`Ta bort inlägget${n ? ` och dess ${n} bilder` : ''}? Det går inte att ångra.`)) return;
		try {
			await pb.collection('posts').delete(post.id);
			goto(`/trips/${trip.id}`, { replaceState: true });
		} catch {
			error = 'Kunde inte ta bort inlägget.';
		}
	}
</script>

<svelte:head><title>{post.title || k.label} · {trip.title}</title></svelte:head>

<BackLink href="/trips/{trip.id}#dag-{post.day.slice(0, 10)}" label={trip.title} />

<article class="card space-y-5 p-5 sm:p-6">
	<div>
		<div class="flex min-h-8 items-center justify-between gap-3">
			<p class="text-sm font-semibold text-muted">
				{n ? `Dag ${n} · ` : ''}{formatDay(post.day)}{post.time ? ` kl. ${post.time}` : ''}
			</p>
			{#if isAuthor}
				<a href="/trips/{trip.id}/posts/{post.id}/edit" class="btn-small shrink-0">
					<Icon name="pencil" class="h-3.5 w-3.5" />Redigera
				</a>
			{/if}
		</div>
		<div>
			<h1 class="title mt-1 text-4xl leading-tight">{post.title || k.label}</h1>
			<p class="mt-1 font-semibold text-rust">
				{k.icon}
				{[k.label, post.category].filter(Boolean).join(' · ')}
			</p>
			{#if hasLocation(post.location)}
				<a
					href={mapUrl(post.location)}
					target="_blank"
					rel="noopener"
					class="mt-0.5 inline-flex items-center gap-1 text-xs text-rust/70 hover:underline"
				>
					<Icon name="pin" class="h-3 w-3" />{formatLocation(post.location)}
					{#if post.location_source === 'track'}<span class="text-muted">· från Doris spår</span>{/if}
				</a>
			{/if}
		</div>
	</div>

	<PhotoGallery photos={post.expand?.photos_via_post ?? []} pending={(p) => p.post === post.id} />

	{#if post.body}<p class="whitespace-pre-line text-[17px] leading-relaxed">{post.body}</p>{/if}

	{#if post.weather}<p><WeatherPill weather={post.weather} detailed /></p>{/if}

	{#if facts.length > 0}
		<dl class="divide-y divide-line rounded-2xl bg-field px-4">
			{#each facts as [label, value] (label)}
				<div class="flex items-baseline justify-between gap-4 py-2.5 text-sm">
					<dt class="text-muted">{label}</dt>
					<dd class="text-right font-medium text-ink">{value}</dd>
				</div>
			{/each}
		</dl>
	{/if}

	{#if d.facilities?.length}
		<ul class="flex flex-wrap gap-2">
			{#each d.facilities as f (f)}
				<li class="rounded-full bg-rust-soft px-3 py-1 text-xs font-semibold text-rust">{f}</li>
			{/each}
		</ul>
	{/if}

	{#if post.rating}<p class="text-2xl"><Stars value={post.rating} /></p>{/if}

	{#if hasLocation(post.location)}
		<TripMap points={mapPoints([post], trip.start_date)} class="h-56" />
	{/if}

	{#if post.expand?.author}
		<p class="flex items-center gap-2 border-t border-line pt-4 text-sm text-muted">
			<Avatar user={post.expand.author} size="h-7 w-7 text-[10px]" />
			{post.expand.author.name || post.expand.author.email}
		</p>
	{/if}
</article>

{#if canDelete}
	<button
		type="button"
		onclick={remove}
		class="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-red-600 hover:underline"
	>
		<Icon name="trash" class="h-4 w-4" />Ta bort inlägget
	</button>
	{#if error}<p class="mt-2 text-sm text-red-600">{error}</p>{/if}
{/if}
