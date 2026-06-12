import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { isAbsolute, join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const {
  buildAicoSettingsValue,
  buildSocialCredentialSeedFields,
  buildWorkflowAutomationSeedFields,
  getAppDir,
} = require('../../scripts/seed-core.js');

const strapi = {
  service: (name: string) => {
    if (name !== 'admin::encryption') {
      throw new Error(`Unexpected service: ${name}`);
    }

    return {
      encrypt: (value: string) => `encrypted:${value}`,
    };
  },
};

describe('production seed core helpers', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('resolves Strapi appDir independently from current working directory', () => {
    const originalCwd = process.cwd();
    const expectedAppDir = getAppDir();
    const directory = mkdtempSync(join(tmpdir(), 'seed-core-cwd-'));

    try {
      process.chdir(directory);

      expect(getAppDir()).toBe(expectedAppDir);
      expect(getAppDir()).toMatch(/apps\/api$/);
      expect(isAbsolute(getAppDir())).toBe(true);
    } finally {
      process.chdir(originalCwd);
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('merges AICO settings and preserves existing values while adding Media Gen config', () => {
    vi.stubEnv('AICO_IMAGE_GEN_TOKEN', 'image-token');
    vi.stubEnv('AICO_IMAGE_GEN_MODEL', 'custom/image-model');
    vi.stubEnv('AICO_AUTO_PUBLISH_ENABLED', 'false');
    vi.stubEnv('AICO_STRATEGY_AUTOPILOT_ENABLED', 'true');

    const result = buildAicoSettingsValue(strapi, 'prod', {
      custom_setting: 'keep-me',
      image_gen_api_token_encrypted: 'old-encrypted-token',
    });

    expect(result.value).toEqual(
      expect.objectContaining({
        custom_setting: 'keep-me',
        timezone: 'Europe/Warsaw',
        locale: 'pl',
        image_gen_model: 'custom/image-model',
        image_gen_api_token_encrypted: 'encrypted:image-token',
        aico_auto_publish_enabled: false,
        aico_strategy_autopilot_enabled: true,
      }),
    );
    expect(result.summary).toEqual({
      imageGenModel: 'custom/image-model',
      imageGenTokenPresent: true,
      autoPublishEnabled: false,
      strategyAutopilotEnabled: true,
    });
  });

  it('preserves existing AICO settings when env does not provide replacements', () => {
    vi.stubEnv('AICO_IMAGE_GEN_TOKEN', '');
    vi.stubEnv('AICO_IMAGE_GEN_TOKEN_PROD', '');
    vi.stubEnv('REPLICATE_API_TOKEN', '');
    vi.stubEnv('REPLICATE_API_TOKEN_PROD', '');
    vi.stubEnv('AICO_IMAGE_GEN_MODEL', '');
    vi.stubEnv('AICO_IMAGE_GEN_MODEL_PROD', '');

    const result = buildAicoSettingsValue(strapi, 'prod', {
      image_gen_model: 'existing/model',
      image_gen_api_token_encrypted: 'existing-image-token',
      aico_auto_publish_enabled: false,
      aico_strategy_autopilot_enabled: true,
    });

    expect(result.value).toEqual(
      expect.objectContaining({
        timezone: 'Europe/Warsaw',
        locale: 'pl',
        image_gen_model: 'existing/model',
        image_gen_api_token_encrypted: 'existing-image-token',
        aico_auto_publish_enabled: false,
        aico_strategy_autopilot_enabled: true,
      }),
    );
    expect(result.summary.imageGenTokenPresent).toBe(true);
    expect(result.summary.autoPublishEnabled).toBe(false);
    expect(result.summary.strategyAutopilotEnabled).toBe(true);
  });

  it('preserves existing social credentials unless env provides replacements', () => {
    vi.stubEnv('AICO_FACEBOOK_PAGE_ID', 'new-page');
    vi.stubEnv('AICO_FACEBOOK_ACCESS_TOKEN', 'new-fb-token');
    vi.stubEnv('AICO_SOCIAL_CHANNELS', 'facebook,instagram,twitter');

    const fields = buildSocialCredentialSeedFields(strapi, 'prod', {
      fb_page_id: 'old-page',
      fb_access_token_encrypted: 'old-fb-token',
      ig_user_id: 'existing-ig',
      ig_access_token_encrypted: 'existing-ig-token',
      x_api_key: 'existing-x-key',
      x_api_secret_encrypted: 'existing-x-secret',
      x_access_token_encrypted: 'existing-x-token',
      x_access_token_secret_encrypted: 'existing-x-token-secret',
    });

    expect(fields).toEqual(
      expect.objectContaining({
        enabled_channels: ['facebook', 'instagram', 'twitter'],
        fb_page_id: 'new-page',
        fb_access_token_encrypted: 'encrypted:new-fb-token',
        ig_user_id: 'existing-ig',
        ig_access_token_encrypted: 'existing-ig-token',
        x_api_key: 'existing-x-key',
        x_api_secret_encrypted: 'existing-x-secret',
        x_access_token_encrypted: 'existing-x-token',
        x_access_token_secret_encrypted: 'existing-x-token-secret',
      }),
    );
  });

  it('adds article strategy guardrails only when production env opts in', () => {
    vi.stubEnv('AICO_STRATEGY_AUTOPILOT_ENABLED', 'true');
    vi.stubEnv('AICO_STRATEGY_AUTO_APPROVE_PLAN', 'true');
    vi.stubEnv('AICO_STRATEGY_MIN_TOPIC_BACKLOG', '4');
    vi.stubEnv('AICO_STRATEGY_MAX_PLAN_ITEMS_PER_TICK', '2');

    const fields = buildWorkflowAutomationSeedFields(
      { workflow_type: 'article' },
      {
        auto_publish_guardrails: {
          social: { max_posts_per_run: 3 },
        },
      },
    );

    expect(fields).toEqual({
      strategy_enabled: true,
      auto_publish_guardrails: {
        social: { max_posts_per_run: 3 },
        strategy: {
          enabled: true,
          autopilot_enabled: true,
          auto_approve_plan: true,
          min_topic_backlog: 4,
          max_plan_items_per_tick: 2,
        },
      },
    });
  });
});
