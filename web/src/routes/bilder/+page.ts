import { pb, type Photo, type Trip } from '$lib/pb';

/** Det som behövs för albumen: antal och en miniatyr per resa. */
export type PhotoSummary = Pick<Photo, 'id' | 'collectionId' | 'collectionName' | 'trip' | 'thumb' | 'web' | 'taken' | 'created'>;

export async function load() {
	const [trips, photos] = await Promise.all([
		pb.collection('trips').getFullList<Trip>({ sort: '-start_date' }),
		pb.collection('photos').getFullList<PhotoSummary>({
			fields: 'id,collectionId,collectionName,trip,thumb,web,taken,created',
			sort: 'taken,created'
		})
	]);
	return { trips, photos };
}
