<script lang="ts">
	import Icon from './Icon.svelte';

	let { href, label }: { href: string; label: string } = $props();
</script>

<a
	{href}
	class="mb-4 inline-flex items-center gap-1 rounded-full py-1 pr-3 text-sm font-medium text-muted transition hover:text-ink"
>
	<Icon name="back" class="h-4 w-4" />
	{label}
</a>
