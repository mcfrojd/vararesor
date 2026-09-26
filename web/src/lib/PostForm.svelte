<script lang="ts">
	import { auth } from './auth.svelte';
	import { daysBefore, formatDay, nowTime, today, toDateInput } from './format';
	import {
		attachPhotos,
		enqueue,
		enqueuePhotos,
		isNetworkError,
		newId,
		offline,
		timeout
	} from './offline.svelte';
	import { photoUrl, type PreparedPhoto } from './photos';
	import PhotoPicker from './PhotoPicker.svelte';
	import { decodeFull, parsePlusCode, recoverNearest } from './pluscode';
	import {
		fieldErrors,
		pb,
		type GeoPoint,
		type Photo,
		type Post,
		type PostDetails,
		type PostKind,
		type Trip
	} from './pb';
	import {
		facilities,
		formatLocation,
		hasLocation,
		isStay,
		mealOptions,
		mealsOf,
		nights,
		nightsLabel,
		noiseLevels,
		parseLocation,
		postKinds,
		stayConfig,
		toggleMeal
	} from './posts';
	import Icon from './Icon.svelte';
	import Stars from './Stars.svelte';

	let {
		tripId,
		post,
		kind: initialKind,
		day: initialDay,
		dayPhotos = [],
		trip,
		onsaved,
		oncancel
	}: {
		tripId: string;
		post?: Post;
		kind?: PostKind;
		day: string;
		/** Resans bilder som bara hör till en dag. De för inläggets dag kan läggas i inlägget. */
		dayPhotos?: Photo[];
		/** Resans typ och slut: övernattning är ett boende (hotell m.m.) utom på husbilsresor. */
		trip?: Pick<Trip, 'type' | 'end_date'>;
		/** `queued` = sparat på enheten, skickas när nätet är tillbaka. */
		onsaved: (post: Pick<Post, 'id' | 'day'>, queued?: boolean) => void;
		oncancel: () => void;
	} = $props();

	// Formulärets startvärden tas en gång; sedan äger formuläret dem.
	// svelte-ignore state_referenced_locally
	const initial = post;

	// svelte-ignore state_referenced_locally
	let kind = $state<PostKind | undefined>(initial?.kind ?? initialKind);
	// svelte-ignore state_referenced_locally
	let day = $state(initial ? toDateInput(initial.day) : initialDay);
	// Nytt inlägg för i dag får klockslaget nu; andra dagar lämnas tiden tom.
	// svelte-ignore state_referenced_locally
	const defaultTime = initial ? initial.time : initialDay === today() ? nowTime() : '';
	let time = $state(defaultTime);
	// Tiden tas från vald bild tills man ändrat den själv.
	// svelte-ignore state_referenced_locally
	let timeTouched = $state(!!initial?.time);
	let title = $state(initial?.title ?? '');
	let category = $state(initial?.category ?? '');
	let body = $state(initial?.body ?? '');
	let rating = $state(initial?.rating ?? 0);
	let price = $state(initial?.price ?? '');
	let locationText = $state(hasLocation(initial?.location) ? formatLocation(initial.location) : '');
	// Var positionen kommer ifrån. 'manual' när vi skrivit, tryckt "Här" eller
	// tömt fältet: då rör servern den aldrig. Tom position utan 'manual' kan
	// servern fylla i från Doris spår.
	let locationSource = $state<NonNullable<Post['location_source']>>(initial?.location_source ?? '');
	let details = $state<PostDetails>({
		facilities: [],
		...(initial?.details ?? {}),
		meals: mealsOf(initial?.details)
	});

	// Boende i stället för ställplats: på resor som inte är husbilsresor, eller
	// om inlägget redan är ett boende.
	// svelte-ignore state_referenced_locally
	const stayTrip = (trip?.type ?? 'husbil') !== 'husbil';
	const stayMode = $derived(kind === 'overnight' && (initial ? isStay(initial) || stayTrip : stayTrip));

	/** Förvald utcheckning: resans sista dag (boende för hela resan), annars dagen efter. */
	function defaultUntil(checkIn: string): string {
		const end = trip?.end_date ? toDateInput(trip.end_date) : '';
		return end && end > checkIn ? end : daysBefore(checkIn, -1);
	}
	// svelte-ignore state_referenced_locally
	if (!details.until && stayTrip) details.until = defaultUntil(day);
	const stayNights = $derived(details.until ? nights({ day, details }) : 0);

	// Id för ett nytt inlägg bestäms en gång, så att ett nytt försök efter ett fel
	// inte skapar en dubblett.
	const newPostId = newId();
	let addedPhotos = $state.raw<PreparedPhoto[]>([]);
	let removedPhotos = $state<string[]>([]);
	let preparing = $state(false);

	/** Dagens bilder (uppladdade eller i kön) för vald dag, att välja bland. */
	interface Candidate {
		id: string;
		thumb: string;
		taken: string;
		location: GeoPoint;
		fromTrack: boolean;
	}
	const candidates = $derived<Candidate[]>(
		[
			...dayPhotos
				.filter((p) => p.day.slice(0, 10) === day && !offline.moves[p.id])
				.map((p) => ({
					id: p.id,
					thumb: photoUrl(p, 'thumb'),
					taken: p.taken,
					location: p.location,
					fromTrack: p.location_source === 'track'
				})),
			...offline.photos
				.filter((p) => p.trip === tripId && !p.post && p.day === day && !dayPhotos.some((d) => d.id === p.id))
				.map((p) => ({ id: p.id, thumb: p.thumbUrl, taken: p.taken, location: p.location, fromTrack: false }))
		].sort((a, b) => a.taken.localeCompare(b.taken))
	);
	let chosen = $state<string[]>([]);
	// Positionen kommer från en vald bild och följer valet.
	let locationFromChosen = $state(false);

	function toggleChosen(id: string) {
		chosen = chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id];
		fillFromChosen();
	}

	/** Tid och plats från den tidigaste valda bilden, om man inte fyllt i dem själv. */
	function fillFromChosen() {
		const picked = candidates.filter((c) => chosen.includes(c.id));
		if (!timeTouched) time = picked.find((c) => c.taken)?.taken.slice(11, 16) || defaultTime;
		if (!config?.located || locationSource === 'manual') return;
		if (locationText.trim() && !locationFromChosen) return;
		const at = picked.find((c) => hasLocation(c.location));
		if (at) {
			locationText = formatLocation(at.location);
			locationSource = at.fromTrack ? 'track' : 'photo';
			locationFromChosen = true;
		} else if (locationFromChosen) {
			locationText = '';
			locationSource = '';
			locationFromChosen = false;
		}
	}

	/** Ny dag: bilder från en annan dag hör inte hit. */
	function changeDay() {
		const ids = candidates.map((c) => c.id);
		if (chosen.some((id) => !ids.includes(id))) {
			chosen = chosen.filter((id) => ids.includes(id));
			fillFromChosen();
		}
	}

	let locating = $state(false);
	let errors = $state<Record<string, string>>({});
	let busy = $state(false);

	const config = $derived(kind ? (stayMode ? stayConfig : postKinds[kind]) : undefined);
	/** Pluskoden som positionen senast kom från (visas under fältet). */
	let fromPlusCode = $state('');
	let resolving = $state(false);

	/**
	 * Pluskod i positionsfältet (t.ex. "X3V9+H4 Paralimni, Cypern") görs om till
	 * lat, lon. Korta koder behöver orten, som servern slår upp. Sant om fältet
	 * nu innehåller en position (eller var tomt), falskt vid fel.
	 */
	async function resolvePlusCode(): Promise<boolean> {
		const pc = parsePlusCode(locationText);
		if (!pc) return true;
		resolving = true;
		try {
			let at;
			if (pc.full) at = decodeFull(pc.code);
			else {
				if (!pc.place) {
					errors = { location: 'Skriv orten efter koden, t.ex. "X3V9+H4 Paralimni".' };
					return false;
				}
				const ref = await pb.send<{ lat: number; lon: number } | null>('/api/vararesor/place', {
					query: { q: pc.place },
					signal: timeout(),
					requestKey: null
				});
				if (!ref) {
					errors = { location: `Hittar inte orten "${pc.place}".` };
					return false;
				}
				at = recoverNearest(pc.code, ref);
			}
			fromPlusCode = [pc.code, pc.place].filter(Boolean).join(' ');
			locationText = formatLocation(at);
			locationSource = 'manual';
			locationFromChosen = false;
			errors = {};
			return true;
		} catch {
			errors = { location: 'Kunde inte slå upp orten. Pluskoder med ort kräver nät.' };
			return false;
		} finally {
			resolving = false;
		}
	}

	const mapsUrl = $derived.by(() => {
		const at = locationText.trim() ? parseLocation(locationText) : null;
		return at ? `https://www.google.com/maps/search/?api=1&query=${at.lat},${at.lon}` : '';
	});

	function toggleFacility(f: string) {
		const list = details.facilities ?? [];
		details.facilities = list.includes(f) ? list.filter((x) => x !== f) : [...list, f];
	}

	function useMyPosition() {
		if (!navigator.geolocation) {
			errors = { location: 'Enheten kan inte ge position.' };
			return;
		}
		locating = true;
		navigator.geolocation.getCurrentPosition(
			(pos) => {
				locationText = formatLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude });
				locationSource = 'manual';
				locationFromChosen = false;
				locating = false;
			},
			() => {
				errors = { location: 'Kunde inte hämta position. Är platstjänster tillåtna?' };
				locating = false;
			},
			{ enableHighAccuracy: true, timeout: 15000 }
		);
	}

	/** Behåller bara fälten som hör till vald typ, så att inget gammalt skräp sparas. */
	function cleanDetails(k: PostKind): PostDetails {
		const d = $state.snapshot(details);
		if (k === 'overnight' && stayMode)
			return {
				until: d.until,
				room: d.room?.trim(),
				meals: d.meals ?? [],
				payment: d.payment?.trim()
			};
		if (k === 'overnight')
			return {
				payment: d.payment?.trim(),
				facilities: d.facilities ?? [],
				surface: d.surface?.trim(),
				view: d.view?.trim(),
				noise: d.noise
			};
		if (k === 'food') return { what: d.what?.trim() };
		if (k === 'sight') return { hours: d.hours?.trim() };
		return {};
	}

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		if (!kind || !config) return;
		errors = {};

		let location = { lat: 0, lon: 0 };
		if (!(await resolvePlusCode())) return;
		if (locationText.trim()) {
			const parsed = parseLocation(locationText);
			if (!parsed) {
				errors = { location: 'Skriv position som "lat, lon" (t.ex. 52.52, 13.405) eller en pluskod från Google Maps.' };
				return;
			}
			location = parsed;
		}
		if (stayMode && (!details.until || details.until <= day)) {
			errors = { until: 'Utcheckningen måste vara efter incheckningen.' };
			return;
		}
		if (!title.trim() && !body.trim()) {
			errors = { title: kind === 'note' ? 'Skriv något.' : 'Fyll i ett namn.' };
			return;
		}

		const data = {
			kind,
			day,
			time,
			title: title.trim(),
			category: config.categories.includes(category) ? category : '',
			body: body.trim(),
			rating: config.rated ? rating : 0,
			price: config.priceLabel ? price.trim() : '',
			location,
			location_source: locationSource,
			details: cleanDetails(kind)
		};

		busy = true;
		/** Nya bilder går alltid via kön; de laddas upp i bakgrunden. */
		const savePhotos = async (postId: string) => {
			await attachPhotos(chosen, postId);
			if (addedPhotos.length > 0)
				await enqueuePhotos(
					addedPhotos.map((photo) => ({ photo, post: postId, day })),
					{ trip: tripId, author: auth.user?.id ?? '' }
				);
		};
		try {
			if (initial) {
				const saved = await pb.collection('posts').update<Post>(initial.id, data, { signal: timeout() });
				for (const id of removedPhotos) await pb.collection('photos').delete(id, { signal: timeout() });
				await savePhotos(saved.id);
				onsaved(saved);
				return;
			}
			// Nytt inlägg: id:t sätts här, så att det kan köas och skickas om utan dubbletter.
			const record = { ...data, id: newPostId, trip: tripId, author: auth.user?.id ?? '' };
			if (!navigator.onLine) {
				await enqueue(record);
				await savePhotos(record.id);
				onsaved(record, true);
				return;
			}
			try {
				let saved: Pick<Post, 'id' | 'day'> = record;
				try {
					saved = await pb.collection('posts').create<Post>(record, { signal: timeout() });
				} catch (err) {
					// Id:t finns redan: ett tidigare försök sparade inlägget.
					if (!(err as { response?: { data?: { id?: unknown } } }).response?.data?.id) throw err;
				}
				await savePhotos(saved.id);
				onsaved(saved);
			} catch (err) {
				if (!isNetworkError(err)) throw err;
				await enqueue(record);
				await savePhotos(record.id);
				onsaved(record, true);
			}
		} catch (err) {
			errors = fieldErrors(err);
			if (Object.keys(errors).length === 0)
				errors = {
					form: isNetworkError(err)
						? 'Ingen kontakt med servern. Ändringar av befintliga inlägg kan inte sparas utan nät.'
						: 'Kunde inte spara inlägget.'
				};
		} finally {
			busy = false;
		}
	}

	const input = 'field';
