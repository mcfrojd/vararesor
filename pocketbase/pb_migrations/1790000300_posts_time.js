/// <reference path="../pb_data/types.d.ts" />

// Valfri tid (TT:MM) på inlägg, för rätt ordning inom en dag.
migrate(
	(app) => {
		const posts = app.findCollectionByNameOrId('posts');
		posts.fields.add(new TextField({ name: 'time', max: 5, pattern: '^([01][0-9]|2[0-3]):[0-5][0-9]$' }));
		app.save(posts);
	},
	(app) => {
		const posts = app.findCollectionByNameOrId('posts');
		posts.fields.removeByName('time');
		app.save(posts);
	}
);
