import type { Core } from '@strapi/strapi';
import { ensureBootstrapContent } from './bootstrap/content';
import { syncContentApiReadPermissions } from './utils/public-permissions';

export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register(/* { strapi }: { strapi: Core.Strapi } */) {
    return;
  },

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    try {
      const advancedSettingsStore = await strapi.store({
        type: 'plugin',
        name: 'users-permissions',
        key: 'advanced',
      });

      const storedAdvancedSettings = await advancedSettingsStore.get();
      const advancedSettings =
        storedAdvancedSettings && typeof storedAdvancedSettings === 'object'
          ? (storedAdvancedSettings as Record<string, unknown>)
          : {};
      await advancedSettingsStore.set({
        value: {
          ...advancedSettings,
          allow_register: true,
          unique_email: true,
        },
      });
    } catch (error) {
      strapi.log.warn(
        'Nie udało się wymusić ustawień zaawansowanych users-permissions.',
        error,
      );
    }

    try {
      await ensureBootstrapContent(strapi);
      strapi.log.info('Content startowy Star Sign jest gotowy.');
    } catch (error) {
      strapi.log.error(
        'Nie udało się przygotować contentu startowego Star Sign.',
        error,
      );
    }

    try {
      await syncContentApiReadPermissions(strapi);
      strapi.log.info(
        'Publiczne uprawnienia Content API zostały zsynchronizowane.',
      );
    } catch (error) {
      strapi.log.error(
        'Nie udało się zsynchronizować publicznych uprawnień Content API.',
        error,
      );
    }
  },
};
