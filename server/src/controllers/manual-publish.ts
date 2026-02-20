import type { Core } from '@strapi/strapi';

interface UpdatePayload {
  uid: string;
  documentId: string;
  locale?: string;
  firstPublishedAt: string;
}

export default ({ strapi }: { strapi: Core.Strapi }) => ({
  ensureFeatureEnabled(ctx: any) {
    const firstPublishedAtEnabled =
      strapi.config.get('features.future.experimental_firstPublishedAt') === true;

    if (firstPublishedAtEnabled) {
      return true;
    }

    strapi.log.warn(
      '[backdate] Request blocked: features.future.experimental_firstPublishedAt is disabled.'
    );

    ctx.forbidden(
      'Manual Publish plugin is disabled. Enable features.future.experimental_firstPublishedAt=true first.'
    );

    return false;
  },

  /**
  * GET /backdate/content-types
   * Returns all content types that have draftAndPublish enabled.
   */
  async getContentTypes(ctx: any) {
    if (!this.ensureFeatureEnabled(ctx)) {
      return;
    }

    const contentTypes = strapi.contentTypes;
    const result: Array<{ uid: string; displayName: string; hasDraftAndPublish: boolean }> = [];

    for (const [uid, contentType] of Object.entries(contentTypes)) {
      // Only include api:: content types (skip admin::, plugin::, etc.)
      if (!uid.startsWith('api::')) continue;

      const hasDraftAndPublish = contentType.options?.draftAndPublish === true;

      if (hasDraftAndPublish) {
        result.push({
          uid,
          displayName: contentType.info?.displayName || uid,
          hasDraftAndPublish,
        });
      }
    }

    // Sort alphabetically by displayName
    result.sort((a, b) => a.displayName.localeCompare(b.displayName));

    ctx.body = result;
  },

  /**
  * GET /backdate/lookup
   * Look up a document by slug or documentId and return its firstPublishedAt.
   * Query params: uid, slug?, documentId?, locale?
   */
  async lookup(ctx: any) {
    if (!this.ensureFeatureEnabled(ctx)) {
      return;
    }

    const { uid, slug, documentId, locale = 'en' } = ctx.query;

    if (!uid) {
      return ctx.badRequest('Missing required query parameter: uid');
    }

    if (!slug && !documentId) {
      return ctx.badRequest('Either slug or documentId is required');
    }

    const contentType = strapi.contentTypes[uid as string];
    if (!contentType) {
      return ctx.badRequest(`Content type not found: ${uid}`);
    }

    try {
      const tableName = contentType.collectionName;
      const knex = strapi.db.connection;
      let entry: any = null;

      if (documentId) {
        // Look up by documentId
        const entries = await knex(tableName)
          .where('document_id', documentId)
          .orderBy('published_at', 'desc')
          .limit(1)
          .select('document_id', 'first_published_at', 'published_at', 'slug');
        entry = entries[0] || null;
      } else if (slug) {
        // Look up by slug
        const hasSlug = contentType.attributes?.slug;
        if (!hasSlug) {
          return ctx.badRequest(`Content type ${uid} does not have a slug attribute`);
        }

        const query = knex(tableName).where('slug', slug);

        const entries = await query
          .orderBy('published_at', 'desc')
          .limit(1)
          .select('document_id', 'first_published_at', 'published_at', 'slug');
        entry = entries[0] || null;
      }

      if (!entry) {
        return ctx.notFound('No entry found');
      }

      ctx.body = {
        documentId: entry.document_id,
        firstPublishedAt: entry.first_published_at || null,
        publishedAt: entry.published_at || null,
        slug: entry.slug || null,
      };
    } catch (error: any) {
      strapi.log.error('[backdate] Lookup error:', error);
      return ctx.badRequest(error.message);
    }
  },

  /**
  * PUT /backdate/update
   * Update the firstPublishedAt field for a specific document.
   * Body: { uid, documentId, locale?, firstPublishedAt }
   */
  async updateFirstPublishedAt(ctx: any) {
    if (!this.ensureFeatureEnabled(ctx)) {
      return;
    }

    const { uid, documentId, locale = 'en', firstPublishedAt } = ctx.request.body as UpdatePayload;

    if (!uid || !documentId || !firstPublishedAt) {
      return ctx.badRequest('Missing required fields: uid, documentId, firstPublishedAt');
    }

    const contentType = strapi.contentTypes[uid as string];
    if (!contentType) {
      return ctx.badRequest(`Content type not found: ${uid}`);
    }

    if (!contentType.options?.draftAndPublish) {
      return ctx.badRequest(`Content type ${uid} does not have Draft & Publish enabled`);
    }

    // Validate the date
    const dateValue = new Date(firstPublishedAt);
    if (isNaN(dateValue.getTime())) {
      return ctx.badRequest('Invalid date format for firstPublishedAt');
    }

    try {
      // Use raw Knex query to bypass Strapi's Document Service filter
      // (filterDataFirstPublishedAt) which strips firstPublishedAt from data.
      const tableName = contentType.collectionName;
      const knex = strapi.db.connection;

      const rowsAffected = await knex(tableName)
        .where('document_id', documentId)
        .update('first_published_at', dateValue.toISOString());

      strapi.log.info(
        `[backdate] Updated first_published_at for ${uid}:${documentId} ` +
          `to ${dateValue.toISOString()} (${rowsAffected} rows affected in table ${tableName})`
      );

      // Verify the update
      const verifyRows = await knex(tableName)
        .where('document_id', documentId)
        .select('id', 'document_id', 'first_published_at', 'published_at');

      strapi.log.info(
        `[backdate] Verification: ${JSON.stringify(verifyRows)}`
      );

      ctx.body = {
        success: true,
        documentId,
        firstPublishedAt: dateValue.toISOString(),
        rowsAffected,
        verification: verifyRows,
      };
    } catch (error: any) {
      strapi.log.error('[backdate] Update error:', error);
      return ctx.badRequest(error.message);
    }
  },
});
