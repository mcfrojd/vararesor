<script lang="ts">
	import { auth } from '$lib/auth.svelte';
	import Avatar from '$lib/Avatar.svelte';
	import { formatDateRange, tripTypes } from '$lib/format';
	import { pb } from '$lib/pb';

	let { data } = $props();

	const trip = $derived(data.trip);
	const isOwner = $derived(trip.owner === auth.user?.id);
	const people = $derived([
		...(trip.expand?.owner ? [trip.expand.owner] : []),
		...(trip.expand?.participants ?? [])
	]);
</script>

<svelte:head><title>{trip.title} · Våra resor</title></svelte:head>

<a href="/" class="mb-4 inline-block text-sm text-muted hover:text-ink">← Alla resor</a>

<article class="overflow-hidden rounded-2xl border border-line bg-card">
	{#if trip.cover}
		<img src={pb.files.getURL(trip, trip.cover)} alt="" class="aspect-video w-full object-cover" />
	{/if}
	<div class="space-y-4 p-5">
		<div class="flex items-start justify-between gap-3">
			<div>
				<p class="text-xs font-medium uppercase tracking-wide text-accent">
					{tripTypes[trip.type].icon}
					{tripTypes[trip.type].label}
				</p>
				<h1 class="mt-1 text-2xl font-semibold tracking-tight">{trip.title}</h1>
				<p class="text-sm text-muted">{formatDateRange(trip.start_date, trip.end_date)}</p>
			</div>
			{#if isOwner}
				<a
					href="/trips/{trip.id}/edit"
					class="shrink-0 rounded-full border border-line px-3 py-1 text-sm hover:bg-accent-soft"
				>
					Redigera
				</a>
			{/if}
		</div>

		{#if trip.description}
			<p class="whitespace-pre-line">{trip.description}</p>
		{/if}

		{#if people.length > 0}
			<ul class="flex flex-wrap gap-2">
				{#each people as person (person.id)}
					<li class="flex items-center gap-2 rounded-full bg-paper py-1 pl-1 pr-3 text-sm">
						<Avatar user={person} size="h-7 w-7 text-[10px]" />
						{person.name || person.email}
						{#if person.id === trip.owner}<span class="text-muted">· ägare</span>{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</article>

<div class="mt-6 rounded-2xl border border-dashed border-line p-8 text-center text-sm text-muted">
	Dagar och inlägg kommer här.
</div>
