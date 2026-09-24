/// <reference path="../pb_data/types.d.ts" />

// Grundschema: familjens konton (users) och resor (trips).
migrate(
	(app) => {
		// Ingen egen registrering – familjens konton skapas i PocketBase admin (/_/).
		const users = app.findCollectionByNameOrId('users');
		users.createRule = null;
		app.save(users);

		const member = '@request.auth.id != "" && (owner = @request.auth.id || participants.id ?= @request.auth.id)';
		const ownerOnly = '@request.auth.id != "" && owner = @request.auth.id';

		const trips = new Collection({
			type: 'base',
			name: 'trips',
			listRule: member,
			viewRule: member,
			createRule: '@request.auth.id != "" && @request.body.owner = @request.auth.id',
			// Ägaren kan inte flytta resan till någon annan.
			updateRule: ownerOnly + ' && (@request.body.owner:isset = false || @request.body.owner = @request.auth.id)',
			deleteRule: ownerOnly,
			fields: [
				{ name: 'title', type: 'text', required: true, max: 200 },
				{ name: 'type', type: 'select', required: true, maxSelect: 1, values: ['husbil', 'semester', 'egen'] },
				{ name: 'start_date', type: 'date' },
				{ name: 'end_date', type: 'date' },
				{ name: 'description', type: 'text', max: 5000 },
				{
					name: 'cover',
					type: 'file',
					maxSelect: 1,
					maxSize: 20 * 1024 * 1024,
					mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic'],
					thumbs: ['640x360']
				},
				{ name: 'owner', type: 'relation', required: true, maxSelect: 1, collectionId: users.id },
				{ name: 'participants', type: 'relation', maxSelect: 50, collectionId: users.id },
				{ name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
				{ name: 'updated', type: 'autodate', onCreate: true, onUpdate: true }
			],
			indexes: ['CREATE INDEX idx_trips_owner ON trips (owner)']
		});
		app.save(trips);
	},
	(app) => {
		app.delete(app.findCollectionByNameOrId('trips'));

		const users = app.findCollectionByNameOrId('users');
		users.createRule = '';
		app.save(users);
	}
);
