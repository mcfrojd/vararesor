import { error } from '@sveltejs/kit';
import { pb, type Photo, type Post, type Trip } from '$lib/pb';

export async function load({ params }) {
	try {
		const [trip, post, dayPhotos] = await Promise.all([
			pb.collection('trips').getOne<Trip>(params.id),
			pb.collection('posts').getOne<Post>(params.postId, { expand: 'author,photos_via_post' }),
			// Dagens bilder, att lägga till i inlägget. Samma anrop som resans sida (offline-cachen).
			pb.collection('photos').getFullList<Photo>({
				filter: pb.filter('trip = {:trip} && post = ""', { trip: params.id }),
				sort: 'day,taken'
			})
		]);
		if (post.trip !== trip.id) throw new Error('fel resa');
		return { trip, post, dayPhotos };
	} catch {
		error(404, 'Inlägget finns inte, eller så har du inte tillgång till det.');
	}
}
