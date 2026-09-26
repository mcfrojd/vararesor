<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { auth } from '$lib/auth.svelte';
	import BackLink from '$lib/BackLink.svelte';
	import { dayNumber, formatDateRange, formatDay } from '$lib/format';
	import Icon from '$lib/Icon.svelte';
	import { offline } from '$lib/offline.svelte';
	import { pb, type Photo } from '$lib/pb';
	import PhotoGallery from '$lib/PhotoGallery.svelte';
	import { photoUrl } from '$lib/photos';

	let { data } = $props();

	const trip = $derived(data.trip);
	const tripId = $derived(trip?.id ?? '');
	const isOwner = $derived(!!trip && trip.owner === auth.user?.id);

	// Grupperat per dag, med bilderna i kön. Bilder utan dag sist.
	const days = $derived.by(() => {
		const set = new Set(data.photos.map((p) => p.day.slice(0, 10)));
		for (const p of offline.photos) if (p.trip === tripId) set.add(p.day);
		return [...set].sort((a, b) => (a || '9999').localeCompare(b || '9999'));
	});
	const count = $derived(
		data.photos.length + offline.photos.filter((p) => p.trip === tripId && !data.photos.some((x) => x.id === p.id)).length
	);

	let message = $state('');
	let busy = $state(false);

	/** Den som laddat upp bilden, och resans ägare, får ta bort den. */
	const canDelete = (p: Photo) => p.author === auth.user?.id || trip?.owner === auth.user?.id;
	const deletable = $derived(data.photos.filter(canDelete));
	let selecting = $state(false);
	let selected = $state<string[]>([]);

	function stopSelecting() {
		selecting = false;
		selected = [];
	}

	async function remove(ids: string[]) {
		const n = ids.length;
		if (n === 0) return false;
		if (!confirm(`Ta bort ${n === 1 ? 'bilden' : `${n} bilder`}? Det går inte att ångra.`)) return false;
		busy = true;
		message = '';
		let done = 0;
		try {
			for (const id of ids) {
				await pb.collection('photos').delete(id);
				done++;
			}
			message = done === 1 ? 'Bilden är borttagen.' : `${done} bilder är borttagna.`;
		} catch {
			message = `Kunde inte ta bort ${done ? `alla (${done} av ${n} borttagna)` : 'bilden'}. Finns det nät?`;
		} finally {
			busy = false;
			await invalidateAll();
		}
		return true;
	}

	async function removeSelected() {
		if (await remove(selected)) stopSelecting();
	}

	async function useAsCover(photo: Photo) {
		if (!trip) return;
		busy = true;
		message = '';
		try {
			const blob = await (await fetch(photoUrl(photo, 'web'))).blob();
			const form = new FormData();
			form.append('cover', new File([blob], `${photo.id}.webp`, { type: 'image/webp' }));
			await pb.collection('trips').update(trip.id, form);
			message = 'Omslagsbilden är bytt.';
			await invalidateAll();
		} catch {
			message = 'Kunde inte byta omslagsbild. Finns det nät?';
		} finally {
			busy = false;
		}
	}

	async function moveToTrip(photo: Photo, id: string) {
		const target = data.trips.find((t) => t.id === id);
		if (!target) return;
		busy = true;
		message = '';
		try {
			await pb.collection('photos').update(photo.id, {
				trip: target.id,
				post: '',
				// Utan känd dag hamnar bilden på resans första dag.
				day: photo.day || target.start_date || ''
			});
			message = `Bilden ligger nu i ${target.title}.`;
			await invalidateAll();
		} catch {
			message = 'Kunde inte flytta bilden. Finns det nät?';
		} finally {
			busy = false;
		}
	}

	const round =
		'flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20 disabled:opacity-50';
	const pill =
		'inline-flex h-11 items-center gap-1.5 rounded-full bg-white/10 px-4 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20 disabled:opacity-50';
</script>

<svelte:head><title>{trip?.title ?? 'Okategoriserat'} · Bilder</title></svelte:head>

