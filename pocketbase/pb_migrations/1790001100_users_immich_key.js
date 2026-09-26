/// <reference path="../pb_data/types.d.ts" />

// Immich-nyckel per person, satt på profilsidan. Dold: skickas aldrig ut i API:t,
// bara servern läser den (pb_hooks/immich.js). Går före IMMICH_API_KEYS i .env.
migrate(
	(app) => {
		const users = app.findCollectionByNameOrId('users');
		users.fields.add(new TextField({ name: 'immich_key', max: 200, hidden: true }));
		app.save(users);
	},
	(app) => {
		const users = app.findCollectionByNameOrId('users');
		users.fields.removeByName('immich_key');
		app.save(users);
	}
);
