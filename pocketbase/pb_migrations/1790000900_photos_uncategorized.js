/// <reference path="../pb_data/types.d.ts" />

// Okategoriserade bilder: bilder som inte passar någon resa saknar `trip` (och
// `post`). De syns bara för den som laddat upp dem, tills de hamnar i en resa:
// automatiskt när en resa med rätt datum skapas (pb_hooks/albums.js), eller
// när man själv lägger dem i en resa man är med i.
migrate(
	(app) => {
		const photos = app.findCollectionByNameOrId('photos');
		const loggedIn = '@request.auth.id != ""';
		const member = '(trip.owner = @request.auth.id || trip.participants.id ?= @request.auth.id)';
		const see = `${loggedIn} && ((trip != "" && ${member}) || (trip = "" && author = @request.auth.id))`;
		const untouched = ['day', 'taken', 'taken_at', 'location', 'location_source', 'width', 'height', 'original', 'web', 'thumb']
			.map((f) => `@request.body.${f}:isset = false`)
			.join(' && ');
		const newTripMember =
			'(@request.body.trip.owner = @request.auth.id || @request.body.trip.participants.id ?= @request.auth.id)';

		photos.fields.getByName('trip').required = false;
		photos.fields.getByName('day').required = false;
		photos.listRule = see;
		photos.viewRule = see;
		photos.createRule =
			`${loggedIn} && author = @request.auth.id` +
			` && ((@request.body.trip = "" && @request.body.post = "") || (${member} && (post = "" || post.trip = trip)))`;
		photos.updateRule =
			`${loggedIn} && (author = @request.auth.id || (trip != "" && ${member} && ${untouched}))` +
			' && (@request.body.author:isset = false || @request.body.author = author)' +
			// Resan ändras inte, utom när en okategoriserad bild läggs i en resa man är med i.
			` && (@request.body.trip:isset = false || @request.body.trip = trip || (trip = "" && ${newTripMember}))` +
			' && (@request.body.post:isset = false || @request.body.post = "" || @request.body.post.trip = trip || @request.body.post.trip = @request.body.trip)';
		app.save(photos);
	},
	(app) => {
		const photos = app.findCollectionByNameOrId('photos');
		const member = '(trip.owner = @request.auth.id || trip.participants.id ?= @request.auth.id)';
		const loggedIn = '@request.auth.id != ""';
		const untouched = ['day', 'taken', 'taken_at', 'location', 'location_source', 'width', 'height', 'original', 'web', 'thumb']
			.map((f) => `@request.body.${f}:isset = false`)
			.join(' && ');
		photos.fields.getByName('trip').required = true;
		photos.fields.getByName('day').required = true;
		photos.listRule = `${loggedIn} && ${member}`;
		photos.viewRule = `${loggedIn} && ${member}`;
		photos.createRule = `${loggedIn} && author = @request.auth.id && ${member} && (post = "" || post.trip = trip)`;
		photos.updateRule =
			`${loggedIn} && (author = @request.auth.id || (${member} && ${untouched}))` +
			' && (@request.body.author:isset = false || @request.body.author = author)' +
			' && (@request.body.trip:isset = false || @request.body.trip = trip)' +
			' && (@request.body.post:isset = false || @request.body.post = "" || @request.body.post.trip = trip)';
		app.save(photos);
	}
);
