/// <reference path="../pb_data/types.d.ts" />

// Slår upp en ort (t.ex. "Paralimni, Cypern") till en position, som referens
// för korta pluskoder (se web/src/lib/pluscode.ts). Via OpenStreetMaps
// Nominatim (gratis, ingen nyckel). Deras regler: tydlig User-Agent och högst
// ett anrop per sekund; svaren sparas därför i minnet i 30 dagar.
routerAdd(
	'GET',
	'/api/vararesor/place',
	(e) => {
		const q = String(e.request.url.query().get('q') || '').trim();
		if (!q || q.length > 200) throw new BadRequestError('Skriv en ort.');
		const key = 'place:' + q.toLowerCase();
		const cached = e.app.store().get(key);
		if (cached && Date.now() - cached.at < 30 * 24 * 60 * 60 * 1000) return e.json(200, cached.result);

		const last = e.app.store().get('place:last') || 0;
		if (Date.now() - last < 1100) throw new TooManyRequestsError('Försök igen om en sekund.');
		e.app.store().set('place:last', Date.now());

		const res = $http.send({
			url: 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&accept-language=sv&q=' + encodeURIComponent(q),
			method: 'GET',
			headers: { 'User-Agent': 'VaraResor/1.0 (familjens resedagbok, egen server)' },
			timeout: 10
		});
		if (res.statusCode !== 200) throw new BadRequestError('Kunde inte slå upp orten just nu.');
		const hit = (res.json || [])[0];
		const result = hit ? { lat: Number(hit.lat), lon: Number(hit.lon), name: hit.display_name } : null;
		e.app.store().set(key, { at: Date.now(), result });
		return e.json(200, result);
	},
	$apis.requireAuth('users')
);
