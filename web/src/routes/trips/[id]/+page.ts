import { error } from '@sveltejs/kit';
import { pb, type Post, type Trip } from '$lib/pb';
import { sortPosts } from '$lib/posts';

export async function load({ params }) {
	try {
		const [trip, posts] = await Promise.all([
			pb.collection('trips').getOne<Trip>(params.id, { expand: 'owner,participants' }),
			pb.collection('posts').getFullList<Post>({
				filter: pb.filter('trip = {:trip}', { trip: params.id }),
				sort: 'day,created',
				expand: 'author'
			})
		]);
		return { trip, posts: sortPosts(posts) };
	} catch {
		error(404, 'Resan finns inte, eller så har du inte tillgång till den.');
	}
}
