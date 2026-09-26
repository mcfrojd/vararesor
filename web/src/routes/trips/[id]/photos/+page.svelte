<script lang="ts">
	import { goto } from '$app/navigation';
	import { auth } from '$lib/auth.svelte';
	import BackLink from '$lib/BackLink.svelte';
	import { dayNumber, defaultDay, formatDay, tripDays } from '$lib/format';
	import Icon from '$lib/Icon.svelte';
	import { enqueuePhotos } from '$lib/offline.svelte';
	import { isDuplicate, suggest, type Destination } from '$lib/photoMatch';
	import { preparePhoto, type PreparedPhoto } from '$lib/photos';
	import { kindOf } from '$lib/posts';

	let { data } = $props();

	const trip = $derived(data.trip);
	const posts = $derived(data.posts);

	interface Item extends Partial<Destination> {
		key: number;
		name: string;
		url?: string;
		prepared?: PreparedPhoto;
		error?: string;
		/** Finns redan på resan. Följer inte med om man inte bockar i den. */
		duplicate?: boolean;
		include: boolean;
	}

	// raw: bilderna ska sparas i IndexedDB, och Svelte-proxys går inte att spara där.
	let items = $state.raw<Item[]>([]);
	let nextKey = 0;
	let preparing = $state(0);
	let saving = $state(false);
	let saveError = $state('');

	// svelte-ignore state_referenced_locally
	const fallbackDay = defaultDay(trip.start_date, trip.end_date);
	const days = $derived(tripDays(trip.start_date, trip.end_date, posts.map((p) => p.day)));

	function update(key: number, patch: Partial<Item>) {
		items = items.map((it) => (it.key === key ? { ...it, ...patch } : it));
	}

	async function pick(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const files = [...(input.files ?? [])];
		input.value = '';
		const fresh = files.map((f) => ({ key: nextKey++, name: f.name, include: true }));
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
					...suggest(prepared, posts, fallbackDay),
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

	/** Ny dag: föreslå inlägg igen för den dagen. */
	function setDay(it: Item, day: string) {
		if (!it.prepared) return;
		const s = suggest({ ...it.prepared, taken: it.prepared.taken ? day + it.prepared.taken.slice(10) : '' }, posts, day);
		update(it.key, { day, post: s.post, reason: s.reason });
	}

	$effect(() => () => items.forEach((it) => it.url && URL.revokeObjectURL(it.url)));

	const ready = $derived(items.filter((it) => it.prepared && it.include));
	const failed = $derived(items.filter((it) => it.error));
	// Grupperat per dag, i tidsordning.
	const groups = $derived.by(() => {
		const byDay = new Map<string, Item[]>();
		for (const it of items) {
			if (!it.prepared) continue;
			const d = it.day ?? fallbackDay;
			byDay.set(d, [...(byDay.get(d) ?? []), it]);
		}
		return [...byDay.entries()]
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([day, list]) => ({
				day,
				list: list.sort((a, b) => (a.prepared?.taken ?? '').localeCompare(b.prepared?.taken ?? ''))
			}));
	});
	const inTrip = (day: string) =>
		(!trip.start_date || day >= trip.start_date.slice(0, 10)) && (!trip.end_date || day <= trip.end_date.slice(0, 10));

	const toPosts = $derived(ready.filter((it) => it.post).length);

	async function upload() {
		if (ready.length === 0) return;
		saving = true;
		saveError = '';
		try {
			await enqueuePhotos(
				ready.map((it) => ({ photo: it.prepared!, post: it.post ?? '', day: it.day ?? fallbackDay })),
				{ trip: trip.id, author: auth.user?.id ?? '' }
			);
		} catch (err) {
			saving = false;
			saveError = `Kunde inte lägga bilderna i kön: ${err instanceof Error ? err.message : String(err)}`;
			return;
		}
		const first = [...ready].sort((a, b) => (a.day ?? '').localeCompare(b.day ?? ''))[0];
		goto(`/trips/${trip.id}#dag-${first.day}`, { replaceState: true });
	}
</script>

<svelte:head><title>Lägg till bilder · {trip.title}</title></svelte:head>

<BackLink href="/trips/{trip.id}" label={trip.title} />
<h1 class="title mb-2 text-4xl">Lägg till bilder</h1>
<p class="mb-6 text-muted">
	Välj bilder från resan. De sorteras till rätt dag efter när de togs, och läggs i ett inlägg om platsen eller
	tiden stämmer. Du kan ändra innan de laddas upp.
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

{#each groups as g (g.day)}
	{@const n = dayNumber(trip.start_date, g.day)}
	{@const dayPosts = posts.filter((p) => p.day.slice(0, 10) === g.day)}
	<section class="mt-8">
		<h2 class="mb-3 flex flex-wrap items-baseline gap-x-2">
			<span class="title text-2xl">{n ? `Dag ${n}` : 'Före resan'}</span>
			<span class="text-sm text-muted">{formatDay(g.day)}</span>
			{#if !inTrip(g.day)}
				<span class="rounded-full bg-rust-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rust">
					Utanför resans datum
				</span>
			{/if}
		</h2>
		<ul class="space-y-2">
			{#each g.list as it (it.key)}
				<li class="card flex gap-3 p-2.5 {it.include ? '' : 'opacity-60'}">
					<img src={it.url} alt="" class="h-20 w-20 shrink-0 rounded-xl object-cover" />
					<div class="min-w-0 flex-1 space-y-1.5">
						<div class="flex items-center justify-between gap-2">
							<p class="truncate text-sm font-semibold text-ink">
								{it.prepared?.taken ? `kl. ${it.prepared.taken.slice(11)}` : 'Okänd tid'}
								{#if it.reason === 'place'}<span class="font-normal text-muted">· nära platsen</span>
								{:else if it.reason === 'time'}<span class="font-normal text-muted">· nära i tid</span>{/if}
							</p>
							<button type="button" onclick={() => remove(it.key)} aria-label="Ta bort bilden" class="shrink-0 text-muted hover:text-ink">
								<Icon name="x" class="h-4 w-4" />
							</button>
						</div>
						<select
							aria-label="Lägg bilden i"
							value={it.post ?? ''}
							onchange={(e) => update(it.key, { post: e.currentTarget.value, reason: '' })}
							class="field py-2 text-sm"
						>
							<option value="">📷 Dagens bilder</option>
							{#each dayPosts as p (p.id)}
								<option value={p.id}>{kindOf(p).icon} {p.title || kindOf(p).label}{p.time ? ` (${p.time})` : ''}</option>
							{/each}
						</select>
						{#if !it.prepared?.taken}
							<select
								aria-label="Dag"
								value={it.day}
								onchange={(e) => setDay(it, e.currentTarget.value)}
								class="field py-2 text-sm"
							>
								{#each days as d (d)}
									<option value={d}>{formatDay(d)}</option>
								{/each}
							</select>
						{/if}
						{#if it.duplicate}
							<label class="flex items-center gap-2 text-xs text-rust">
								<input type="checkbox" checked={it.include} onchange={(e) => update(it.key, { include: e.currentTarget.checked })} />
								Finns redan på resan. Ladda upp ändå?
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
			{preparing > 0
				? 'Förbereder…'
				: `Ladda upp ${ready.length} ${ready.length === 1 ? 'bild' : 'bilder'}${toPosts ? ` (${toPosts} till inlägg)` : ''}`}
		</button>
		{#if saveError}<p class="mt-2 text-sm text-red-600" role="alert">{saveError}</p>{/if}
	</div>
{/if}
