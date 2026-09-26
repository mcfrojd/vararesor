<script lang="ts" module>
	import type { PostKind } from './pb';

	export interface MapPoint {
		id: string;
		lat: number;
		lon: number;
		kind: PostKind | 'photo';
		title: string;
		subtitle: string;
		href: string;
		/** Bilder: miniatyr som markör, och hur många bilder punkten står för. */
		thumb?: string;
		count?: number;
	}
</script>

<script lang="ts">
	import 'maplibre-gl/dist/maplibre-gl.css';
	import type { Map as MapLibreMap, Marker } from 'maplibre-gl';
	// MapLibre bygger sökvägen till sin worker dynamiskt, så Vite får inte med
	// den av sig själv. ?worker&url buntar workern och ger oss dess adress.
	import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
	import { tick } from 'svelte';
	import Icon from './Icon.svelte';
	import { postKinds } from './posts';
	import type { Line } from './tracks';

	let {
		points,
		tracks = [],
		connect = false,
		class: className = 'h-72',
		bigClass = 'sm:h-[min(54rem,85dvh)]'
	}: {
		points: MapPoint[];
		/** Körda spår (t.ex. Doris GPS), ritas som heldragna linjer. */
		tracks?: Line[];
		/** Dra en streckad linje mellan punkterna i ordning (ungefärlig rutt). */
		connect?: boolean;
		class?: string;
		/** Höjden för "Större karta" på större skärmar. Måste vara större än `class`. */
		bigClass?: string;
	} = $props();

	let container: HTMLDivElement;
	let map = $state<MapLibreMap | null>(null);

	/**
	 * Större karta: helskärm i mobilen (ett finger flyttar kartan, tillbaka-
	 * knappen stänger), tre gånger så hög på större skärmar.
	 */
	let big = $state(false);
	const phone = () => window.matchMedia('(max-width: 639px)').matches;
	$effect(() => {
		const m = map;
		if (!m) return;
		const fullscreen = big && phone();
		tick().then(() => m.resize());
		if (fullscreen) m.cooperativeGestures.disable();
		else m.cooperativeGestures.enable();
		if (!fullscreen) return;
		history.pushState({ bigMap: true }, '');
		const onpop = () => (big = false);
		const onkey = (e: KeyboardEvent) => e.key === 'Escape' && (big = false);
		window.addEventListener('popstate', onpop);
		window.addEventListener('keydown', onkey);
		document.body.style.overflow = 'hidden';
		return () => {
			window.removeEventListener('popstate', onpop);
			window.removeEventListener('keydown', onkey);
			document.body.style.overflow = '';
			if (history.state?.bigMap) history.back();
		};
	});

	// Gratis kartor från OpenFreeMap (OpenStreetMap-data), ingen API-nyckel.
	const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
	const style = `https://tiles.openfreemap.org/styles/${dark ? 'dark' : 'liberty'}`;

	$effect(() => {
		let m: MapLibreMap | undefined;
		let cancelled = false;
		import('maplibre-gl').then(({ Map, NavigationControl, setWorkerUrl }) => {
			if (cancelled) return;
			setWorkerUrl(workerUrl);
			m = new Map({
				container,
				style,
				center: [15, 58],
				zoom: 4,
				attributionControl: { compact: true },
				// Ett finger scrollar sidan; två fingrar flyttar kartan.
				cooperativeGestures: true
			});
			// OpenFreeMaps stil pekar på några symboler som saknas i dess sprite
			// (t.ex. "circle-11", "wood-pattern"). En osynlig ersättare i stället för
			// varningar i konsolen; de syns ändå inte.
			const map_ = m;
			map_.setMissingStyleImageResolver((id) => {
				if (!map_.hasImage(id)) map_.addImage(id, { width: 1, height: 1, data: new Uint8Array(4) });
			});
			m.addControl(new NavigationControl({ showCompass: false }));
			m.on('load', () => {
				// Källhänvisningen startar utfälld och täcker små kartor; ⓘ visar den.
				container.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
				map = m!;
			});
		});
		return () => {
			cancelled = true;
			m?.remove();
			map = null;
		};
	});

	/**
	 * MapLibre placerar markören med `transform` på det yttre elementet. Därför
	 * får bara det inre elementet växa vid hovring: skalas det yttre skalas även
	 * förflyttningen, och markören hoppar iväg från sin plats.
	 */
	function markerElement(p: MapPoint): HTMLElement {
		const el = document.createElement('button');
		el.type = 'button';
		el.setAttribute('aria-label', p.title);
		el.className = 'group block cursor-pointer';
		const face = document.createElement('span');
		el.append(face);
		if (p.thumb) {
			face.className =
				'relative block h-11 w-11 rounded-xl border-2 border-white bg-card shadow-md transition-transform group-hover:scale-110';
			const img = document.createElement('img');
			img.src = p.thumb;
			img.alt = '';
			img.className = 'h-full w-full rounded-[10px] object-cover';
			face.append(img);
			if ((p.count ?? 1) > 1) {
				const badge = document.createElement('span');
				badge.className =
					'absolute -right-2 -top-2 min-w-5 rounded-full bg-rust px-1 text-center text-[11px] font-bold leading-5 text-white';
				badge.textContent = String(p.count);
				face.append(badge);
			}
			return el;
		}
		face.className =
			'flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-card text-lg shadow-md transition-transform group-hover:scale-110';
		face.textContent = p.kind === 'photo' ? '📷' : postKinds[p.kind].icon;
		return el;
	}

	/** Popup byggd med DOM (inte HTML-strängar) så att titlar aldrig tolkas som HTML. */
	function popupContent(p: MapPoint): HTMLElement {
		const a = document.createElement('a');
		a.href = p.href;
		a.className = 'block text-ink';
		const title = document.createElement('strong');
		title.textContent = p.title;
		const sub = document.createElement('span');
		sub.className = 'block text-xs text-muted';
		sub.textContent = p.subtitle;
		if (p.thumb) {
			const img = document.createElement('img');
			img.src = p.thumb;
			img.alt = '';
			img.className = 'mb-1.5 h-24 w-36 rounded-lg object-cover';
			a.append(img);
			if ((p.count ?? 1) > 1) sub.textContent += ` · ${p.count} bilder`;
		}
		a.append(title, sub);
		return a;
	}

	$effect(() => {
		const m = map;
		if (!m) return;
		// Läs allt synkront här: det som bara läses i .then() nedan spåras inte
		// av Svelte, och då ritas kartan inte om när filtret ändras.
		const pts = points;
		const trk = tracks;
		const dashed = connect;
		let markers: Marker[] = [];
		let cancelled = false;

		const lines = [
			...trk.map((coordinates) => ({
				type: 'Feature' as const,
				properties: { dashed: false },
				geometry: { type: 'LineString' as const, coordinates }
			})),
			...(dashed && pts.filter((p) => p.kind !== 'photo').length > 1
				? [
						{
							type: 'Feature' as const,
							properties: { dashed: true },
							geometry: {
								type: 'LineString' as const,
								coordinates: pts.filter((p) => p.kind !== 'photo').map((p) => [p.lon, p.lat])
							}
						}
					]
				: [])
		];
		m.addSource('route', { type: 'geojson', data: { type: 'FeatureCollection', features: lines } });
		const color = getComputedStyle(container).getPropertyValue('--color-accent').trim() || '#2f5d50';
		m.addLayer({
			id: 'route-solid',
			type: 'line',
			source: 'route',
			filter: ['==', ['get', 'dashed'], false],
			layout: { 'line-join': 'round', 'line-cap': 'round' },
			paint: { 'line-color': color, 'line-width': 4, 'line-opacity': 0.85 }
		});
		m.addLayer({
			id: 'route-dashed',
			type: 'line',
			source: 'route',
			filter: ['==', ['get', 'dashed'], true],
			paint: { 'line-color': color, 'line-width': 2.5, 'line-dasharray': [2, 2] }
		});

		import('maplibre-gl').then(({ Marker, Popup, LngLatBounds }) => {
			if (cancelled) return;
			markers = pts.map((p) =>
				// Bilder snett ovanför, så att inläggets ikon på samma plats syns.
				new Marker({ element: markerElement(p), offset: p.thumb ? [18, -18] : [0, 0] })
					.setLngLat([p.lon, p.lat])
					.setPopup(new Popup({ offset: 22, closeButton: false }).setDOMContent(popupContent(p)))
					.addTo(m)
			);

			const bounds = new LngLatBounds();
			pts.forEach((p) => bounds.extend([p.lon, p.lat]));
			trk.forEach((line) => line.forEach((c) => bounds.extend(c)));
			if (bounds.isEmpty()) return;
			const single = pts.length === 1 && trk.length === 0;
			if (single) m.jumpTo({ center: [pts[0].lon, pts[0].lat], zoom: 13 });
			else m.fitBounds(bounds, { padding: 48, maxZoom: 14, duration: 0 });
		});

		return () => {
			cancelled = true;
			markers.forEach((mk) => mk.remove());
			if (m.getLayer('route-solid')) m.removeLayer('route-solid');
			if (m.getLayer('route-dashed')) m.removeLayer('route-dashed');
			if (m.getSource('route')) m.removeSource('route');
		};
	});
