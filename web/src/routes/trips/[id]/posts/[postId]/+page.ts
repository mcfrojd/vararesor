import { error } from '@sveltejs/kit';
import { pb, type Post, type Trip } from '$lib/pb';

export async function load({ params }) {
	try {
		const [trip, post] = await Promise.all([
			pb.collection('trips').getOne<Trip>(params.id),
			pb.collection('posts').getOne<Post>(params.postId, { expand: 'author' })
		]);
		if (post.trip !== trip.id) throw new Error('fel resa');
		return { trip, post };
	} catch {
		error(404, 'Inlägget finns inte, eller så har du inte tillgång till det.');
	}
}
