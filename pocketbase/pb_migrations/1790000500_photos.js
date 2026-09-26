/// <reference path="../pb_data/types.d.ts" />

// Bilder till inlägg. Varje bild har tre filer, alla i S3:
//   original  orört, som det kom från mobilen
//   web       webp, längsta sida 1600 px, för att visa i appen
//   thumb     webp, längsta sida 480 px, för listor och kartan
// web och thumb skapas i mobilen före uppladdning. Originalet laddas upp i ett
// eget steg efteråt, så att bilden syns snabbt även på dålig täckning.
migrate(
	(app) => {
		const users = app.findCollectionByNameOrId('users');
		const trips = app.findCollectionByNameOrId('trips');
		const posts = app.findCollectionByNameOrId('posts');

		const member = '(trip.owner = @request.auth.id || trip.participants.id ?= @request.auth.id)';
		const loggedIn = '@request.auth.id != ""';
		const images = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/avif', 'image/gif'];

		const photos = new Collection({
			type: 'base',
			name: 'photos',
			listRule: `${loggedIn} && ${member}`,
			viewRule: `${loggedIn} && ${member}`,
			// I eget namn, på en resa man är med i, och inlägget måste höra till resan.
			createRule: `${loggedIn} && author = @request.auth.id && ${member} && post.trip = trip`,
			// Bara den som laddat upp bilden ändrar den (t.ex. lägger till originalet).
			updateRule:
				`${loggedIn} && author = @request.auth.id` +
				' && (@request.body.author:isset = false || @request.body.author = @request.auth.id)' +
				' && (@request.body.trip:isset = false || @request.body.trip = trip)' +
				' && (@request.body.post:isset = false || @request.body.post = post)',
			deleteRule: `${loggedIn} && (author = @request.auth.id || trip.owner = @request.auth.id)`,
			fields: [
				{ name: 'trip', type: 'relation', required: true, maxSelect: 1, collectionId: trips.id, cascadeDelete: true },
				{ name: 'post', type: 'relation', required: true, maxSelect: 1, collectionId: posts.id, cascadeDelete: true },
				{ name: 'author', type: 'relation', required: true, maxSelect: 1, collectionId: users.id },
				{ name: 'day', type: 'date', required: true },
				// När bilden togs enligt kameran, "ÅÅÅÅ-MM-DD TT:MM" lokal tid.
				{ name: 'taken', type: 'text', max: 16 },
				// Från bildens GPS-data. Saknas den används inläggets position.
				{ name: 'location', type: 'geoPoint' },
				{ name: 'width', type: 'number', onlyInt: true, min: 0 },
				{ name: 'height', type: 'number', onlyInt: true, min: 0 },
				{ name: 'original', type: 'file', maxSelect: 1, maxSize: 60 * 1024 * 1024, mimeTypes: images },
				{ name: 'web', type: 'file', required: true, maxSelect: 1, maxSize: 10 * 1024 * 1024, mimeTypes: ['image/webp'] },
				{ name: 'thumb', type: 'file', required: true, maxSelect: 1, maxSize: 2 * 1024 * 1024, mimeTypes: ['image/webp'] },
				{ name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
				{ name: 'updated', type: 'autodate', onCreate: true, onUpdate: true }
			],
			indexes: ['CREATE INDEX idx_photos_post ON photos (post)', 'CREATE INDEX idx_photos_trip_day ON photos (trip, day)']
		});
		app.save(photos);
	},
	(app) => {
		app.delete(app.findCollectionByNameOrId('photos'));
	}
);
