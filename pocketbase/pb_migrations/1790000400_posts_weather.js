/// <reference path="../pb_data/types.d.ts" />

// Väder för inläggets dag och plats (fylls av pb_hooks/weather.pb.js).
migrate(
	(app) => {
		const posts = app.findCollectionByNameOrId('posts');
		posts.fields.add(new JSONField({ name: 'weather', maxSize: 2000 }));
		app.save(posts);
	},
	(app) => {
		const posts = app.findCollectionByNameOrId('posts');
		posts.fields.removeByName('weather');
		app.save(posts);
	}
);
