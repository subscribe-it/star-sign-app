import type { Core } from '@strapi/strapi';

const config = ({
  env,
}: Core.Config.Shared.ConfigParams): Core.Config.Plugin => {
  const r2UploadEnabled = env.bool('R2_UPLOAD_ENABLED', false);
  const uploadSecurityConfig = {
    security: {
      deniedTypes: [
        'application/javascript',
        'text/javascript',
        'application/x-httpd-php',
        'text/x-php',
        'application/x-sh',
        'text/x-shellscript',
        'application/x-msdownload',
      ],
    },
  };

  const pluginConfig: Core.Config.Plugin = {
    'ai-content-orchestrator': {
      enabled: true,
      resolve: 'src/plugins/ai-content-orchestrator',
    },
    email: {
      config: {
        provider: 'nodemailer',
        providerOptions: {
          host: env('BREVO_SMTP_HOST', 'smtp-relay.brevo.com'),
          port: env.int('BREVO_SMTP_PORT', 587),
          secure: env.bool('BREVO_SMTP_SECURE', false),
          auth: {
            user: env('BREVO_SMTP_USER'),
            pass: env('BREVO_SMTP_PASSWORD'),
          },
        },
        settings: {
          defaultFrom: env(
            'BREVO_FROM_EMAIL',
            env('EMAIL_DEFAULT_FROM', 'Star Sign <noreply@starsign.local>'),
          ),
          defaultReplyTo: env(
            'BREVO_REPLY_TO',
            env('EMAIL_DEFAULT_REPLY_TO', 'kontakt@starsign.local'),
          ),
        },
      },
    },
    documentation: {
      enabled: env.bool(
        'STRAPI_DOCUMENTATION_ENABLED',
        env('NODE_ENV') !== 'production',
      ),
      config: {
        info: {
          title: 'Star Sign API',
          version: env('API_VERSION', '1.0.0'),
          description: 'Publiczne i administracyjne API Star Sign.',
        },
      },
    },
    sentry: {
      enabled: Boolean(env('SENTRY_DSN')),
      config: {
        dsn: env('SENTRY_DSN'),
        sendMetadata: true,
        init: {
          environment: env('NODE_ENV', 'development'),
          release: env('SENTRY_RELEASE') || undefined,
          tracesSampleRate: env.float('SENTRY_TRACES_SAMPLE_RATE', 0),
        },
      },
    },
  };

  if (!r2UploadEnabled) {
    return {
      ...pluginConfig,
      upload: {
        config: uploadSecurityConfig,
      },
    };
  }

  const baseUrl = env('R2_PUBLIC_BASE_URL');
  const rootPath = env('R2_ROOT_PATH');

  return {
    ...pluginConfig,
    upload: {
      config: {
        ...uploadSecurityConfig,
        provider: 'aws-s3',
        providerOptions: {
          ...(baseUrl ? { baseUrl } : {}),
          ...(rootPath ? { rootPath } : {}),
          s3Options: {
            credentials: {
              accessKeyId: env('R2_ACCESS_KEY_ID'),
              secretAccessKey: env('R2_SECRET_ACCESS_KEY'),
            },
            endpoint: env('R2_S3_ENDPOINT'),
            region: env('R2_REGION', 'auto'),
            forcePathStyle: env.bool('R2_FORCE_PATH_STYLE', true),
            // Cloudflare R2 odrzuca PUT-y podpisane z domyślnymi nagłówkami
            // sum kontrolnych (CRC32) dodawanymi przez @aws-sdk >= 3.739
            // (SignatureDoesNotMatch) — wymuszamy tryb zgodny z R2.
            requestChecksumCalculation: 'WHEN_REQUIRED',
            responseChecksumValidation: 'WHEN_REQUIRED',
            params: {
              Bucket: env('R2_BUCKET'),
              ACL: undefined,
              signedUrlExpires: env.int('R2_SIGNED_URL_EXPIRES', 15 * 60),
            },
          },
        },
        actionOptions: {
          upload: {},
          uploadStream: {},
          delete: {},
        },
      },
    },
  };
};

export default config;
