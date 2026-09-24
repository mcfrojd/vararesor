<script lang="ts">
	import { auth } from './auth.svelte';
	import Avatar from './Avatar.svelte';
	import { toDateInput, tripTypes } from './format';
	import { fieldErrors, pb, type Trip, type TripType, type User } from './pb';

	let {
		trip,
		onsaved,
		oncancel
	}: { trip?: Trip; onsaved: (trip: Trip) => void; oncancel: () => void } = $props();

	// Formulärets startvärden tas från resan en gång; sedan äger formuläret dem.
	// svelte-ignore state_referenced_locally
	const initial = trip;

	let title = $state(initial?.title ?? '');
	let type = $state<TripType>(initial?.type ?? 'husbil');
	let startDate = $state(toDateInput(initial?.start_date ?? ''));
	let endDate = $state(toDateInput(initial?.end_date ?? ''));
	let description = $state(initial?.description ?? '');
	let participants = $state<string[]>(initial?.participants ?? []);

	// Omslagsbild: befintlig fil, ny vald fil, eller borttagen.
	let coverFile = $state<File | null>(null);
	let coverRemoved = $state(false);
	let coverPreview = $state('');

	let users = $state<User[]>([]);
	let errors = $state<Record<string, string>>({});
	let busy = $state(false);

	const ownerId = initial?.owner ?? auth.user?.id;
	const others = $derived(users.filter((u) => u.id !== ownerId));

	const existingCover = $derived(
		initial?.cover && !coverRemoved ? pb.files.getURL(initial, initial.cover, { thumb: '640x360' }) : ''
	);

	$effect(() => {
		pb.collection('users')
			.getFullList<User>({ sort: 'name' })
			.then((list) => (users = list))
			.catch(() => (users = []));
	});

	// Frigör förhandsvisningen när den byts ut eller formuläret stängs.
	$effect(() => {
		const url = coverPreview;
		return () => {
			if (url) URL.revokeObjectURL(url);
		};
	});

	function pickCover(e: Event) {
		const file = (e.currentTarget as HTMLInputElement).files?.[0];
		if (!file) return;
		coverFile = file;
		coverRemoved = false;
		coverPreview = URL.createObjectURL(file);
	}

	function removeCover() {
		coverFile = null;
		coverPreview = '';
		coverRemoved = true;
	}

	function toggleParticipant(id: string) {
		participants = participants.includes(id)
			? participants.filter((p) => p !== id)
			: [...participants, id];
	}

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		errors = {};
		if (startDate && endDate && endDate < startDate) {
			errors = { end_date: 'Slutdatum kan inte vara före startdatum.' };
			return;
		}

		const data: Record<string, unknown> = {
			title: title.trim(),
			type,
			start_date: startDate,
			end_date: endDate,
			description: description.trim(),
			participants
		};
		if (coverFile) data.cover = coverFile;
		else if (coverRemoved) data.cover = null;

		busy = true;
		try {
			const saved = initial
				? await pb.collection('trips').update<Trip>(initial.id, data)
				: await pb.collection('trips').create<Trip>({ ...data, owner: auth.user?.id });
			onsaved(saved);
		} catch (err) {
			errors = fieldErrors(err);
			if (Object.keys(errors).length === 0) errors = { form: 'Kunde inte spara resan.' };
		} finally {
			busy = false;
		}
	}

	const input =
		'w-full rounded-xl border border-line bg-card px-3 py-2.5 outline-none focus:border-accent';
</script>

