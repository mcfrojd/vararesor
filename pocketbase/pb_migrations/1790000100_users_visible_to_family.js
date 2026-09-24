/// <reference path="../pb_data/types.d.ts" />

// Inloggade familjemedlemmar ser varandra (namn och avatar), så att man kan
// välja deltagare på en resa. E-post syns fortfarande bara för en själv.
migrate(
	(app) => {
		const users = app.findCollectionByNameOrId('users');
		users.listRule = '@request.auth.id != ""';
		users.viewRule = '@request.auth.id != ""';
		app.save(users);
	},
	(app) => {
		const users = app.findCollectionByNameOrId('users');
		users.listRule = 'id = @request.auth.id';
		users.viewRule = 'id = @request.auth.id';
		app.save(users);
	}
);
