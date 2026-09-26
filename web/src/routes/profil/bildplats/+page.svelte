<script lang="ts">
	import BackLink from '$lib/BackLink.svelte';

	/**
	 * Test: vilka sätt att välja bilder i mobilen som behåller platsen (GPS i
	 * EXIF). Android rensar platsen i vissa väljare; här syns det per väg.
	 * Inget laddas upp.
	 */
	interface Result {
		way: string;
		name: string;
		verdict: 'ok' | 'removed' | 'none' | 'error';
		detail: string;
	}
	let results = $state<Result[]>([]);

	const ways = [
		{ id: 'foto', label: '1. Bildväljaren', hint: 'Som appen gör i dag', accept: 'image/*' },
		// En påhittad icke-bildtyp gör att Chrome öppnar Filer i stället för bildväljaren.
		{ id: 'filer', label: '2. Filer (bara bilder)', hint: 'Välj via "Filer" / "Bläddra"', accept: 'image/*,application/x-vararesor' },
		{ id: 'alla', label: '3. Filer (alla filer)', hint: 'Ingen filtrering', accept: '' }
	];

	async function check(e: Event, way: string) {
		const input = e.currentTarget as HTMLInputElement;
		const files = [...(input.files ?? [])];
		input.value = '';
		const { default: exifr } = await import('exifr');
		for (const file of files) {
			try {
				const tags = await exifr.parse(file, { gps: true, pick: ['GPSVersionID', 'GPSLatitude', 'GPSLongitude', 'Model'] });
				const gps = await exifr.gps(file).catch(() => null);
				const lat = Number(gps?.latitude);
				const lon = Number(gps?.longitude);
				const has = Number.isFinite(lat) && Number.isFinite(lon) && (lat !== 0 || lon !== 0);
				results = [
					{
						way,
						name: file.name,
						verdict: has ? 'ok' : tags?.GPSVersionID !== undefined ? 'removed' : 'none',
						detail: has ? `${lat.toFixed(5)}, ${lon.toFixed(5)}` : tags?.Model ? `Kamera: ${tags.Model}` : ''
					},
					...results
				];
			} catch (err) {
				results = [{ way, name: file.name, verdict: 'error', detail: String(err) }, ...results];
			}
		}
	}

	const verdicts = {
		ok: { text: 'Platsen finns kvar', cls: 'bg-accent-soft text-accent' },
		removed: { text: 'Platsen borttagen av mobilen', cls: 'bg-rust-soft text-rust' },
		none: { text: 'Ingen plats i bilden', cls: 'bg-field text-muted' },
		error: { text: 'Kunde inte läsa', cls: 'bg-rust-soft text-rust' }
	};
</script>

<svelte:head><title>Testa bildplats · Våra resor</title></svelte:head>

<BackLink href="/profil" label="Profil" />
<h1 class="title mb-2 text-4xl">Testa bildplats</h1>
<p class="mb-6 text-muted">
	Välj samma bild (tagen med platsen på) på vart och ett av sätten nedan. Då syns vilket sätt som behåller platsen i
	den här mobilen. Inget laddas upp.
</p>

<div class="space-y-3">
	{#each ways as w (w.id)}
		<label class="card flex cursor-pointer items-center justify-between gap-3 p-4 transition hover:border-rust/40">
			<span>
				<span class="block font-semibold text-ink">{w.label}</span>
				<span class="text-sm text-muted">{w.hint}</span>
			</span>
			<span class="btn-small shrink-0">Välj bild</span>
			<input type="file" accept={w.accept || undefined} multiple onchange={(e) => check(e, w.label)} class="sr-only" />
		</label>
	{/each}
</div>

<p class="mt-4 text-sm text-muted">
	4. Dela: öppna Google Foto, välj en bild och tryck <strong>Dela → Våra resor</strong>. Visar uppladdningssidan ingen
	röd ruta om borttagen plats har platsen följt med.
</p>

{#if results.length > 0}
	<ul class="mt-6 space-y-2">
		{#each results as r, i (i)}
			<li class="card p-3.5 text-sm">
				<p class="font-semibold text-ink">{r.way}</p>
				<p class="truncate text-muted">{r.name}</p>
				<p class="mt-1.5 flex flex-wrap items-center gap-2">
					<span class="rounded-full px-2.5 py-0.5 text-xs font-bold {verdicts[r.verdict].cls}">{verdicts[r.verdict].text}</span>
					<span class="text-muted">{r.detail}</span>
				</p>
			</li>
		{/each}
	</ul>
	<p class="mt-3 text-xs text-muted">{navigator.userAgent}</p>
{/if}