<form onsubmit={submit} class="space-y-5">
	<label class="block space-y-1">
		<span class="text-sm font-medium">Namn på resan</span>
		<input
			required
			maxlength="200"
			bind:value={title}
			placeholder="t.ex. Tyskland 2026"
			class={input}
		/>
		{#if errors.title}<span class="text-sm text-red-600">{errors.title}</span>{/if}
	</label>

	<fieldset class="space-y-1">
		<legend class="mb-1 text-sm font-medium">Typ av resa</legend>
		<div class="grid grid-cols-3 gap-2">
			{#each Object.entries(tripTypes) as [value, t] (value)}
				<label
					class="flex cursor-pointer flex-col items-center gap-1 rounded-xl border px-2 py-3 text-sm
						{type === value ? 'border-accent bg-accent-soft font-medium' : 'border-line bg-card'}"
				>
					<input type="radio" name="type" {value} bind:group={type} class="sr-only" />
					<span class="text-2xl">{t.icon}</span>
					{t.label}
				</label>
			{/each}
		</div>
	</fieldset>

	<div class="grid grid-cols-2 gap-3">
		<label class="block space-y-1">
			<span class="text-sm font-medium">Från</span>
			<input type="date" bind:value={startDate} class={input} />
		</label>
		<label class="block space-y-1">
			<span class="text-sm font-medium">Till</span>
			<input type="date" bind:value={endDate} min={startDate || undefined} class={input} />
		</label>
		{#if errors.start_date || errors.end_date}
			<p class="col-span-2 text-sm text-red-600">{errors.start_date || errors.end_date}</p>
		{/if}
	</div>

	<label class="block space-y-1">
		<span class="text-sm font-medium">Beskrivning</span>
		<textarea
			rows="4"
			maxlength="5000"
			bind:value={description}
			placeholder="Vart ska ni, och varför?"
			class={input}
		></textarea>
	</label>

	<div class="space-y-1">
		<span class="text-sm font-medium">Omslagsbild</span>
		{#if coverPreview || existingCover}
			<div class="relative overflow-hidden rounded-xl border border-line">
				<img src={coverPreview || existingCover} alt="" class="aspect-video w-full object-cover" />
				<button
					type="button"
					onclick={removeCover}
					class="absolute right-2 top-2 rounded-full bg-black/60 px-3 py-1 text-sm text-white"
				>
					Ta bort
				</button>
			</div>
		{/if}
		<label
			class="flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-line bg-card px-3 py-4 text-sm text-muted hover:border-accent"
		>
			<input
				type="file"
				accept="image/jpeg,image/png,image/webp,image/heic"
				onchange={pickCover}
				class="sr-only"
			/>
			{coverPreview || existingCover ? 'Byt bild' : '📷 Välj bild'}
		</label>
		{#if errors.cover}<span class="text-sm text-red-600">{errors.cover}</span>{/if}
	</div>

	{#if others.length > 0}
		<fieldset class="space-y-1">
			<legend class="mb-1 text-sm font-medium">Deltagare</legend>
			<p class="mb-2 text-sm text-muted">Deltagare ser resan och kan bidra med inlägg.</p>
			<div class="flex flex-wrap gap-2">
				{#each others as user (user.id)}
					{@const selected = participants.includes(user.id)}
					<button
						type="button"
						aria-pressed={selected}
						onclick={() => toggleParticipant(user.id)}
						class="flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-sm
							{selected ? 'border-accent bg-accent-soft font-medium' : 'border-line bg-card'}"
					>
						<Avatar {user} size="h-7 w-7 text-[10px]" />
						{user.name || user.email}
						{#if selected}<span class="text-accent">✓</span>{/if}
					</button>
				{/each}
			</div>
		</fieldset>
	{/if}

	{#if errors.form}
		<p class="text-sm text-red-600" role="alert">{errors.form}</p>
	{/if}

	<div class="flex gap-3">
		<button
			type="submit"
			disabled={busy}
			class="flex-1 rounded-xl bg-accent py-2.5 font-medium text-paper disabled:opacity-60"
		>
			{busy ? 'Sparar…' : initial ? 'Spara' : 'Skapa resa'}
		</button>
		<button
			type="button"
			onclick={oncancel}
			class="rounded-xl border border-line px-5 py-2.5 hover:bg-accent-soft"
		>
			Avbryt
		</button>
	</div>
</form>
