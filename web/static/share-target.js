// Dela bilder till appen (Web Share Target). Mobilens "Dela" skickar bilderna
// som ett formulär (POST /dela). Service workern sparar dem i en egen cache och
// skickar vidare till uppladdningssidan, som hämtar dem därifrån.
//
// Varför: bilder som väljs med filväljaren får platsen bortrensad av Android,
// men bilder som delas från Google Foto behåller den.
self.addEventListener('fetch', (event) => {
	const url = new URL(event.request.url);
	if (event.request.method !== 'POST' || url.pathname !== '/dela') return;
	event.respondWith(
		(async () => {
			const form = await event.request.formData();
			const files = form.getAll('bilder').filter((f) => typeof f === 'object' && f.size > 0);
			const cache = await caches.open('delade-bilder');
			for (const key of await cache.keys()) await cache.delete(key);
			await Promise.all(
				files.map((file, i) =>
					cache.put(
						`/delade-bilder/${i}`,
						new Response(file, {
							headers: { 'content-type': file.type, 'x-filnamn': encodeURIComponent(file.name || `bild-${i}.jpg`) }
						})
					)
				)
			);
			return Response.redirect(`/bilder/ladda-upp?delade=${files.length}`, 303);
		})()
	);
});
