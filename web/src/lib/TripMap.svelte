<script lang="ts" module>
	import type { PostKind } from './pb';

	export interface MapPoint {
		id: string;
		lat: number;
		lon: number;
		kind: PostKind;
		title: string;
		subtitle: string;
		href: string;
	}
</script>

<script lang="ts">
	import 'maplibre-gl/dist/maplibre-gl.css';
	import type { Map as MapLibreMap, Marker } from 'maplibre-gl';
	// MapLibre bygger sökvägen till sin worker dynamiskt, så Vite får inte med
	// den av sig själv. ?worker&url buntar workern och ger oss dess adress.
	import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
	import { postKinds } from './posts';
	import type { Line } from './tracks';

	let {
		points,
		tracks = [],
		connect = false,
		class: className = 'h-72'
	}: {
		points: MapPoint[];
		/** Körda spår (t.ex. Doris GPS), ritas som heldragna linjer. */
		tracks?: Line[];
		/** Dra en streckad linje mellan punkterna i ordning (ungefärlig rutt). */
		connect?: boolean;
		class?: string;
	} = $props();

	let container: HTMLDivElement;
	let map = $state<MapLibreMap | null>(null);

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

	function markerElement(p: MapPoint): HTMLElement {
		const el = document.createElement('button');
		el.type = 'button';
		el.className =
			'flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-card text-lg shadow-md';
		el.textContent = postKinds[p.kind].icon;
		el.setAttribute('aria-label', p.title);
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
		a.append(title, sub);
		return a;
	}

	$effect(() => {
		const m = map;
		if (!m) return;
		let markers: Marker[] = [];
		let cancelled = false;

		const lines = [
			...tracks.map((coordinates) => ({
				type: 'Feature' as const,
				properties: { dashed: false },
				geometry: { type: 'LineString' as const, coordinates }
			})),
			...(connect && points.length > 1
				? [
						{
							type: 'Feature' as const,
							properties: { dashed: true },
							geometry: {
								type: 'LineString' as const,
								coordinates: points.map((p) => [p.lon, p.lat])
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
			markers = points.map((p) =>
				new Marker({ element: markerElement(p) })
					.setLngLat([p.lon, p.lat])
					.setPopup(new Popup({ offset: 22, closeButton: false }).setDOMContent(popupContent(p)))
					.addTo(m)
			);

			const bounds = new LngLatBounds();
			points.forEach((p) => bounds.extend([p.lon, p.lat]));
			tracks.forEach((line) => line.forEach((c) => bounds.extend(c)));
			if (bounds.isEmpty()) return;
			const single = points.length === 1 && tracks.length === 0;
			if (single) m.jumpTo({ center: [points[0].lon, points[0].lat], zoom: 13 });
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

<div bind:this={container} class="{className} w-full overflow-hidden rounded-2xl border border-line bg-card"></div>

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