<BackLink href="/bilder" label="Bilder" />
<div class="mb-6 flex flex-wrap items-end justify-between gap-3">
	<div class="min-w-0">
		<h1 class="title text-4xl">{trip?.title ?? 'Okategoriserat'}</h1>
		<p class="text-sm text-muted">
			{trip ? formatDateRange(trip.start_date, trip.end_date) : 'Bilder som inte passar någon resa än. Bara du ser dem.'}
			{count ? ` · ${count} ${count === 1 ? 'bild' : 'bilder'}` : ''}
		</p>
	</div>
	<div class="flex flex-wrap gap-2">
		{#if trip}
			<a href="/trips/{trip.id}" class="btn-small"><Icon name="journal" class="h-4 w-4" />Resan</a>
		{/if}
		<a href={trip ? `/trips/${trip.id}/photos` : '/bilder/ladda-upp'} class="btn-small">
			<Icon name="plus" class="h-4 w-4" />Ladda upp
		</a>
		{#if deletable.length > 0}
			<button type="button" onclick={() => (selecting ? stopSelecting() : (selecting = true))} class="btn-small">
				{#if selecting}<Icon name="x" class="h-4 w-4" />Klar{:else}<Icon name="trash" class="h-4 w-4" />Ta bort{/if}
			</button>
		{/if}
	</div>
</div>

{#if selecting}
	<p class="mb-4 text-sm text-muted">Tryck på bilderna du vill ta bort.</p>
{:else if trip && isOwner}
	<p class="mb-4 text-sm text-muted">Öppna en bild och välj <strong>Omslag</strong> för att göra den till resans omslagsbild.</p>
{:else if !trip && data.photos.length > 0}
	<p class="mb-4 text-sm text-muted">
		Skapas en resa med rätt datum flyttas bilderna dit av sig själva. Du kan också öppna en bild och lägga den i en resa.
	</p>
{/if}

{#if message}
	<p class="mb-4 rounded-2xl bg-rust-soft px-4 py-2.5 text-sm font-semibold text-rust" role="status">{message}</p>
{/if}

{#if count === 0}
	<div class="card px-6 py-12 text-center">
		<p class="title text-2xl">Inga bilder här</p>
	</div>
{/if}

{#each days as day (day)}
	{@const n = trip && day ? dayNumber(trip.start_date, day) : 0}
	<section class="mb-6">
		<h2 class="mb-2 flex items-baseline gap-2">
			<span class="title text-xl">{n ? `Dag ${n}` : day ? formatDay(day) : 'Okänt datum'}</span>
			{#if n}<span class="text-sm text-muted">{formatDay(day)}</span>{/if}
		</h2>
		<PhotoGallery
			photos={data.photos.filter((p) => p.day.slice(0, 10) === day)}
			pending={(p) => p.trip === tripId && p.day === day}
			compact
			{selecting}
			selectable={canDelete}
			bind:selected
		>
			{#snippet actions(photo)}
				{#if canDelete(photo)}
					<button type="button" class={round} disabled={busy} onclick={() => remove([photo.id])} aria-label="Ta bort bilden">
						<Icon name="trash" class="h-5 w-5" />
					</button>
				{/if}
				{#if trip && isOwner}
					<button type="button" class={pill} disabled={busy} onclick={() => useAsCover(photo)}>
						<Icon name="image" class="h-4 w-4" />Omslag
					</button>
				{:else if !trip && data.trips.length > 0}
					<select
						aria-label="Lägg i resa"
						disabled={busy}
						onchange={(e) => moveToTrip(photo, e.currentTarget.value)}
						class="h-11 max-w-44 rounded-full border-0 bg-white/10 px-4 text-sm font-semibold text-white backdrop-blur"
					>
						<option value="" class="text-ink">Lägg i resa…</option>
						{#each data.trips as t (t.id)}
							<option value={t.id} class="text-ink">{t.title}</option>
						{/each}
					</select>
				{/if}
			{/snippet}
		</PhotoGallery>
	</section>
{/each}

{#if selecting}
	<!-- Fast ovanför flikraden, med egen bakgrund så att bilderna inte syns igenom. -->
	<div class="sticky bottom-24 z-20 -mx-4 mt-6 flex gap-3 bg-paper/95 px-4 py-3 backdrop-blur">
		<button type="button" onclick={removeSelected} disabled={busy || selected.length === 0} class="btn-primary flex-1">
			{selected.length ? `Ta bort ${selected.length} ${selected.length === 1 ? 'bild' : 'bilder'}` : 'Välj bilder'}
		</button>
		<button type="button" onclick={stopSelecting} class="btn-ghost">Avbryt</button>
	</div>
{/if}