</script>

<!-- Storlek och ram sitter här: kartans eget element får en fast class, eftersom
     MapLibre lägger till egna klasser där som inte får skrivas över. -->
<div
	class="w-full overflow-hidden bg-card {big
		? `fixed inset-0 z-50 h-dvh sm:relative sm:inset-auto sm:z-auto ${bigClass} sm:rounded-3xl sm:border sm:border-line sm:shadow-soft`
		: `relative ${className} rounded-3xl border border-line shadow-soft`}"
>
	<div bind:this={container} class="h-full w-full"></div>
	<button
		type="button"
		onclick={() => (big = !big)}
		aria-pressed={big}
		aria-label={big ? 'Mindre karta' : 'Större karta'}
		title={big ? 'Mindre karta' : 'Större karta'}
		class="absolute left-2.5 top-2.5 z-10 flex h-9 w-9 items-center justify-center rounded-xl bg-card text-ink shadow-md transition hover:text-rust"
		style="top: max(0.625rem, env(safe-area-inset-top))"
	>
		<Icon name={big ? 'shrink' : 'expand'} class="h-4 w-4" />
	</button>
</div>

<style>
	/* Popupen följer appens färger i både ljust och mörkt läge. */
	:global(.maplibregl-popup-content) {
		background: var(--color-card);
		border-radius: 0.75rem;
		padding: 0.5rem 0.75rem;
		font-family: var(--font-sans);
	}
	:global(.maplibregl-ctrl-attrib.maplibregl-compact) {
		background: var(--color-card);
		color: var(--color-muted);
	}
	:global(.maplibregl-ctrl-attrib a) {
		color: inherit;
	}
	:global(.maplibregl-popup-tip) {
		border-top-color: var(--color-card) !important;
		border-bottom-color: var(--color-card) !important;
	}
</style>
