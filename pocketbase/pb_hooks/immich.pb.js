/// <reference path="../pb_data/types.d.ts" />

// Immich-status för profilsidan (se immich.js). ?check=1 provar nyckeln mot Immich.
routerAdd(
	'GET',
	'/api/vararesor/immich',
	(e) => {
		const check = e.request.url.query().get('check') === '1';
		return e.json(200, require(`${__hooks}/immich.js`).status(e.app, e.auth.id, check));
	},
	$apis.requireAuth('users')
);

// Spara (eller ta bort, med tom nyckel) den inloggades Immich-nyckel. Fältet är
// dolt, så det går inte att sätta via vanliga API:t; det görs här i stället.
routerAdd(
	'POST',
	'/api/vararesor/immich',
	(e) => {
		const key = String(e.requestInfo().body.key || '').trim();
		if (key.length > 200) throw new BadRequestError('Nyckeln är för lång.');
		const user = e.app.findRecordById('users', e.auth.id);
		user.set('immich_key', key);
		e.app.save(user);
		return e.json(200, require(`${__hooks}/immich.js`).status(e.app, e.auth.id, !!key));
	},
	$apis.requireAuth('users')
);
