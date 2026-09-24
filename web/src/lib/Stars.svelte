<script lang="ts">
	/** Betyg 1–5. Med `editable` kan man klicka; klick på samma stjärna nollställer. */
	let { value = $bindable(0), editable = false }: { value?: number; editable?: boolean } = $props();
</script>

{#if editable}
	<div class="flex gap-1" role="radiogroup" aria-label="Betyg">
		{#each [1, 2, 3, 4, 5] as n (n)}
			<button
				type="button"
				role="radio"
				aria-checked={value === n}
				aria-label="{n} av 5"
				onclick={() => (value = value === n ? 0 : n)}
				class="text-3xl leading-none transition {n <= value ? 'text-ink' : 'text-muted/30'}"
			>
				★
			</button>
		{/each}
	</div>
{:else if value > 0}
	<span class="tracking-widest text-ink" aria-label="Betyg {value} av 5">
		{'★'.repeat(value)}<span class="text-muted/40">{'☆'.repeat(5 - value)}</span>
	</span>
{/if}
