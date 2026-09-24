/// <reference path="../pb_data/types.d.ts" />

// Inlägg på en resa: övernattning, mat och dryck, sevärdhet eller fri anteckning.
// Gemensamma fält ligger som egna kolumner; mallspecifika fält (faciliteter,
// betalsätt, vad vi åt …) ligger i `details` (JSON).
migrate(
	(app) => {
		const users = app.findCollectionByNameOrId('users');
		const trips = app.findCollectionByNameOrId('trips');

		const member = '(trip.owner = @request.auth.id || trip.participants.id ?= @request.auth.id)';
		const loggedIn = '@request.auth.id != ""';

		const posts = new Collection({
			type: 'base',
			name: 'posts',
			listRule: `${loggedIn} && ${member}`,
			viewRule: `${loggedIn} && ${member}`,
			// Bara resans ägare och deltagare kan skriva, och alltid i eget namn.
			createRule: `${loggedIn} && author = @request.auth.id && ${member}`,
			// Bara den som skrivit inlägget ändrar det. Inlägget kan inte flyttas
			// till en annan resa eller byta författare.
			updateRule:
				`${loggedIn} && author = @request.auth.id && ${member}` +
				' && (@request.body.author:isset = false || @request.body.author = @request.auth.id)' +
				' && (@request.body.trip:isset = false || @request.body.trip = trip)',
			// Författaren eller resans ägare kan ta bort.
			deleteRule: `${loggedIn} && (author = @request.auth.id || trip.owner = @request.auth.id)`,
			fields: [
				{ name: 'trip', type: 'relation', required: true, maxSelect: 1, collectionId: trips.id, cascadeDelete: true },
				{ name: 'author', type: 'relation', required: true, maxSelect: 1, collectionId: users.id },
				{ name: 'kind', type: 'select', required: true, maxSelect: 1, values: ['overnight', 'food', 'sight', 'note'] },
				{ name: 'day', type: 'date', required: true },
				{ name: 'title', type: 'text', max: 200 },
				{ name: 'category', type: 'text', max: 50 },
				{ name: 'body', type: 'text', max: 20000 },
				{ name: 'rating', type: 'number', min: 0, max: 5, onlyInt: true },
				{ name: 'price', type: 'text', max: 100 },
				{ name: 'location', type: 'geoPoint' },
				{ name: 'details', type: 'json', maxSize: 20000 },
				{ name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
				{ name: 'updated', type: 'autodate', onCreate: true, onUpdate: true }
			],
			indexes: ['CREATE INDEX idx_posts_trip_day ON posts (trip, day)']
		});
		app.save(posts);
	},
	(app) => {
		app.delete(app.findCollectionByNameOrId('posts'));
	}
);
