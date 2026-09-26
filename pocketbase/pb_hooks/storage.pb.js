/// <reference path="../pb_data/types.d.ts" />

// Fillagring och backup mot S3 (Garage på Synology), styrt av .env.
//
// Vid varje start skrivs S3-inställningarna från miljövariablerna in i
// PocketBase, så att .env är den enda platsen de bestäms. Saknas variablerna
// lämnas inställningarna orörda (och kan då ändras i admin-gränssnittet).
//
//   S3_ENDPOINT, S3_REGION                  gemensamt för båda
//   S3_MEDIA_BUCKET, _ACCESS_KEY, _SECRET   bilder och andra filer
//   S3_BACKUP_BUCKET, _ACCESS_KEY, _SECRET  schemalagd backup av databasen
//   BACKUP_CRON, BACKUP_MAX_KEEP            när och hur många som sparas
onBootstrap((e) => {
	e.next();

	const env = (name) => ($os.getenv(name) || '').trim();
	const endpoint = env('S3_ENDPOINT');
	if (!endpoint) return;

	/** S3-inställning för ett ändamål, eller null om något saknas. */
	const s3 = (prefix) => {
		const config = {
			enabled: true,
			endpoint,
			region: env('S3_REGION') || 'garage',
			bucket: env(`${prefix}_BUCKET`),
			accessKey: env(`${prefix}_ACCESS_KEY`),
			secret: env(`${prefix}_SECRET`),
			forcePathStyle: true // Garage kräver path-style
		};
		if (!config.bucket) return null;
		if (!config.accessKey || !config.secret) {
			e.app.logger().warn(`${prefix}: bucket angiven men nyckel eller secret saknas, hoppar över`);
			return null;
		}
		return config;
	};

	const settings = e.app.settings();
	const media = s3('S3_MEDIA');
	const backup = s3('S3_BACKUP');

	if (media) Object.assign(settings.s3, media);
	if (backup) {
		Object.assign(settings.backups.s3, backup);
		settings.backups.cron = env('BACKUP_CRON') || '0 3 * * *';
		settings.backups.cronMaxKeep = parseInt(env('BACKUP_MAX_KEEP'), 10) || 14;
	}
	if (!media && !backup) return;

	e.app.save(settings);
	e.app.logger().info(
		'S3 från .env',
		'media',
		media ? media.bucket : '(oförändrat)',
		'backup',
		backup ? `${backup.bucket} ${settings.backups.cron}` : '(oförändrat)'
	);
});