</script>

{#if !kind || !config}
	<p class="title mb-4 text-2xl">Vad vill du lägga till?</p>
	<div class="grid grid-cols-2 gap-3">
		{#each Object.entries(postKinds) as [value, k] (value)}
			<button
				type="button"
				onclick={() => (kind = value as PostKind)}
				class="card flex flex-col items-center gap-2 px-3 py-7 transition hover:-translate-y-0.5 hover:shadow-card"
			>
				<span class="text-4xl">{value === 'overnight' && stayTrip ? stayConfig.icon : k.icon}</span>
				<span class="font-semibold text-ink">{value === 'overnight' && stayTrip ? stayConfig.label : k.label}</span>
			</button>
		{/each}
	</div>
	<button type="button" onclick={oncancel} class="mt-5 text-sm text-muted hover:text-ink">
		Avbryt
	</button>
{:else}
	<form onsubmit={submit} class="space-y-4">
		<div class="flex items-center justify-between gap-3">
			<p
				class="inline-flex items-center gap-2 rounded-full bg-rust-soft px-4 py-2 text-sm font-bold uppercase tracking-wider text-rust"
			>
				{config.icon} {config.label}
			</p>
			{#if !initial}
				<button
					type="button"
					onclick={() => (kind = undefined)}
					class="text-sm font-medium text-muted hover:text-ink"
				>
					Byt typ
				</button>
			{/if}
		</div>

		{#if candidates.length > 0}
			<fieldset class="card p-4">
				<legend class="sr-only">Dagens bilder</legend>
				<p class="font-semibold text-ink">Vill du ta med någon av dagens bilder?</p>
				<p class="mb-3 text-xs text-muted">
					{chosen.length
						? `${chosen.length} vald${chosen.length === 1 ? '' : 'a'}. Tid och plats hämtas från bilden om de är tomma.`
						: 'Tryck på en bild för att välja den. Tid och plats hämtas från bilden.'}
				</p>
				<div class="grid max-h-80 grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-6">
					{#each candidates as c (c.id)}
						{@const on = chosen.includes(c.id)}
						<button
							type="button"
							aria-pressed={on}
							aria-label="{on ? 'Ta bort' : 'Välj'} bilden{c.taken ? ` från kl. ${c.taken.slice(11, 16)}` : ''}"
							onclick={() => toggleChosen(c.id)}
							class="relative aspect-square overflow-hidden rounded-xl border-2 transition {on
								? 'border-rust'
								: 'border-transparent opacity-80 hover:opacity-100'}"
						>
							<img src={c.thumb} alt="" class="h-full w-full object-cover" />
							{#if c.taken}
								<span class="absolute bottom-0.5 left-0.5 rounded bg-black/55 px-1 text-[10px] font-semibold text-white">
									{c.taken.slice(11, 16)}
								</span>
							{/if}
							{#if on}
								<span
									class="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-rust text-xs font-bold text-white"
									>✓</span
								>
							{/if}
						</button>
					{/each}
				</div>
			</fieldset>
		{/if}

		<div class="card space-y-5 p-5">
			<div class="grid grid-cols-[3fr_2fr] gap-3">
				<label class="block space-y-1.5">
					<span class="label">{stayMode ? 'Incheckning' : 'Dag'}</span>
					<input type="date" required bind:value={day} onchange={changeDay} class="{input} min-w-0" />
				</label>
				<label class="block space-y-1.5">
					<span class="label">Tid</span>
					<input type="time" bind:value={time} oninput={() => (timeTouched = true)} class="{input} min-w-0" />
				</label>
			</div>

			<label class="block space-y-1.5">
				<span class="label">{config.titleLabel}</span>
				<input
					maxlength="200"
					bind:value={title}
					placeholder={kind === 'note' ? 'Lägg till rubrik?' : 'Vad heter stället?'}
					class={input}
				/>
				{#if errors.title}<span class="text-sm text-red-600">{errors.title}</span>{/if}
			</label>

			{#if config.categories.length > 0}
				<fieldset>
					<legend class="label mb-2">Typ</legend>
					<div class="flex flex-wrap gap-2">
						{#each config.categories as c (c)}
							<button
								type="button"
								aria-pressed={category === c}
								onclick={() => (category = category === c ? '' : c)}
								class="chip"
							>
								{c}
							</button>
						{/each}
					</div>
				</fieldset>
			{/if}

			{#if config.rated}
				<div>
					<span class="label mb-1">Betyg</span>
					<Stars bind:value={rating} editable />
				</div>
			{/if}

			{#if kind === 'food'}
				<label class="block space-y-1.5">
					<span class="label">Vad vi åt och drack</span>
					<input bind:value={details.what} placeholder="Vad blev det?" class={input} />
				</label>
			{/if}

			{#if config.priceLabel}
				<div class="grid gap-3 {kind === 'overnight' ? 'grid-cols-2' : ''}">
					<label class="block space-y-1.5">
						<span class="label">{config.priceLabel}</span>
						<input maxlength="100" bind:value={price} placeholder="t.ex. 15 €" class={input} />
					</label>
					{#if kind === 'overnight'}
						<label class="block space-y-1.5">
							<span class="label">Betalsätt</span>
							<input bind:value={details.payment} placeholder="Kort, kontant, app…" class={input} />
						</label>
					{/if}
				</div>
			{/if}

			{#if kind === 'sight'}
				<label class="block space-y-1.5">
					<span class="label">Öppettider</span>
					<input bind:value={details.hours} placeholder="t.ex. 10–17" class={input} />
				</label>
			{/if}

			{#if stayMode}
				<div class="grid grid-cols-2 gap-3">
					<label class="block space-y-1.5">
						<span class="label">Utcheckning</span>
						<input type="date" bind:value={details.until} min={day} class="{input} min-w-0" />
					</label>
					<label class="block space-y-1.5">
						<span class="label">Rum</span>
						<input bind:value={details.room} placeholder="t.ex. dubbelrum, 214" class={input} />
					</label>
				</div>
				{#if errors.until}<p class="-mt-3 text-sm text-red-600">{errors.until}</p>
				{:else if stayNights > 0}
					<p class="-mt-3 text-sm text-muted">
						{nightsLabel(stayNights)}, {formatDay(day)} – {formatDay(details.until ?? '')}
					</p>
				{/if}
				<fieldset>
					<legend class="label mb-2">Ingår</legend>
					<div class="flex flex-wrap gap-2">
						{#each mealOptions as m (m.value)}
							<button
								type="button"
								aria-pressed={details.meals?.includes(m.value) ?? false}
								onclick={() => (details.meals = toggleMeal(details.meals ?? [], m.value))}
								class="chip"
							>
								{m.icon}
								{m.value}
							</button>
						{/each}
					</div>
				</fieldset>
			{/if}

			{#if kind === 'overnight' && !stayMode}
				<fieldset>
					<legend class="label mb-2">Faciliteter</legend>
					<div class="flex flex-wrap gap-2">
						{#each facilities as f (f)}
							{@const on = details.facilities?.includes(f) ?? false}
							<button
								type="button"
								aria-pressed={on}
								onclick={() => toggleFacility(f)}
								class="chip"
							>
								{f}
							</button>
						{/each}
					</div>
				</fieldset>

				<div class="grid grid-cols-2 gap-3">
					<label class="block space-y-1.5">
						<span class="label">Underlag</span>
						<input bind:value={details.surface} placeholder="Asfalt, grus, gräs…" class={input} />
					</label>
					<label class="block space-y-1.5">
						<span class="label">Utsikt</span>
						<input bind:value={details.view} class={input} />
					</label>
				</div>

				<fieldset>
					<legend class="label mb-2">Ljudnivå</legend>
					<div class="flex flex-wrap gap-2">
						{#each noiseLevels as n (n)}
							<button
								type="button"
								aria-pressed={details.noise === n}
								onclick={() => (details.noise = details.noise === n ? '' : n)}
								class="chip"
							>
								{n}
							</button>
						{/each}
					</div>
				</fieldset>
			{/if}

			{#if config.located}
				<div class="space-y-1.5">
					<span class="label">Position</span>
					<div class="flex gap-2">
						<input
							bind:value={locationText}
							oninput={() => {
								locationSource = 'manual';
								locationFromChosen = false;
								fromPlusCode = '';
							}}
							onblur={() => void resolvePlusCode()}
							inputmode="decimal"
							placeholder="lat, lon eller pluskod"
							aria-label="Position"
							class="{input} min-w-0"
						/>
						<button
							type="button"
							onclick={useMyPosition}
							disabled={locating}
							class="inline-flex shrink-0 items-center gap-1.5 rounded-2xl border border-line bg-field px-3.5 text-sm font-semibold text-rust transition hover:border-rust/40 disabled:opacity-60"
						>
							<Icon name="locate" class="h-4 w-4" />
							{locating ? 'Söker…' : 'Här'}
						</button>
						{#if mapsUrl}
							<!-- Kolla platsen i Google Maps (öppnas i appen eller en ny flik). -->
							<a
								href={mapsUrl}
								target="_blank"
								rel="noopener"
								aria-label="Visa platsen i Google Maps"
								title="Visa i Google Maps"
								class="inline-flex shrink-0 items-center gap-1.5 rounded-2xl border border-line bg-field px-3 text-sm font-semibold text-rust transition hover:border-rust/40"
							>
								<Icon name="map" class="h-4 w-4" />
								<span class="hidden sm:inline">Maps</span>
							</a>
						{/if}
					</div>
					{#if errors.location}<span class="text-sm text-red-600">{errors.location}</span>{/if}
					{#if resolving}
						<p class="text-xs text-muted">Slår upp pluskoden…</p>
					{:else if fromPlusCode}
						<p class="text-xs text-muted">Från pluskoden {fromPlusCode}.</p>
					{/if}
					{#if locationSource === 'track'}
						<p class="text-xs text-muted">Från Doris GPS-spår. Ändra om ni var någon annanstans.</p>
					{:else if locationSource === 'photo'}
						<p class="text-xs text-muted">Från bildens GPS.</p>
					{/if}
				</div>
			{/if}

			<label class="block space-y-1.5">
				<span class="label">{config.bodyLabel}</span>
				<textarea
					rows={kind === 'note' ? 8 : 4}
					maxlength="20000"
					bind:value={body}
					placeholder={kind === 'note' ? 'Vad hände i dag?' : 'Hur var det?'}
					class={input}
				></textarea>
			</label>

			<PhotoPicker
				existing={initial?.expand?.photos_via_post ?? []}
				postId={initial?.id}
				bind:added={addedPhotos}
				bind:removed={removedPhotos}
				bind:busy={preparing}
				onlocation={(p) => {
					if (config.located && !locationText.trim() && locationSource !== 'manual') {
						locationText = formatLocation(p);
						locationSource = 'photo';
					}
				}}
			/>
		</div>

		{#if errors.form}
			<p class="text-sm text-red-600" role="alert">{errors.form}</p>
		{/if}

		<div class="flex gap-3">
			<button type="submit" disabled={busy || preparing} class="btn-primary flex-1">
				{busy ? 'Sparar…' : preparing ? 'Förbereder bilder…' : 'Spara'}
			</button>
			<button type="button" onclick={oncancel} class="btn-ghost">Avbryt</button>
		</div>
	</form>
{/if}
