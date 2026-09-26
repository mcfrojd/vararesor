/// <reference path="../pb_data/types.d.ts" />

// Alla på resan får lägga dagens bilder i ett inlägg, även bilder som någon
// annan tagit. Den som inte laddat upp bilden får bara ändra `post`, inget annat.
migrate(
	(app) => {
		const photos = app.findCollectionByNameOrId('photos');
		const member = '(trip.owner = @request.auth.id || trip.participants.id ?= @request.auth.id)';
		const loggedIn = '@request.auth.id != ""';
		const untouched = ['day', 'taken', 'taken_at', 'location', 'location_source', 'width', 'height', 'original', 'web', 'thumb']
			.map((f) => `@request.body.${f}:isset = false`)
			.join(' && ');
		photos.updateRule =
			`${loggedIn} && (author = @request.auth.id || (${member} && ${untouched}))` +
			' && (@request.body.author:isset = false || @request.body.author = author)' +
			' && (@request.body.trip:isset = false || @request.body.trip = trip)' +
			' && (@request.body.post:isset = false || @request.body.post = "" || @request.body.post.trip = trip)';
		app.save(photos);
	},
	(app) => {
		const photos = app.findCollectionByNameOrId('photos');
		const loggedIn = '@request.auth.id != ""';
		photos.updateRule =
			`${loggedIn} && author = @request.auth.id` +
			' && (@request.body.author:isset = false || @request.body.author = @request.auth.id)' +
			' && (@request.body.trip:isset = false || @request.body.trip = trip)' +
			' && (@request.body.post:isset = false || @request.body.post = "" || @request.body.post.trip = trip)';
		app.save(photos);
	}
);
