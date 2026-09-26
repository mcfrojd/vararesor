<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { auth } from '$lib/auth.svelte';
	import BackLink from '$lib/BackLink.svelte';
	import { dayNumber, formatDateRange, formatDay } from '$lib/format';
	import Icon from '$lib/Icon.svelte';
	import { enqueuePhotos } from '$lib/offline.svelte';
	import { isDuplicate, suggest, tripForDay } from '$lib/photoMatch';
	import { preparePhoto, type PreparedPhoto } from '$lib/photos';
	import { postKinds } from '$lib/posts';

	let { data } = $props();

	/**
	 * Bilder till alla resor på en gång: varje bild hamnar i resan vars datum
	 * omfattar dagen den togs, och där i ett inlägg om plats eller tid stämmer.
	 * Passar ingen resa blir den okategoriserad (och flyttas senare om en resa
	 * med rätt datum skapas).
	 */
	interface Item {
		key: number;
		url?: string;
		prepared?: PreparedPhoto;
		error?: string;
		/** Tomt = okategoriserad. */
		trip: string;
		day: string;
		post: string;
		reason: '' | 'place' | 'time';
		duplicate?: boolean;
		include: boolean;
	}

	// raw: bilderna ska sparas i IndexedDB, och Svelte-proxys går inte att spara där.
	let items = $state.raw<Item[]>([]);
	let nextKey = 0;
	let preparing = $state(0);
	let saving = $state(false);
	let saveError = $state('');

	const tripById = (id: string) => data.trips.find((t) => t.id === id);
	const postsOf = (trip: string) => data.posts.filter((p) => p.trip === trip);

	function update(key: number, patch: Partial<Item>) {
		items = items.map((it) => (it.key === key ? { ...it, ...patch } : it));
	}

	/** Resa, dag och inlägg för en bild. */
	function place(prepared: PreparedPhoto, trip: string): Pick<Item, 'trip' | 'day' | 'post' | 'reason'> {
		const day = prepared.taken.slice(0, 10);
		const t = tripById(trip);
		if (!t) return { trip: '', day, post: '', reason: '' };
		const fallback = day || t.start_date.slice(0, 10);
		return { trip, ...suggest(prepared, postsOf(trip), fallback) };
	}

	async function pick(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const files = [...(input.files ?? [])];
		input.value = '';
		await addFiles(files);
	}

	/** Bilder som delats till appen (Dela → Våra resor) ligger i service workerns cache. */
	async function takeShared() {
		if (!page.url.searchParams.has('delade') || !('caches' in window)) return;
		const cache = await caches.open('delade-bilder');
		const files: File[] = [];
		for (const req of await cache.keys()) {
			const res = await cache.match(req);
			if (res) {
				const name = decodeURIComponent(res.headers.get('x-filnamn') ?? 'bild.jpg');
				files.push(new File([await res.blob()], name, { type: res.headers.get('content-type') ?? 'image/jpeg' }));
			}
			await cache.delete(req);
		}
		// Ta bort ?delade, så att en omladdning inte försöker igen.
		history.replaceState(history.state, '', '/bilder/ladda-upp');
		await addFiles(files);
	}
	$effect(() => {
		void takeShared();
	});

	async function addFiles(files: File[]) {
		const fresh: Item[] = files.map(() => ({ key: nextKey++, trip: '', day: '', post: '', reason: '', include: true }));
		items = [...items, ...fresh];
		preparing += files.length;
		// En i taget: stora bilder tar mycket minne i mobilen.
		for (const [i, file] of files.entries()) {
			const key = fresh[i].key;
			try {
				const prepared = await preparePhoto(file);
				if (!items.some((it) => it.key === key)) continue; // borttagen medan den förbereddes
				const duplicate = isDuplicate(prepared, data.photos);
				update(key, {
					prepared,
					url: URL.createObjectURL(prepared.thumb),
					...place(prepared, tripForDay(prepared.taken.slice(0, 10), data.trips)),
					duplicate,
					include: !duplicate
				});
			} catch (err) {
				update(key, { error: err instanceof Error ? err.message : 'Kunde inte läsa bilden.', include: false });
			} finally {
				preparing--;
			}
		}
	}

	function remove(key: number) {
		const it = items.find((x) => x.key === key);
		if (it?.url) URL.revokeObjectURL(it.url);
		items = items.filter((x) => x.key !== key);
	}

	$effect(() => () => items.forEach((it) => it.url && URL.revokeObjectURL(it.url)));

	const ready = $derived(items.filter((it) => it.prepared && it.include));
	const failed = $derived(items.filter((it) => it.error));

	// Grupperat per resa (resornas ordning), okategoriserade sist.
	const groups = $derived.by(() => {
		const order = [...data.trips.map((t) => t.id), ''];
		return order
			.map((trip) => ({
				trip,
				list: items
					.filter((it) => it.prepared && it.trip === trip)
					.sort((a, b) => (a.prepared?.taken || a.day).localeCompare(b.prepared?.taken || b.day))
			}))
			.filter((g) => g.list.length > 0);
	});

	async function upload() {
		if (ready.length === 0) return;
		saving = true;
		saveError = '';
		try {
			await enqueuePhotos(
				ready.map((it) => ({ photo: it.prepared!, trip: it.trip, post: it.trip ? it.post : '', day: it.day })),
				{ trip: '', author: auth.user?.id ?? '' }
			);
		} catch (err) {
			saving = false;
			saveError = `Kunde inte lägga bilderna i kön: ${err instanceof Error ? err.message : String(err)}`;
			return;
		}
		const trips = new Set(ready.map((it) => it.trip));
		goto(trips.size === 1 ? `/bilder/${[...trips][0] || 'okategoriserat'}` : '/bilder', { replaceState: true });
	}

	const small = 'field py-2 text-sm';
