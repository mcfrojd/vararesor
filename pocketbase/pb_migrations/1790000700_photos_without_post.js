/// <reference path="../pb_data/types.d.ts" />

// Bilder kan höra till en dag utan att höra till ett inlägg ("dagens bilder"),
// t.ex. när många bilder laddas upp på en gång och inte passar något inlägg.
// En bild kan också flyttas mellan inlägg och dagen, men bara inom resan.
migrate(
	(app) => {
		const photos = app.findCollectionByNameOrId('photos');
		const member = '(trip.owner = @request.auth.id || trip.participants.id ?= @request.auth.id)';
		const loggedIn = '@request.auth.id != ""';
		photos.fields.getByName('post').required = false;
		photos.createRule = `${loggedIn} && author = @request.auth.id && ${member} && (post = "" || post.trip = trip)`;
		photos.updateRule =
			`${loggedIn} && author = @request.auth.id` +
			' && (@request.body.author:isset = false || @request.body.author = @request.auth.id)' +
			' && (@request.body.trip:isset = false || @request.body.trip = trip)' +
			' && (@request.body.post:isset = false || @request.body.post = "" || @request.body.post.trip = trip)';
		app.save(photos);
	},
	(app) => {
		const photos = app.findCollectionByNameOrId('photos');
		const member = '(trip.owner = @request.auth.id || trip.participants.id ?= @request.auth.id)';
		const loggedIn = '@request.auth.id != ""';
		photos.fields.getByName('post').required = true;
		photos.createRule = `${loggedIn} && author = @request.auth.id && ${member} && post.trip = trip`;
		photos.updateRule =
			`${loggedIn} && author = @request.auth.id` +
			' && (@request.body.author:isset = false || @request.body.author = @request.auth.id)' +
			' && (@request.body.trip:isset = false || @request.body.trip = trip)' +
			' && (@request.body.post:isset = false || @request.body.post = post)';
		app.save(photos);
	}
);
