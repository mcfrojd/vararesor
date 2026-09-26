import { pb, type Trip } from '$lib/pb';

/** Siffror till profilsidan. Utan nät (och inget i cachen) visas sidan utan dem. */
export async function load() {
	const me = pb.authStore.record?.id;
	if (!me) return { stats: null };
	const count = async (collection: string, filter: string) =>
		(await pb.collection(collection).getList(1, 1, { filter, fields: 'id', requestKey: null })).totalItems;
	try {
		const [photos, posts, overnights, trips] = await Promise.all([
			count('photos', pb.filter('author = {:me}', { me })),
			count('posts', pb.filter('author = {:me}', { me })),
			// Alla övernattningar på resorna man är med i, oavsett vem som skrev dem.
			count('posts', 'kind = "overnight"'),
			pb.collection('trips').getFullList<Pick<Trip, 'id' | 'owner' | 'type' | 'start_date' | 'end_date'>>({
				fields: 'id,owner,type,start_date,end_date'
			})
		]);
		return { stats: { photos, posts, overnights, trips, me } };
	} catch {
		return { stats: null };
	}
}
