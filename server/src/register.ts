import type { Core } from '@strapi/strapi';

export default ({ strapi }: { strapi: Core.Strapi }) => {
  const firstPublishedAtEnabled =
    strapi.config.get('features.future.experimental_firstPublishedAt') === true;

  if (!firstPublishedAtEnabled) {
    strapi.log.warn(
      '[backdate] Plugin disabled: enable features.future.experimental_firstPublishedAt=true to use this plugin.'
    );

    return;
  }

  /**
   * Document Service Middleware:
   * Intercept publish actions to preserve manual firstPublishedAt values.
   *
   * When an entry is published and already has a firstPublishedAt set via
   * our plugin, we ensure the system doesn't overwrite it with `new Date()`.
   */
  strapi.documents.use(async (ctx, next) => {
    // We only care about publish actions
    if (ctx.action !== 'publish') {
      return next();
    }

    const { uid } = ctx;
    const params = ctx.params as Record<string, any>;
    const documentId = params?.documentId;

    if (!documentId) {
      return next();
    }

    // Check if this content type has draftAndPublish
    const contentType = strapi.contentTypes[uid];
    if (!contentType || !contentType.options?.draftAndPublish) {
      return next();
    }

    // Check if there's an existing firstPublishedAt in the database
    // If someone set it via our plugin, we want to preserve it
    try {
      const contentType = strapi.contentTypes[uid];
      const tableName = contentType.collectionName;
      const knex = strapi.db.connection;

      const existingEntries = await knex(tableName)
        .where('document_id', documentId)
        .whereNotNull('published_at')
        .whereNotNull('first_published_at')
        .limit(1)
        .select('first_published_at');

      if (existingEntries.length > 0 && existingEntries[0].first_published_at) {
        // Store the manual value so we can restore it after publish
        const manualDate = existingEntries[0].first_published_at;

        const result = await next();

        // After publish, restore the manual firstPublishedAt
        await knex(tableName)
          .where('document_id', documentId)
          .update('first_published_at', manualDate);

        return result;
      }
    } catch (error) {
      strapi.log.warn(
        `[backdate] Could not check firstPublishedAt for ${uid}:${documentId}`,
        error
      );
    }

    return next();
  });
};
