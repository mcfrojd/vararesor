import { error } from '@sveltejs/kit';
import { pb, type Photo, type Post, type Trip } from '$lib/pb';
import { sortPosts } from '$lib/posts';

export async function load({ params }) {
	try {
		const [trip, posts, photos] = await Promise.all([
			pb.collection('trips').getOne<Trip>(params.id),
			pb.collection('posts').getFullList<Post>({
				filter: pb.filter('trip = {:trip}', { trip: params.id }),
				sort: 'day,created'
			}),
			// Bara det som behövs för att känna igen bilder som redan finns.
			pb.collection('photos').getFullList<Pick<Photo, 'id' | 'taken_at' | 'width' | 'height'>>({
				filter: pb.filter('trip = {:trip}', { trip: params.id }),
				fields: 'id,taken_at,width,height'
			})
		]);
		return { trip, posts: sortPosts(posts), photos };
	} catch {
		error(404, 'Resan finns inte, eller så har du inte tillgång till den.');
	}
}
