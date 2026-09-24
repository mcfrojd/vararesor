<script lang="ts">
	import { page } from '$app/state';
</script>

<div class="card px-6 py-12 text-center">
	<p class="text-4xl">🧭</p>
	<p class="title mt-3 text-3xl">{page.status === 404 ? 'Hittade inte sidan' : 'Något gick fel'}</p>
	<p class="mt-1 text-muted">{page.error?.message}</p>
	<a href="/" class="btn-primary mt-6">Till alla resor</a>
</div>
