/// <reference path="../pb_data/types.d.ts" />

// Ny källa för bildens position: 'immich' = från originalet i Immich på NAS:en
// (samma bild, hittad på exakt tidpunkt). Går före Doris spår.
migrate(
	(app) => {
		const photos = app.findCollectionByNameOrId('photos');
		photos.fields.getByName('location_source').values = ['exif', 'track', 'immich'];
		app.save(photos);
	},
	(app) => {
		const photos = app.findCollectionByNameOrId('photos');
		photos.fields.getByName('location_source').values = ['exif', 'track'];
		app.save(photos);
	}
);
