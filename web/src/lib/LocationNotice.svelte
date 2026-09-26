<script lang="ts">
	/**
	 * Visas när mobilen tagit bort platsen ur bilderna. Android rensar bort
	 * GPS ur bilder som väljs med filväljaren, men inte ur bilder som delas
	 * till appen från Google Foto.
	 */
	let { count }: { count: number } = $props();

	// Dela-menyn når bara appen när den är installerad på hemskärmen.
	const installed =
		typeof window !== 'undefined' &&
		(window.matchMedia('(display-mode: standalone)').matches ||
			(navigator as Navigator & { standalone?: boolean }).standalone === true);
</script>

{#if count > 0}
	<div class="mt-4 rounded-2xl bg-rust-soft px-4 py-3 text-sm text-rust" role="note">
		<p class="font-semibold">
			Mobilen tog bort platsen från {count === 1 ? 'bilden' : `${count} bilder`}.
		</p>
		<p class="mt-1">
			Välj bilderna i Google Foto och tryck <strong>Dela → Våra resor</strong>, så följer platsen med.
			{#if !installed}Det kräver att appen är installerad på hemskärmen.{/if}
			Annars används Doris spår, eller så får du fylla i platsen själv.
		</p>
	</div>
{/if}
