/// <reference path="../pb_data/types.d.ts" />

// Väder för varje natt på ett boende (inte bara incheckningsdagen), satt av
// servern: { lat, lon, from, to, days: { "ÅÅÅÅ-MM-DD": { min, max, mean, code, precip, final } } }.
migrate(
	(app) => {
		const posts = app.findCollectionByNameOrId('posts');
		posts.fields.add(new JSONField({ name: 'stay_weather', maxSize: 20000 }));
		app.save(posts);
	},
	(app) => {
		const posts = app.findCollectionByNameOrId('posts');
		posts.fields.removeByName('stay_weather');
		app.save(posts);
	}
);
