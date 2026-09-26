/// <reference path="../pb_data/types.d.ts" />

// Positioner från Doris GPS-spår (se pb_hooks/tracks.js).
//   photos.taken_at         exakt tidpunkt (UTC) när bilden togs, från EXIF
//   photos.location_source  'exif' = från bilden, 'track' = från Doris spår
//   posts.location_source   'manual' = satt/ändrad av oss (rörs aldrig av servern),
//                           'photo' = föreslagen från en bild, 'track' = från Doris spår
migrate(
	(app) => {
		const photos = app.findCollectionByNameOrId('photos');
		photos.fields.add(new DateField({ name: 'taken_at' }));
		photos.fields.add(new SelectField({ name: 'location_source', maxSelect: 1, values: ['exif', 'track'] }));
		app.save(photos);

		const posts = app.findCollectionByNameOrId('posts');
		posts.fields.add(new SelectField({ name: 'location_source', maxSelect: 1, values: ['manual', 'photo', 'track'] }));
		app.save(posts);
	},
	(app) => {
		const photos = app.findCollectionByNameOrId('photos');
		photos.fields.removeByName('taken_at');
		photos.fields.removeByName('location_source');
		app.save(photos);
		const posts = app.findCollectionByNameOrId('posts');
		posts.fields.removeByName('location_source');
		app.save(posts);
	}
);