</script>

<svelte:head><title>Ladda upp bilder · Våra resor</title></svelte:head>

<BackLink href="/bilder" label="Bilder" />
<h1 class="title mb-2 text-4xl">Ladda upp bilder</h1>
<p class="mb-6 text-muted">
	Bilderna sorteras till resan och dagen de togs, och läggs i ett inlägg om platsen eller tiden stämmer. Passar de
	ingen resa hamnar de under Okategoriserat. Du kan ändra innan de laddas upp.
</p>

<label
	class="card flex cursor-pointer items-center justify-center gap-3 border-dashed px-5 py-6 font-semibold text-rust transition hover:border-rust/40"
>
	<Icon name="image" class="h-6 w-6" />
	{items.length ? 'Välj fler bilder' : 'Välj bilder'}
	<input type="file" accept="image/*" multiple onchange={pick} class="sr-only" />
</label>

{#if preparing > 0}
	<p class="mt-4 animate-pulse text-sm text-muted" role="status">Förbereder {preparing} bilder…</p>
{/if}

{#each groups as g (g.trip)}
	{@const trip = tripById(g.trip)}
	<section class="mt-8">
		<h2 class="mb-3 flex flex-wrap items-baseline gap-x-2">
			<span class="title text-2xl">{trip?.title ?? 'Okategoriserat'}</span>
			<span class="text-sm text-muted">
				{trip ? formatDateRange(trip.start_date, trip.end_date) : 'passar ingen resa'}
			</span>
		</h2>
		<ul class="space-y-2">
			{#each g.list as it (it.key)}
				{@const n = trip && it.day ? dayNumber(trip.start_date, it.day) : 0}
				<li class="card flex gap-3 p-2.5 {it.include ? '' : 'opacity-60'}">
					<img src={it.url} alt="" class="h-20 w-20 shrink-0 rounded-xl object-cover" />
					<div class="min-w-0 flex-1 space-y-1.5">
						<div class="flex items-center justify-between gap-2">
							<p class="truncate text-sm font-semibold text-ink">
								{it.prepared?.taken
									? `${n ? `Dag ${n} · ` : ''}${formatDay(it.day)} kl. ${it.prepared.taken.slice(11)}`
									: 'Okänd tid'}
								{#if it.reason === 'place'}<span class="font-normal text-muted">· nära platsen</span>
								{:else if it.reason === 'time'}<span class="font-normal text-muted">· nära i tid</span>{/if}
							</p>
							<button type="button" onclick={() => remove(it.key)} aria-label="Ta bort bilden" class="shrink-0 text-muted hover:text-ink">
								<Icon name="x" class="h-4 w-4" />
							</button>
						</div>
						<select
							aria-label="Resa"
							value={it.trip}
							onchange={(e) => update(it.key, place(it.prepared!, e.currentTarget.value))}
							class={small}
						>
							<option value="">🗂️ Okategoriserat</option>
							{#each data.trips as t (t.id)}
								<option value={t.id}>{t.title}</option>
							{/each}
						</select>
						{#if trip}
							<select
								aria-label="Lägg bilden i"
								value={it.post}
								onchange={(e) => update(it.key, { post: e.currentTarget.value, reason: '' })}
								class={small}
							>
								<option value="">📷 Dagens bilder</option>
								{#each postsOf(trip.id).filter((p) => p.day.slice(0, 10) === it.day) as p (p.id)}
									<option value={p.id}>{postKinds[p.kind].icon} {p.title || postKinds[p.kind].label}{p.time ? ` (${p.time})` : ''}</option>
								{/each}
							</select>
						{/if}
						{#if it.duplicate}
							<label class="flex items-center gap-2 text-xs text-rust">
								<input type="checkbox" checked={it.include} onchange={(e) => update(it.key, { include: e.currentTarget.checked })} />
								Finns redan. Ladda upp ändå?
							</label>
						{/if}
					</div>
				</li>
			{/each}
		</ul>
	</section>
{/each}

{#if failed.length > 0}
	<ul class="mt-6 space-y-1 text-sm text-red-600">
		{#each failed as it (it.key)}
			<li class="flex justify-between gap-2">
				<span>{it.error}</span>
				<button type="button" onclick={() => remove(it.key)} class="text-muted underline">Ta bort</button>
			</li>
		{/each}
	</ul>
{/if}

{#if items.length > 0}
	<!-- Fast ovanför flikraden, med egen bakgrund så att listan inte syns igenom. -->
	<div class="sticky bottom-24 z-20 -mx-4 mt-8 bg-paper/95 px-4 py-3 backdrop-blur">
		<button type="button" onclick={upload} disabled={saving || preparing > 0 || ready.length === 0} class="btn-primary w-full">
			{preparing > 0 ? 'Förbereder…' : `Ladda upp ${ready.length} ${ready.length === 1 ? 'bild' : 'bilder'}`}
		</button>
		{#if saveError}<p class="mt-2 text-sm text-red-600" role="alert">{saveError}</p>{/if}
	</div>
{/if}
