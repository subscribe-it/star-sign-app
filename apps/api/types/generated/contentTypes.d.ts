import type { Schema, Struct } from '@strapi/strapi';

export interface AdminApiToken extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_api_tokens';
  info: {
    description: '';
    displayName: 'Api Token';
    name: 'Api Token';
    pluralName: 'api-tokens';
    singularName: 'api-token';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    accessKey: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }> &
      Schema.Attribute.DefaultTo<''>;
    encryptedKey: Schema.Attribute.Text &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    expiresAt: Schema.Attribute.DateTime;
    lastUsedAt: Schema.Attribute.DateTime;
    lifespan: Schema.Attribute.BigInteger;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'admin::api-token'> &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    permissions: Schema.Attribute.Relation<
      'oneToMany',
      'admin::api-token-permission'
    >;
    publishedAt: Schema.Attribute.DateTime;
    type: Schema.Attribute.Enumeration<['read-only', 'full-access', 'custom']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'read-only'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface AdminApiTokenPermission extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_api_token_permissions';
  info: {
    description: '';
    displayName: 'API Token Permission';
    name: 'API Token Permission';
    pluralName: 'api-token-permissions';
    singularName: 'api-token-permission';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    action: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'admin::api-token-permission'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    token: Schema.Attribute.Relation<'manyToOne', 'admin::api-token'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface AdminPermission extends Struct.CollectionTypeSchema {
  collectionName: 'admin_permissions';
  info: {
    description: '';
    displayName: 'Permission';
    name: 'Permission';
    pluralName: 'permissions';
    singularName: 'permission';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    action: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    actionParameters: Schema.Attribute.JSON & Schema.Attribute.DefaultTo<{}>;
    conditions: Schema.Attribute.JSON & Schema.Attribute.DefaultTo<[]>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'admin::permission'> &
      Schema.Attribute.Private;
    properties: Schema.Attribute.JSON & Schema.Attribute.DefaultTo<{}>;
    publishedAt: Schema.Attribute.DateTime;
    role: Schema.Attribute.Relation<'manyToOne', 'admin::role'>;
    subject: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface AdminRole extends Struct.CollectionTypeSchema {
  collectionName: 'admin_roles';
  info: {
    description: '';
    displayName: 'Role';
    name: 'Role';
    pluralName: 'roles';
    singularName: 'role';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    code: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.String;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'admin::role'> &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    permissions: Schema.Attribute.Relation<'oneToMany', 'admin::permission'>;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    users: Schema.Attribute.Relation<'manyToMany', 'admin::user'>;
  };
}

export interface AdminSession extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_sessions';
  info: {
    description: 'Session Manager storage';
    displayName: 'Session';
    name: 'Session';
    pluralName: 'sessions';
    singularName: 'session';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
    i18n: {
      localized: false;
    };
  };
  attributes: {
    absoluteExpiresAt: Schema.Attribute.DateTime & Schema.Attribute.Private;
    childId: Schema.Attribute.String & Schema.Attribute.Private;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    deviceId: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private;
    expiresAt: Schema.Attribute.DateTime &
      Schema.Attribute.Required &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'admin::session'> &
      Schema.Attribute.Private;
    origin: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    sessionId: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private &
      Schema.Attribute.Unique;
    status: Schema.Attribute.String & Schema.Attribute.Private;
    type: Schema.Attribute.String & Schema.Attribute.Private;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    userId: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private;
  };
}

export interface AdminTransferToken extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_transfer_tokens';
  info: {
    description: '';
    displayName: 'Transfer Token';
    name: 'Transfer Token';
    pluralName: 'transfer-tokens';
    singularName: 'transfer-token';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    accessKey: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }> &
      Schema.Attribute.DefaultTo<''>;
    expiresAt: Schema.Attribute.DateTime;
    lastUsedAt: Schema.Attribute.DateTime;
    lifespan: Schema.Attribute.BigInteger;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'admin::transfer-token'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    permissions: Schema.Attribute.Relation<
      'oneToMany',
      'admin::transfer-token-permission'
    >;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface AdminTransferTokenPermission
  extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_transfer_token_permissions';
  info: {
    description: '';
    displayName: 'Transfer Token Permission';
    name: 'Transfer Token Permission';
    pluralName: 'transfer-token-permissions';
    singularName: 'transfer-token-permission';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    action: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'admin::transfer-token-permission'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    token: Schema.Attribute.Relation<'manyToOne', 'admin::transfer-token'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface AdminUser extends Struct.CollectionTypeSchema {
  collectionName: 'admin_users';
  info: {
    description: '';
    displayName: 'User';
    name: 'User';
    pluralName: 'users';
    singularName: 'user';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    blocked: Schema.Attribute.Boolean &
      Schema.Attribute.Private &
      Schema.Attribute.DefaultTo<false>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    email: Schema.Attribute.Email &
      Schema.Attribute.Required &
      Schema.Attribute.Private &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 6;
      }>;
    firstname: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    isActive: Schema.Attribute.Boolean &
      Schema.Attribute.Private &
      Schema.Attribute.DefaultTo<false>;
    lastname: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'admin::user'> &
      Schema.Attribute.Private;
    password: Schema.Attribute.Password &
      Schema.Attribute.Private &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 6;
      }>;
    preferedLanguage: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    registrationToken: Schema.Attribute.String & Schema.Attribute.Private;
    resetPasswordToken: Schema.Attribute.String & Schema.Attribute.Private;
    roles: Schema.Attribute.Relation<'manyToMany', 'admin::role'> &
      Schema.Attribute.Private;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    username: Schema.Attribute.String;
  };
}

export interface ApiAnalyticsEventAnalyticsEvent
  extends Struct.CollectionTypeSchema {
  collectionName: 'analytics_events';
  info: {
    description: 'First-party product analytics event log.';
    displayName: 'Analytics Event';
    pluralName: 'analytics-events';
    singularName: 'analytics-event';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    access_state: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 80;
      }>;
    auth_state: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 40;
      }>;
    browser_family: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 40;
      }>;
    content_id: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 120;
      }>;
    content_slug: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 180;
      }>;
    content_type: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 80;
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    cta_location: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 120;
      }>;
    currency: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 12;
      }>;
    device_category: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 40;
      }>;
    event_day: Schema.Attribute.Date;
    event_type: Schema.Attribute.Enumeration<
      [
        'daily_horoscope_view',
        'premium_content_impression',
        'premium_content_view',
        'premium_cta_click',
        'premium_pricing_view',
        'begin_checkout',
        'checkout_redirect',
        'purchase',
        'premium_subscription_conversion',
        'view_item',
        'select_item',
      ]
    > &
      Schema.Attribute.Required;
    funnel_step: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 80;
      }>;
    horoscope_period: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 80;
      }>;
    is_unique_daily: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<true>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::analytics-event.analytics-event'
    > &
      Schema.Attribute.Private;
    metadata: Schema.Attribute.JSON;
    occurred_at: Schema.Attribute.DateTime & Schema.Attribute.Required;
    plan: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 80;
      }>;
    premium_access_policy: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 80;
      }>;
    premium_mode: Schema.Attribute.Enumeration<['open', 'paid']>;
    publishedAt: Schema.Attribute.DateTime;
    referrer: Schema.Attribute.Text;
    route: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 300;
      }>;
    session_id: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 128;
      }>;
    sign_slug: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 80;
      }>;
    subscription_plan: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 80;
      }>;
    subscription_status: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 40;
      }>;
    ui_surface: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 120;
      }>;
    unique_key: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 400;
      }>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    user: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    utm_campaign: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 180;
      }>;
    utm_medium: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 120;
      }>;
    utm_source: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 120;
      }>;
    value: Schema.Attribute.Decimal;
    visitor_id: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 128;
      }>;
    visitor_segment: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 40;
      }>;
  };
}

