import { error } from '@sveltejs/kit';
import { pb, type Photo, type Post, type Trip } from '$lib/pb';
import { sortPosts } from '$lib/posts';

export async function load({ params }) {
	try {
		const [trip, posts, dayPhotos] = await Promise.all([
			pb.collection('trips').getOne<Trip>(params.id, { expand: 'owner,participants' }),
			pb.collection('posts').getFullList<Post>({
				filter: pb.filter('trip = {:trip}', { trip: params.id }),
				sort: 'day,created',
				expand: 'author,photos_via_post'
			}),
			// Bilder som bara hör till en dag, inte ett inlägg.
			pb.collection('photos').getFullList<Photo>({
				filter: pb.filter('trip = {:trip} && post = ""', { trip: params.id }),
				sort: 'day,taken'
			})
		]);
		return { trip, posts: sortPosts(posts), dayPhotos };
	} catch {
		error(404, 'Resan finns inte, eller så har du inte tillgång till den.');
	}
}
