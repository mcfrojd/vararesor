<script lang="ts">
	import { tempRange, weatherInfo, type Weather } from './weather';

	/** Krämig väderpastill som i Jorial: "☁️ 10–17° · snitt 13°". */
	let { weather, detailed = false }: { weather: Weather; detailed?: boolean } = $props();

	const info = $derived(weatherInfo(weather.code));
</script>

<span
	class="inline-flex flex-wrap items-center gap-x-1.5 rounded-full border border-line bg-field px-3 py-1 text-xs font-medium text-ink"
	title={info.label}
>
	<span aria-hidden="true">{info.icon}</span>
	{#if detailed && info.label}<span>{info.label} ·</span>{/if}
	<span>{tempRange(weather)}</span>
	{#if weather.mean !== null}<span class="text-muted">· snitt {Math.round(weather.mean)}°</span>{/if}
	{#if detailed && weather.precip}<span class="text-muted">· {weather.precip} mm</span>{/if}
	{#if !weather.final}<span class="text-muted">· prognos</span>{/if}
</span>