export interface ApiAppSettingAppSetting extends Struct.SingleTypeSchema {
  collectionName: 'app_settings';
  info: {
    description: 'Production feature and billing settings managed from Strapi.';
    displayName: 'App Settings';
    pluralName: 'app-settings';
    singularName: 'app-setting';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    allow_promotion_codes: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<true>;
    annual_price: Schema.Attribute.Decimal & Schema.Attribute.DefaultTo<199>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    currency: Schema.Attribute.Enumeration<['PLN', 'EUR', 'USD']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'PLN'>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::app-setting.app-setting'
    > &
      Schema.Attribute.Private;
    maintenance_allowed_paths: Schema.Attribute.JSON &
      Schema.Attribute.DefaultTo<
        [
          '/regulamin',
          '/polityka-prywatnosci',
          '/cookies',
          '/disclaimer',
          '/newsletter/potwierdz',
          '/newsletter/wypisz',
        ]
      >;
    maintenance_contact_url: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 300;
      }>;
    maintenance_eta: Schema.Attribute.DateTime;
    maintenance_message: Schema.Attribute.Text &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 500;
      }>;
    maintenance_mode_enabled: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<false>;
    maintenance_title: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 120;
      }>;
    monthly_price: Schema.Attribute.Decimal & Schema.Attribute.DefaultTo<24.99>;
    premium_mode: Schema.Attribute.Enumeration<['open', 'paid']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'open'>;
    publishedAt: Schema.Attribute.DateTime;
    stripe_annual_price_id: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 120;
      }>;
    stripe_checkout_enabled: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<false>;
    stripe_monthly_price_id: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 120;
      }>;
    trial_days: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          max: 90;
          min: 0;
        },
        number
      > &
      Schema.Attribute.DefaultTo<7>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiArticleArticle extends Struct.CollectionTypeSchema {
  collectionName: 'articles';
  info: {
    displayName: 'Article';
    pluralName: 'articles';
    singularName: 'article';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    author: Schema.Attribute.String;
    category: Schema.Attribute.Relation<'manyToOne', 'api::category.category'>;
    content: Schema.Attribute.RichText & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    excerpt: Schema.Attribute.Text;
    image: Schema.Attribute.Media<'images'>;
    isPremium: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::article.article'
    > &
      Schema.Attribute.Private;
    premiumContent: Schema.Attribute.RichText;
    publishedAt: Schema.Attribute.DateTime;
    read_time_minutes: Schema.Attribute.Integer;
    seo: Schema.Attribute.Component<'shared.seo', false>;
    slug: Schema.Attribute.UID<'title'> & Schema.Attribute.Required;
    title: Schema.Attribute.String & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiCategoryCategory extends Struct.CollectionTypeSchema {
  collectionName: 'categories';
  info: {
    displayName: 'Category';
    pluralName: 'categories';
    singularName: 'category';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    articles: Schema.Attribute.Relation<'oneToMany', 'api::article.article'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::category.category'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    publishedAt: Schema.Attribute.DateTime;
    slug: Schema.Attribute.UID<'name'> & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiDailyTarotDrawDailyTarotDraw
  extends Struct.CollectionTypeSchema {
  collectionName: 'daily_tarot_draws';
  info: {
    displayName: 'Daily Tarot Draw';
    pluralName: 'daily-tarot-draws';
    singularName: 'daily-tarot-draw';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    card: Schema.Attribute.Relation<'manyToOne', 'api::tarot-card.tarot-card'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    draw_date: Schema.Attribute.Date &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::daily-tarot-draw.daily-tarot-draw'
    > &
      Schema.Attribute.Private;
    message: Schema.Attribute.Text;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiHoroscopeHoroscope extends Struct.CollectionTypeSchema {
  collectionName: 'horoscopes';
  info: {
    displayName: 'Horoscope';
    pluralName: 'horoscopes';
    singularName: 'horoscope';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    content: Schema.Attribute.Text & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    date: Schema.Attribute.Date & Schema.Attribute.Required;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::horoscope.horoscope'
    > &
      Schema.Attribute.Private;
    period: Schema.Attribute.Enumeration<
      ['Dzienny', 'Tygodniowy', 'Miesi\u0119czny', 'Roczny']
    >;
    premiumContent: Schema.Attribute.Text;
    publishedAt: Schema.Attribute.DateTime;
    seo: Schema.Attribute.Component<'shared.seo', false>;
    type: Schema.Attribute.Enumeration<
      [
        'Og\u00F3lny',
        'Mi\u0142osny',
        'Zawodowy',
        'Finansowy',
        'Chi\u0144ski',
        'Celtycki',
        'Egipski',
      ]
    >;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    zodiac_sign: Schema.Attribute.Relation<
      'manyToOne',
      'api::zodiac-sign.zodiac-sign'
    >;
  };
}

export interface ApiNewsletterSubscriptionNewsletterSubscription
  extends Struct.CollectionTypeSchema {
  collectionName: 'newsletter_subscriptions';
  info: {
    displayName: 'Newsletter Subscription';
    pluralName: 'newsletter-subscriptions';
    singularName: 'newsletter-subscription';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    bounce_reason: Schema.Attribute.Text;
    brevo_contact_id: Schema.Attribute.String;
    confirmation_token: Schema.Attribute.String & Schema.Attribute.Private;
    confirmed_at: Schema.Attribute.DateTime;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    email: Schema.Attribute.Email &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    last_event_at: Schema.Attribute.DateTime;
    last_event_type: Schema.Attribute.String;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::newsletter-subscription.newsletter-subscription'
    > &
      Schema.Attribute.Private;
    marketing_consent: Schema.Attribute.Boolean & Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    source: Schema.Attribute.String;
    status: Schema.Attribute.Enumeration<
      ['pending', 'active', 'unsubscribed', 'bounced', 'complained']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'pending'>;
    subscribed_at: Schema.Attribute.DateTime;
    unsubscribe_token: Schema.Attribute.String & Schema.Attribute.Private;
    unsubscribed_at: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiNumerologyProfileNumerologyProfile
  extends Struct.CollectionTypeSchema {
  collectionName: 'numerology_profiles';
  info: {
    displayName: 'Numerology Profile';
    pluralName: 'numerology-profiles';
    singularName: 'numerology-profile';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.Text & Schema.Attribute.Required;
    extended_description: Schema.Attribute.RichText;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::numerology-profile.numerology-profile'
    > &
      Schema.Attribute.Private;
    number: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    publishedAt: Schema.Attribute.DateTime;
    seo: Schema.Attribute.Component<'shared.seo', false>;
    title: Schema.Attribute.String & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiOrderItemOrderItem extends Struct.CollectionTypeSchema {
  collectionName: 'order_items';
  info: {
    displayName: 'Order Item';
    pluralName: 'order-items';
    singularName: 'order-item';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    line_total: Schema.Attribute.Decimal & Schema.Attribute.Required;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::order-item.order-item'
    > &
      Schema.Attribute.Private;
    order: Schema.Attribute.Relation<'manyToOne', 'api::order.order'> &
      Schema.Attribute.Required;
    product: Schema.Attribute.Relation<'manyToOne', 'api::product.product'>;
    product_document_id: Schema.Attribute.String & Schema.Attribute.Required;
    product_name: Schema.Attribute.String & Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    quantity: Schema.Attribute.Integer & Schema.Attribute.Required;
    unit_price: Schema.Attribute.Decimal & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiOrderOrder extends Struct.CollectionTypeSchema {
  collectionName: 'orders';
  info: {
    displayName: 'Order';
    pluralName: 'orders';
    singularName: 'order';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    currency: Schema.Attribute.Enumeration<['pln', 'eur', 'usd']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'pln'>;
    customer_email: Schema.Attribute.Email;
    items: Schema.Attribute.Relation<'oneToMany', 'api::order-item.order-item'>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'api::order.order'> &
      Schema.Attribute.Private;
    paid_at: Schema.Attribute.DateTime;
    payment_provider: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'stripe'>;
    publishedAt: Schema.Attribute.DateTime;
    status: Schema.Attribute.Enumeration<
      ['pending', 'paid', 'cancelled', 'failed']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'pending'>;
    stripe_payment_intent_id: Schema.Attribute.String;
    stripe_session_id: Schema.Attribute.String & Schema.Attribute.Unique;
    total_amount: Schema.Attribute.Decimal & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiProductProduct extends Struct.CollectionTypeSchema {
  collectionName: 'products';
  info: {
    description: 'Products for the shop';
    displayName: 'Product';
    pluralName: 'products';
    singularName: 'product';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    category: Schema.Attribute.String & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    currency: Schema.Attribute.Enumeration<['PLN', 'EUR', 'USD']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'PLN'>;
    description: Schema.Attribute.Text;
    image: Schema.Attribute.Media<'images'>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::product.product'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    price: Schema.Attribute.Decimal & Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    sku: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    slug: Schema.Attribute.UID<'name'> & Schema.Attribute.Required;
    stock_status: Schema.Attribute.Enumeration<
      ['in_stock', 'out_of_stock', 'preorder']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'in_stock'>;
    symbol: Schema.Attribute.String;
    tag: Schema.Attribute.String;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiTarotCardTarotCard extends Struct.CollectionTypeSchema {
  collectionName: 'tarot_cards';
  info: {
    displayName: 'Tarot Card';
    pluralName: 'tarot-cards';
    singularName: 'tarot-card';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    arcana: Schema.Attribute.String;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.Text;
    image: Schema.Attribute.Media<'images'>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::tarot-card.tarot-card'
    > &
      Schema.Attribute.Private;
    meaning_reversed: Schema.Attribute.Text;
    meaning_upright: Schema.Attribute.Text;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    publishedAt: Schema.Attribute.DateTime;
    slug: Schema.Attribute.UID<'name'> & Schema.Attribute.Required;
    symbol: Schema.Attribute.String;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiUserProfileUserProfile extends Struct.CollectionTypeSchema {
  collectionName: 'user_profiles';
  info: {
    displayName: 'User Profile';
    pluralName: 'user-profiles';
    singularName: 'user-profile';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    birth_date: Schema.Attribute.Date;
    birth_place: Schema.Attribute.String;
    birth_time: Schema.Attribute.Time;
    cancel_at_period_end: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<false>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    current_period_end: Schema.Attribute.DateTime;
    last_synced_at: Schema.Attribute.DateTime;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::user-profile.user-profile'
    > &
      Schema.Attribute.Private;
    marketing_consent: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<false>;
    publishedAt: Schema.Attribute.DateTime;
    stripe_customer_id: Schema.Attribute.String;
    stripe_subscription_id: Schema.Attribute.String;
    subscription_plan: Schema.Attribute.Enumeration<['monthly', 'annual']>;
    subscription_status: Schema.Attribute.Enumeration<
      ['inactive', 'trialing', 'active', 'past_due', 'canceled', 'unpaid']
    > &
      Schema.Attribute.DefaultTo<'inactive'>;
    trial_ends_at: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    user: Schema.Attribute.Relation<
      'oneToOne',
      'plugin::users-permissions.user'
    >;
    zodiac_sign: Schema.Attribute.Relation<
      'manyToOne',
      'api::zodiac-sign.zodiac-sign'
    >;
  };
}

export interface ApiUserReadingUserReading extends Struct.CollectionTypeSchema {
  collectionName: 'user_readings';
  info: {
    displayName: 'User Reading';
    pluralName: 'user-readings';
    singularName: 'user-reading';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    content: Schema.Attribute.Text;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    is_premium: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::user-reading.user-reading'
    > &
      Schema.Attribute.Private;
    metadata: Schema.Attribute.JSON;
    period: Schema.Attribute.Enumeration<
      ['dzienny', 'tygodniowy', 'miesieczny', 'roczny']
    >;
    publishedAt: Schema.Attribute.DateTime;
    reading_date: Schema.Attribute.Date;
    reading_type: Schema.Attribute.Enumeration<['horoscope', 'tarot']> &
      Schema.Attribute.Required;
    sign_slug: Schema.Attribute.String;
    source: Schema.Attribute.String;
    summary: Schema.Attribute.Text & Schema.Attribute.Required;
    title: Schema.Attribute.String & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    user: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
  };
}

export interface ApiZodiacSignZodiacSign extends Struct.CollectionTypeSchema {
  collectionName: 'zodiac_signs';
  info: {
    displayName: 'Zodiac Sign';
    pluralName: 'zodiac-signs';
    singularName: 'zodiac-sign';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    date_range: Schema.Attribute.String;
    description: Schema.Attribute.Text;
    element: Schema.Attribute.Enumeration<
      ['Ogie\u0144', 'Ziemia', 'Powietrze', 'Woda']
    >;
    horoscopes: Schema.Attribute.Relation<
      'oneToMany',
      'api::horoscope.horoscope'
    >;
    image: Schema.Attribute.Media<'images'>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::zodiac-sign.zodiac-sign'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    planet: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    seo: Schema.Attribute.Component<'shared.seo', false>;
    slug: Schema.Attribute.UID<'name'> & Schema.Attribute.Required;
    symbol: Schema.Attribute.Media<'images'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface PluginAiContentOrchestratorAuditEvent
  extends Struct.CollectionTypeSchema {
  collectionName: 'aico_audit_events';
  info: {
    displayName: 'AICO Audit Event';
    pluralName: 'audit-events';
    singularName: 'audit-event';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    action: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 160;
      }>;
    actor_id: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 120;
      }>;
    actor_type: Schema.Attribute.Enumeration<['admin', 'system', 'unknown']> &
      Schema.Attribute.DefaultTo<'unknown'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    event_key: Schema.Attribute.UID &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    ip_hash: Schema.Attribute.String &
      Schema.Attribute.Private &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 128;
      }>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::ai-content-orchestrator.audit-event'
    > &
      Schema.Attribute.Private;
    metadata: Schema.Attribute.JSON;
    occurred_at: Schema.Attribute.DateTime & Schema.Attribute.Required;
    outcome: Schema.Attribute.Enumeration<['success', 'failure', 'skipped']> &
      Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    request_id: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 160;
      }>;
    resource_id: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 120;
      }>;
    resource_label: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 220;
      }>;
    resource_uid: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 180;
      }>;
    severity: Schema.Attribute.Enumeration<['info', 'warn', 'error']> &
      Schema.Attribute.DefaultTo<'info'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface PluginAiContentOrchestratorContentPerformanceSnapshot
  extends Struct.CollectionTypeSchema {
  collectionName: 'aico_content_performance_snapshots';
  info: {
    displayName: 'AICO Content Performance Snapshot';
    pluralName: 'content-performance-snapshots';
    singularName: 'content-performance-snapshot';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: true;
    };
    'content-type-builder': {
      visible: true;
    };
  };
  attributes: {
    checkout_events: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    content_entry_id: Schema.Attribute.Integer & Schema.Attribute.Required;
    content_slug: Schema.Attribute.String;
    content_title: Schema.Attribute.String;
    content_uid: Schema.Attribute.String & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    cta_clicks: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    freshness_days: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::ai-content-orchestrator.content-performance-snapshot'
    > &
      Schema.Attribute.Private;
    metadata: Schema.Attribute.JSON;
    premium_events: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    publishedAt: Schema.Attribute.DateTime;
    recommendations: Schema.Attribute.JSON;
    score: Schema.Attribute.Float & Schema.Attribute.DefaultTo<0>;
    snapshot_day: Schema.Attribute.Date & Schema.Attribute.Required;
    social_failed: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    social_published: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    unique_key: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    views: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    workflow: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::ai-content-orchestrator.workflow'
    >;
  };
}

export interface PluginAiContentOrchestratorContentPlanItem
  extends Struct.CollectionTypeSchema {
  collectionName: 'aico_content_plan_items';
  info: {
    displayName: 'AICO Content Plan Item';
    pluralName: 'content-plan-items';
    singularName: 'content-plan-item';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: true;
    };
    'content-type-builder': {
      visible: true;
    };
  };
  attributes: {
    agent_rationale: Schema.Attribute.Text;
    article_category: Schema.Attribute.Relation<
      'manyToOne',
      'api::category.category'
    >;
    brief: Schema.Attribute.Text;
    channels: Schema.Attribute.JSON;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    dedupe_key: Schema.Attribute.String;
    generated_topic: Schema.Attribute.Relation<
      'oneToOne',
      'plugin::ai-content-orchestrator.topic-queue-item'
    >;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::ai-content-orchestrator.content-plan-item'
    > &
      Schema.Attribute.Private;
    metadata: Schema.Attribute.JSON;
    priority_score: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<50>;
    publishedAt: Schema.Attribute.DateTime;
    seo_cluster: Schema.Attribute.String;
    seo_intent: Schema.Attribute.String;
    source: Schema.Attribute.Enumeration<
      ['strategy_agent', 'manual', 'performance_feedback']
    > &
      Schema.Attribute.DefaultTo<'strategy_agent'>;
    status: Schema.Attribute.Enumeration<
      ['planned', 'approved', 'queued', 'published', 'rejected', 'failed']
    > &
      Schema.Attribute.DefaultTo<'planned'>;
    target_persona: Schema.Attribute.String;
    target_publish_at: Schema.Attribute.DateTime;
    title: Schema.Attribute.String & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    workflow: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::ai-content-orchestrator.workflow'
    >;
  };
}

export interface PluginAiContentOrchestratorEditorialMemory
  extends Struct.CollectionTypeSchema {
  collectionName: 'aico_editorial_memories';
  info: {
    displayName: 'AICO Editorial Memory';
    pluralName: 'editorial-memories';
    singularName: 'editorial-memory';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: true;
    };
    'content-type-builder': {
      visible: true;
    };
  };
  attributes: {
    active: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    content: Schema.Attribute.Text & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    key: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    label: Schema.Attribute.String & Schema.Attribute.Required;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::ai-content-orchestrator.editorial-memory'
    > &
      Schema.Attribute.Private;
    memory_type: Schema.Attribute.Enumeration<
      [
        'brand_voice',
        'seo_rule',
        'persona',
        'prohibited_phrase',
        'linking_rule',
        'custom',
      ]
    > &
      Schema.Attribute.DefaultTo<'custom'>;
    metadata: Schema.Attribute.JSON;
    priority: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface PluginAiContentOrchestratorHomepageRecommendation
  extends Struct.CollectionTypeSchema {
  collectionName: 'aico_homepage_recommendations';
  info: {
    displayName: 'AICO Homepage Recommendation';
    pluralName: 'homepage-recommendations';
    singularName: 'homepage-recommendation';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: true;
    };
    'content-type-builder': {
      visible: true;
    };
  };
  attributes: {
    content_entry_id: Schema.Attribute.Integer;
    content_slug: Schema.Attribute.String;
    content_uid: Schema.Attribute.String;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    expires_at: Schema.Attribute.DateTime;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::ai-content-orchestrator.homepage-recommendation'
    > &
      Schema.Attribute.Private;
    metadata: Schema.Attribute.JSON;
    priority_score: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<50>;
    publishedAt: Schema.Attribute.DateTime;
    rationale: Schema.Attribute.Text;
    slot: Schema.Attribute.Enumeration<
      [
        'today_in_stars',
        'weekly_focus',
        'recommended_for_you',
        'new_premium',
        'evergreen',
      ]
    > &
      Schema.Attribute.Required;
    source_snapshot: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::ai-content-orchestrator.content-performance-snapshot'
    >;
    starts_at: Schema.Attribute.DateTime;
    status: Schema.Attribute.Enumeration<
      ['scheduled', 'active', 'expired', 'archived']
    > &
      Schema.Attribute.DefaultTo<'active'>;
    subtitle: Schema.Attribute.Text;
    target_url: Schema.Attribute.String;
    title: Schema.Attribute.String & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    workflow: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::ai-content-orchestrator.workflow'
    >;
  };
}

export interface PluginAiContentOrchestratorMediaAsset
  extends Struct.CollectionTypeSchema {
  collectionName: 'aico_media_assets';
  info: {
    displayName: 'AICO Media Asset';
    pluralName: 'media-assets';
    singularName: 'media-asset';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: true;
    };
    'content-type-builder': {
      visible: true;
    };
  };
  attributes: {
    active: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    asset: Schema.Attribute.Relation<'oneToOne', 'plugin::upload.file'>;
    asset_key: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    cooldown_days: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<3>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    keywords: Schema.Attribute.JSON;
    label: Schema.Attribute.String & Schema.Attribute.Required;
    last_used_at: Schema.Attribute.DateTime;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::ai-content-orchestrator.media-asset'
    > &
      Schema.Attribute.Private;
    mapping_confidence: Schema.Attribute.Float;
    mapping_reasons: Schema.Attribute.JSON;
    mapping_source: Schema.Attribute.Enumeration<
      ['manual', 'suggestion', 'bulk_suggestion', 'seed']
    >;
    notes: Schema.Attribute.Text;
    period_scope: Schema.Attribute.Enumeration<
      ['any', 'daily', 'weekly', 'monthly']
    > &
      Schema.Attribute.DefaultTo<'any'>;
    priority: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    publishedAt: Schema.Attribute.DateTime;
    purpose: Schema.Attribute.Enumeration<
      [
        'horoscope_sign',
        'daily_card',
        'blog_article',
        'zodiac_profile',
        'fallback_general',
      ]
    > &
      Schema.Attribute.DefaultTo<'blog_article'>;
    sign_slug: Schema.Attribute.String;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    use_count: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
  };
}

export interface PluginAiContentOrchestratorMediaUsageLog
  extends Struct.CollectionTypeSchema {
  collectionName: 'aico_media_usage_logs';
  info: {
    displayName: 'AICO Media Usage Log';
    pluralName: 'media-usage-logs';
    singularName: 'media-usage-log';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: true;
    };
    'content-type-builder': {
      visible: true;
    };
  };
  attributes: {
    content_entry_id: Schema.Attribute.Integer & Schema.Attribute.Required;
    content_uid: Schema.Attribute.String & Schema.Attribute.Required;
    context_key: Schema.Attribute.String & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::ai-content-orchestrator.media-usage-log'
    > &
      Schema.Attribute.Private;
    media_asset: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::ai-content-orchestrator.media-asset'
    >;
    publishedAt: Schema.Attribute.DateTime;
    target_date: Schema.Attribute.Date;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    used_at: Schema.Attribute.DateTime & Schema.Attribute.Required;
    workflow: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::ai-content-orchestrator.workflow'
    >;
  };
}

export interface PluginAiContentOrchestratorPublicationTicket
  extends Struct.CollectionTypeSchema {
  collectionName: 'aico_publication_tickets';
  info: {
    displayName: 'AICO Publication Ticket';
    pluralName: 'publication-tickets';
    singularName: 'publication-ticket';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: true;
    };
    'content-type-builder': {
      visible: true;
    };
  };
  attributes: {
    business_key: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    content_entry_id: Schema.Attribute.Integer & Schema.Attribute.Required;
    content_uid: Schema.Attribute.String & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    last_error: Schema.Attribute.Text;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::ai-content-orchestrator.publication-ticket'
    > &
      Schema.Attribute.Private;
    payload: Schema.Attribute.JSON;
    published_on: Schema.Attribute.DateTime;
    publishedAt: Schema.Attribute.DateTime;
    retries: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    source_run: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::ai-content-orchestrator.run-log'
    >;
    status: Schema.Attribute.Enumeration<
      ['scheduled', 'published', 'failed', 'canceled']
    > &
      Schema.Attribute.DefaultTo<'scheduled'>;
    target_publish_at: Schema.Attribute.DateTime & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    workflow: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::ai-content-orchestrator.workflow'
    >;
  };
}

export interface PluginAiContentOrchestratorRunLog
  extends Struct.CollectionTypeSchema {
  collectionName: 'aico_run_logs';
  info: {
    displayName: 'AICO Run Log';
    pluralName: 'run-logs';
    singularName: 'run-log';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: true;
    };
    'content-type-builder': {
      visible: true;
    };
  };
  attributes: {
    attempts: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<1>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    details: Schema.Attribute.JSON;
    error_message: Schema.Attribute.Text;
    finished_at: Schema.Attribute.DateTime;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::ai-content-orchestrator.run-log'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    run_type: Schema.Attribute.Enumeration<
      ['generate', 'publish', 'manual', 'backfill']
    > &
      Schema.Attribute.Required;
    started_at: Schema.Attribute.DateTime & Schema.Attribute.Required;
    status: Schema.Attribute.Enumeration<
      ['running', 'success', 'failed', 'blocked_budget']
    > &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    usage_completion_tokens: Schema.Attribute.Integer &
      Schema.Attribute.DefaultTo<0>;
    usage_prompt_tokens: Schema.Attribute.Integer &
      Schema.Attribute.DefaultTo<0>;
    usage_total_tokens: Schema.Attribute.Integer &
      Schema.Attribute.DefaultTo<0>;
    workflow: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::ai-content-orchestrator.workflow'
    >;
  };
}

export interface PluginAiContentOrchestratorRuntimeLock
  extends Struct.CollectionTypeSchema {
  collectionName: 'aico_runtime_locks';
  info: {
    displayName: 'AICO Runtime Lock';
    pluralName: 'runtime-locks';
    singularName: 'runtime-lock';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    acquired_at: Schema.Attribute.DateTime & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    expires_at: Schema.Attribute.DateTime & Schema.Attribute.Required;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::ai-content-orchestrator.runtime-lock'
    > &
      Schema.Attribute.Private;
    lock_key: Schema.Attribute.UID &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    metadata: Schema.Attribute.JSON;
    owner_id: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 220;
      }>;
    publishedAt: Schema.Attribute.DateTime;
    released_at: Schema.Attribute.DateTime;
    status: Schema.Attribute.Enumeration<['active', 'released']> &
      Schema.Attribute.DefaultTo<'active'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface PluginAiContentOrchestratorSocialPostTicket
  extends Struct.CollectionTypeSchema {
  collectionName: 'aico_social_post_tickets';
  info: {
    displayName: 'AICO Social Post Ticket';
    pluralName: 'social-post-tickets';
    singularName: 'social-post-ticket';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: true;
    };
    'content-type-builder': {
      visible: true;
    };
  };
  attributes: {
    attempt_count: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    blocked_reason: Schema.Attribute.String;
    caption: Schema.Attribute.Text & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    idempotency_key: Schema.Attribute.String & Schema.Attribute.Unique;
    last_error: Schema.Attribute.Text;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::ai-content-orchestrator.social-post-ticket'
    > &
      Schema.Attribute.Private;
    media_url: Schema.Attribute.String;
    next_attempt_at: Schema.Attribute.DateTime;
    platform: Schema.Attribute.Enumeration<
      ['facebook', 'instagram', 'twitter', 'tiktok']
    > &
      Schema.Attribute.Required;
    provider_payload: Schema.Attribute.JSON & Schema.Attribute.Private;
    provider_post_id: Schema.Attribute.String;
    published_on: Schema.Attribute.DateTime;
    publishedAt: Schema.Attribute.DateTime;
    related_content_id: Schema.Attribute.Integer;
    related_content_uid: Schema.Attribute.String;
    scheduled_at: Schema.Attribute.DateTime & Schema.Attribute.Required;
    source_run: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::ai-content-orchestrator.run-log'
    >;
    status: Schema.Attribute.Enumeration<
      ['pending', 'scheduled', 'published', 'failed', 'canceled']
    > &
      Schema.Attribute.DefaultTo<'pending'>;
    target_url: Schema.Attribute.String;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    workflow: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::ai-content-orchestrator.workflow'
    >;
  };
}

export interface PluginAiContentOrchestratorTopicQueueItem
  extends Struct.CollectionTypeSchema {
  collectionName: 'aico_topic_queue_items';
  info: {
    displayName: 'AICO Topic Queue Item';
    pluralName: 'topic-queue-items';
    singularName: 'topic-queue-item';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: true;
    };
    'content-type-builder': {
      visible: true;
    };
  };
  attributes: {
    article_category: Schema.Attribute.Relation<
      'manyToOne',
      'api::category.category'
    >;
    brief: Schema.Attribute.Text;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    error_message: Schema.Attribute.Text;
    generated_article: Schema.Attribute.Relation<
      'oneToOne',
      'api::article.article'
    >;
    image_asset_key: Schema.Attribute.String;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::ai-content-orchestrator.topic-queue-item'
    > &
      Schema.Attribute.Private;
    metadata: Schema.Attribute.JSON;
    plan_item: Schema.Attribute.Relation<
      'oneToOne',
      'plugin::ai-content-orchestrator.content-plan-item'
    >;
    priority_score: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<50>;
    processed_at: Schema.Attribute.DateTime;
    publishedAt: Schema.Attribute.DateTime;
    scheduled_for: Schema.Attribute.DateTime;
    seo_intent: Schema.Attribute.String;
    status: Schema.Attribute.Enumeration<
      ['pending', 'processing', 'done', 'failed']
    > &
      Schema.Attribute.DefaultTo<'pending'>;
    target_persona: Schema.Attribute.String;
    title: Schema.Attribute.String & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    workflow: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::ai-content-orchestrator.workflow'
    >;
  };
}

export interface PluginAiContentOrchestratorUsageDaily
  extends Struct.CollectionTypeSchema {
  collectionName: 'aico_usage_daily';
  info: {
    displayName: 'AICO Usage Daily';
    pluralName: 'usage-dailies';
    singularName: 'usage-daily';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: true;
    };
    'content-type-builder': {
      visible: true;
    };
  };
  attributes: {
    completion_tokens: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    day: Schema.Attribute.Date & Schema.Attribute.Required;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::ai-content-orchestrator.usage-daily'
    > &
      Schema.Attribute.Private;
    prompt_tokens: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    publishedAt: Schema.Attribute.DateTime;
    request_count: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    status: Schema.Attribute.Enumeration<['ok', 'blocked_budget']> &
      Schema.Attribute.DefaultTo<'ok'>;
    total_tokens: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    unique_key: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    workflow: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::ai-content-orchestrator.workflow'
    >;
  };
}

export interface PluginAiContentOrchestratorWorkflow
  extends Struct.CollectionTypeSchema {
  collectionName: 'aico_workflows';
  info: {
    displayName: 'AICO Workflow';
    pluralName: 'workflows';
    singularName: 'workflow';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: true;
    };
    'content-type-builder': {
      visible: true;
    };
  };
  attributes: {
    all_signs: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    allow_manual_edit: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<true>;
    article_category: Schema.Attribute.Relation<
      'manyToOne',
      'api::category.category'
    >;
    auto_publish: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    auto_publish_guardrails: Schema.Attribute.JSON;
    content_cluster: Schema.Attribute.String;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    daily_request_limit: Schema.Attribute.Integer &
      Schema.Attribute.DefaultTo<120>;
    daily_token_limit: Schema.Attribute.Integer &
      Schema.Attribute.DefaultTo<250000>;
    enabled: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    enabled_channels: Schema.Attribute.JSON;
    fb_access_token_encrypted: Schema.Attribute.Text & Schema.Attribute.Private;
    fb_page_id: Schema.Attribute.String;
    force_regenerate: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<false>;
    generate_cron: Schema.Attribute.String & Schema.Attribute.Required;
    horoscope_period: Schema.Attribute.Enumeration<
      ['Dzienny', 'Tygodniowy', 'Miesi\u0119czny', 'Roczny']
    >;
    horoscope_type_values: Schema.Attribute.JSON;
    ig_access_token_encrypted: Schema.Attribute.Text & Schema.Attribute.Private;
    ig_user_id: Schema.Attribute.String;
    image_gen_api_token_encrypted: Schema.Attribute.Text &
      Schema.Attribute.Private;
    image_gen_model: Schema.Attribute.String &
      Schema.Attribute.DefaultTo<'openai/gpt-image-2'>;
    last_error: Schema.Attribute.Text;
    last_generated_at: Schema.Attribute.DateTime;
    last_generation_slot: Schema.Attribute.String;
    last_publish_slot: Schema.Attribute.String;
    last_published_at: Schema.Attribute.DateTime;
    llm_api_token_encrypted: Schema.Attribute.Text & Schema.Attribute.Private;
    llm_model: Schema.Attribute.String & Schema.Attribute.Required;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::ai-content-orchestrator.workflow'
    > &
      Schema.Attribute.Private;
    max_completion_tokens: Schema.Attribute.Integer &
      Schema.Attribute.DefaultTo<1800>;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    performance_feedback_enabled: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<true>;
    prompt_template: Schema.Attribute.Text & Schema.Attribute.Required;
    publish_cron: Schema.Attribute.String & Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    retry_backoff_seconds: Schema.Attribute.Integer &
      Schema.Attribute.DefaultTo<120>;
    retry_max: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<3>;
    status: Schema.Attribute.Enumeration<
      ['idle', 'running', 'failed', 'blocked_budget']
    > &
      Schema.Attribute.DefaultTo<'idle'>;
    strategy_enabled: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<false>;
    temperature: Schema.Attribute.Float & Schema.Attribute.DefaultTo<0.7>;
    timezone: Schema.Attribute.String &
      Schema.Attribute.DefaultTo<'Europe/Warsaw'>;
    topic_mode: Schema.Attribute.Enumeration<['manual', 'mixed']> &
      Schema.Attribute.DefaultTo<'mixed'>;
    tt_access_token_encrypted: Schema.Attribute.Text & Schema.Attribute.Private;
    tt_creator_id: Schema.Attribute.String;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    workflow_type: Schema.Attribute.Enumeration<
      ['horoscope', 'daily_card', 'article']
    > &
      Schema.Attribute.Required;
    x_access_token_encrypted: Schema.Attribute.Text & Schema.Attribute.Private;
    x_access_token_secret_encrypted: Schema.Attribute.Text &
      Schema.Attribute.Private;
    x_api_key: Schema.Attribute.String;
    x_api_secret_encrypted: Schema.Attribute.Text & Schema.Attribute.Private;
  };
}

export interface PluginContentReleasesRelease
  extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_releases';
  info: {
    displayName: 'Release';
    pluralName: 'releases';
    singularName: 'release';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    actions: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::content-releases.release-action'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::content-releases.release'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    releasedAt: Schema.Attribute.DateTime;
    scheduledAt: Schema.Attribute.DateTime;
    status: Schema.Attribute.Enumeration<
      ['ready', 'blocked', 'failed', 'done', 'empty']
    > &
      Schema.Attribute.Required;
    timezone: Schema.Attribute.String;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface PluginContentReleasesReleaseAction
  extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_release_actions';
  info: {
    displayName: 'Release Action';
    pluralName: 'release-actions';
    singularName: 'release-action';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    contentType: Schema.Attribute.String & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    entryDocumentId: Schema.Attribute.String;
    isEntryValid: Schema.Attribute.Boolean;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::content-releases.release-action'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    release: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::content-releases.release'
    >;
    type: Schema.Attribute.Enumeration<['publish', 'unpublish']> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface PluginI18NLocale extends Struct.CollectionTypeSchema {
  collectionName: 'i18n_locale';
  info: {
    collectionName: 'locales';
    description: '';
    displayName: 'Locale';
    pluralName: 'locales';
    singularName: 'locale';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    code: Schema.Attribute.String & Schema.Attribute.Unique;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::i18n.locale'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.SetMinMax<
        {
          max: 50;
          min: 1;
        },
        number
      >;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface PluginReviewWorkflowsWorkflow
  extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_workflows';
  info: {
    description: '';
    displayName: 'Workflow';
    name: 'Workflow';
    pluralName: 'workflows';
    singularName: 'workflow';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    contentTypes: Schema.Attribute.JSON &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'[]'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::review-workflows.workflow'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    publishedAt: Schema.Attribute.DateTime;
    stageRequiredToPublish: Schema.Attribute.Relation<
      'oneToOne',
      'plugin::review-workflows.workflow-stage'
    >;
    stages: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::review-workflows.workflow-stage'
    >;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface PluginReviewWorkflowsWorkflowStage
  extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_workflows_stages';
  info: {
    description: '';
    displayName: 'Stages';
    name: 'Workflow Stage';
    pluralName: 'workflow-stages';
    singularName: 'workflow-stage';
  };
  options: {
    draftAndPublish: false;
    version: '1.1.0';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    color: Schema.Attribute.String & Schema.Attribute.DefaultTo<'#4945FF'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::review-workflows.workflow-stage'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String;
    permissions: Schema.Attribute.Relation<'manyToMany', 'admin::permission'>;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    workflow: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::review-workflows.workflow'
    >;
  };
}

export interface PluginUploadFile extends Struct.CollectionTypeSchema {
  collectionName: 'files';
  info: {
    description: '';
    displayName: 'File';
    pluralName: 'files';
    singularName: 'file';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    alternativeText: Schema.Attribute.Text;
    caption: Schema.Attribute.Text;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    ext: Schema.Attribute.String;
    focalPoint: Schema.Attribute.JSON;
    folder: Schema.Attribute.Relation<'manyToOne', 'plugin::upload.folder'> &
      Schema.Attribute.Private;
    folderPath: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    formats: Schema.Attribute.JSON;
    hash: Schema.Attribute.String & Schema.Attribute.Required;
    height: Schema.Attribute.Integer;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::upload.file'
    > &
      Schema.Attribute.Private;
    mime: Schema.Attribute.String & Schema.Attribute.Required;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    previewUrl: Schema.Attribute.Text;
    provider: Schema.Attribute.String & Schema.Attribute.Required;
    provider_metadata: Schema.Attribute.JSON;
    publishedAt: Schema.Attribute.DateTime;
    related: Schema.Attribute.Relation<'morphToMany'>;
    size: Schema.Attribute.Decimal & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    url: Schema.Attribute.Text & Schema.Attribute.Required;
    width: Schema.Attribute.Integer;
  };
}

export interface PluginUploadFolder extends Struct.CollectionTypeSchema {
  collectionName: 'upload_folders';
  info: {
    displayName: 'Folder';
    pluralName: 'folders';
    singularName: 'folder';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    children: Schema.Attribute.Relation<'oneToMany', 'plugin::upload.folder'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    files: Schema.Attribute.Relation<'oneToMany', 'plugin::upload.file'>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::upload.folder'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    parent: Schema.Attribute.Relation<'manyToOne', 'plugin::upload.folder'>;
    path: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    pathId: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface PluginUsersPermissionsPermission
  extends Struct.CollectionTypeSchema {
  collectionName: 'up_permissions';
  info: {
    description: '';
    displayName: 'Permission';
    name: 'permission';
    pluralName: 'permissions';
    singularName: 'permission';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    action: Schema.Attribute.String & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::users-permissions.permission'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    role: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.role'
    >;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface PluginUsersPermissionsRole
  extends Struct.CollectionTypeSchema {
  collectionName: 'up_roles';
  info: {
    description: '';
    displayName: 'Role';
    name: 'role';
    pluralName: 'roles';
    singularName: 'role';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.String;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::users-permissions.role'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 3;
      }>;
    permissions: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::users-permissions.permission'
    >;
    publishedAt: Schema.Attribute.DateTime;
    type: Schema.Attribute.String & Schema.Attribute.Unique;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    users: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::users-permissions.user'
    >;
  };
}

export interface PluginUsersPermissionsUser
  extends Struct.CollectionTypeSchema {
  collectionName: 'up_users';
  info: {
    description: '';
    displayName: 'User';
    name: 'user';
    pluralName: 'users';
    singularName: 'user';
  };
  options: {
    draftAndPublish: false;
    timestamps: true;
  };
  attributes: {
    blocked: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    confirmationToken: Schema.Attribute.String & Schema.Attribute.Private;
    confirmed: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    email: Schema.Attribute.Email &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 6;
      }>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::users-permissions.user'
    > &
      Schema.Attribute.Private;
    password: Schema.Attribute.Password &
      Schema.Attribute.Private &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 6;
      }>;
    provider: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    resetPasswordToken: Schema.Attribute.String & Schema.Attribute.Private;
    role: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.role'
    >;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    username: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 3;
      }>;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ContentTypeSchemas {
      'admin::api-token': AdminApiToken;
      'admin::api-token-permission': AdminApiTokenPermission;
      'admin::permission': AdminPermission;
      'admin::role': AdminRole;
      'admin::session': AdminSession;
      'admin::transfer-token': AdminTransferToken;
      'admin::transfer-token-permission': AdminTransferTokenPermission;
      'admin::user': AdminUser;
      'api::analytics-event.analytics-event': ApiAnalyticsEventAnalyticsEvent;
      'api::app-setting.app-setting': ApiAppSettingAppSetting;
      'api::article.article': ApiArticleArticle;
      'api::category.category': ApiCategoryCategory;
      'api::daily-tarot-draw.daily-tarot-draw': ApiDailyTarotDrawDailyTarotDraw;
      'api::horoscope.horoscope': ApiHoroscopeHoroscope;
      'api::newsletter-subscription.newsletter-subscription': ApiNewsletterSubscriptionNewsletterSubscription;
      'api::numerology-profile.numerology-profile': ApiNumerologyProfileNumerologyProfile;
      'api::order-item.order-item': ApiOrderItemOrderItem;
      'api::order.order': ApiOrderOrder;
      'api::product.product': ApiProductProduct;
      'api::tarot-card.tarot-card': ApiTarotCardTarotCard;
      'api::user-profile.user-profile': ApiUserProfileUserProfile;
      'api::user-reading.user-reading': ApiUserReadingUserReading;
      'api::zodiac-sign.zodiac-sign': ApiZodiacSignZodiacSign;
      'plugin::ai-content-orchestrator.audit-event': PluginAiContentOrchestratorAuditEvent;
      'plugin::ai-content-orchestrator.content-performance-snapshot': PluginAiContentOrchestratorContentPerformanceSnapshot;
      'plugin::ai-content-orchestrator.content-plan-item': PluginAiContentOrchestratorContentPlanItem;
      'plugin::ai-content-orchestrator.editorial-memory': PluginAiContentOrchestratorEditorialMemory;
      'plugin::ai-content-orchestrator.homepage-recommendation': PluginAiContentOrchestratorHomepageRecommendation;
      'plugin::ai-content-orchestrator.media-asset': PluginAiContentOrchestratorMediaAsset;
      'plugin::ai-content-orchestrator.media-usage-log': PluginAiContentOrchestratorMediaUsageLog;
      'plugin::ai-content-orchestrator.publication-ticket': PluginAiContentOrchestratorPublicationTicket;
      'plugin::ai-content-orchestrator.run-log': PluginAiContentOrchestratorRunLog;
      'plugin::ai-content-orchestrator.runtime-lock': PluginAiContentOrchestratorRuntimeLock;
      'plugin::ai-content-orchestrator.social-post-ticket': PluginAiContentOrchestratorSocialPostTicket;
      'plugin::ai-content-orchestrator.topic-queue-item': PluginAiContentOrchestratorTopicQueueItem;
      'plugin::ai-content-orchestrator.usage-daily': PluginAiContentOrchestratorUsageDaily;
      'plugin::ai-content-orchestrator.workflow': PluginAiContentOrchestratorWorkflow;
      'plugin::content-releases.release': PluginContentReleasesRelease;
      'plugin::content-releases.release-action': PluginContentReleasesReleaseAction;
      'plugin::i18n.locale': PluginI18NLocale;
      'plugin::review-workflows.workflow': PluginReviewWorkflowsWorkflow;
      'plugin::review-workflows.workflow-stage': PluginReviewWorkflowsWorkflowStage;
      'plugin::upload.file': PluginUploadFile;
      'plugin::upload.folder': PluginUploadFolder;
      'plugin::users-permissions.permission': PluginUsersPermissionsPermission;
      'plugin::users-permissions.role': PluginUsersPermissionsRole;
      'plugin::users-permissions.user': PluginUsersPermissionsUser;
    }
  }
}
