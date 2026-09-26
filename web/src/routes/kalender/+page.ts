import { pb, type Post, type Trip } from '$lib/pb';
import { sortPosts } from '$lib/posts';

export async function load() {
	const [trips, posts] = await Promise.all([
		pb.collection('trips').getFullList<Trip>({ sort: 'start_date' }),
		pb.collection('posts').getFullList<Post>({ sort: 'day,created', expand: 'author,photos_via_post' })
	]);
	return { trips, posts: sortPosts(posts) };
}
