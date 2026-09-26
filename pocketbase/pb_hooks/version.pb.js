/// <reference path="../pb_data/types.d.ts" />

// Versionen som körs på servern (satt vid bygget av deploy.sh). Appen jämför
// med sin egen version för att se om den har laddat den senaste.
routerAdd('GET', '/api/vararesor/version', (e) => {
	let version = null;
	try {
		version = JSON.parse($os.getenv('APP_VERSION') || 'null');
	} catch (_) {
		version = null;
	}
	e.response.header().set('cache-control', 'no-store');
	return e.json(200, { version });
});
