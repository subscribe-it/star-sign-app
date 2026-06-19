import { EDITOR_PERSONA_UID } from '../constants';
import type { EditorPersonaRecord, Strapi } from '../types';
import { getEntityService } from '../utils/entity-service';

type PersonaCreatePayload = {
  name: string;
  key?: string;
  byline?: string;
  bio?: string;
  specialization?: string;
  avatar?: number;
  temperament?: string;
  writing_style?: Record<string, unknown>;
  system_instruction?: string;
  prompt_prefix?: string;
  prompt_suffix?: string;
  llm_model?: string;
  temperature?: number;
  enabled_for?: string[];
  active?: boolean;
  priority?: number;
};

type PersonaUpdatePayload = Partial<PersonaCreatePayload>;

const PERSONA_POPULATE = ['avatar'];

const clampTemperature = (value: number): number => Math.max(0, Math.min(2, value));

const personas = ({ strapi }: { strapi: Strapi }) => {
  const entityService = getEntityService(strapi);

  return {
    async list({ activeOnly }: { activeOnly?: boolean } = {}): Promise<EditorPersonaRecord[]> {
      return (await entityService.findMany(EDITOR_PERSONA_UID, {
        filters: activeOnly ? { active: true } : undefined,
        sort: [{ priority: 'desc' }, { name: 'asc' }],
        populate: PERSONA_POPULATE,
      })) as EditorPersonaRecord[];
    },

    async getById(id: number): Promise<EditorPersonaRecord | null> {
      return (await entityService.findOne(EDITOR_PERSONA_UID, id, {
        populate: PERSONA_POPULATE,
      })) as EditorPersonaRecord | null;
    },

    async getByKey(key: string): Promise<EditorPersonaRecord | null> {
      const trimmed = key?.trim();

      if (!trimmed) {
        return null;
      }

      const matches = (await entityService.findMany(EDITOR_PERSONA_UID, {
        filters: { key: trimmed },
        populate: PERSONA_POPULATE,
        limit: 1,
      })) as EditorPersonaRecord[];

      return matches[0] ?? null;
    },

    async create(payload: PersonaCreatePayload): Promise<EditorPersonaRecord> {
      if (!payload.name?.trim()) {
        throw new Error('Persona musi mieć nazwę.');
      }

      const created = (await entityService.create(EDITOR_PERSONA_UID, {
        data: {
          name: payload.name.trim(),
          key: payload.key?.trim() || undefined,
          byline: payload.byline?.trim() || null,
          bio: payload.bio?.trim() || null,
          specialization: payload.specialization?.trim() || null,
          avatar: payload.avatar,
          temperament: payload.temperament?.trim() || null,
          writing_style: payload.writing_style ?? null,
          system_instruction: payload.system_instruction?.trim() || null,
          prompt_prefix: payload.prompt_prefix?.trim() || null,
          prompt_suffix: payload.prompt_suffix?.trim() || null,
          llm_model: payload.llm_model?.trim() || null,
          temperature:
            typeof payload.temperature === 'number'
              ? clampTemperature(payload.temperature)
              : null,
          enabled_for: payload.enabled_for ?? null,
          active: typeof payload.active === 'boolean' ? payload.active : true,
          priority:
            typeof payload.priority === 'number' ? Math.floor(payload.priority) : 0,
        },
        populate: PERSONA_POPULATE,
      })) as EditorPersonaRecord;

      return created;
    },

    async update(id: number, payload: PersonaUpdatePayload): Promise<EditorPersonaRecord> {
      const current = (await entityService.findOne(EDITOR_PERSONA_UID, id, {
        populate: PERSONA_POPULATE,
      })) as EditorPersonaRecord | null;

      if (!current) {
        throw new Error(`Nie znaleziono persony #${id}.`);
      }

      const data: Record<string, unknown> = {};

      if (typeof payload.name !== 'undefined') {
        if (!payload.name.trim()) {
          throw new Error('Persona musi mieć nazwę.');
        }
        data.name = payload.name.trim();
      }

      if (typeof payload.key !== 'undefined') {
        data.key = payload.key?.trim() || undefined;
      }

      if (typeof payload.byline !== 'undefined') {
        data.byline = payload.byline?.trim() || null;
      }

      if (typeof payload.bio !== 'undefined') {
        data.bio = payload.bio?.trim() || null;
      }

      if (typeof payload.specialization !== 'undefined') {
        data.specialization = payload.specialization?.trim() || null;
      }

      if (typeof payload.avatar !== 'undefined') {
        data.avatar = payload.avatar;
      }

      if (typeof payload.temperament !== 'undefined') {
        data.temperament = payload.temperament?.trim() || null;
      }

      if (typeof payload.writing_style !== 'undefined') {
        data.writing_style = payload.writing_style ?? null;
      }

      if (typeof payload.system_instruction !== 'undefined') {
        data.system_instruction = payload.system_instruction?.trim() || null;
      }

      if (typeof payload.prompt_prefix !== 'undefined') {
        data.prompt_prefix = payload.prompt_prefix?.trim() || null;
      }

      if (typeof payload.prompt_suffix !== 'undefined') {
        data.prompt_suffix = payload.prompt_suffix?.trim() || null;
      }

      if (typeof payload.llm_model !== 'undefined') {
        data.llm_model = payload.llm_model?.trim() || null;
      }

      if (typeof payload.temperature !== 'undefined') {
        data.temperature =
          typeof payload.temperature === 'number'
            ? clampTemperature(payload.temperature)
            : null;
      }

      if (typeof payload.enabled_for !== 'undefined') {
        data.enabled_for = payload.enabled_for ?? null;
      }

      if (typeof payload.active !== 'undefined') {
        data.active = payload.active;
      }

      if (typeof payload.priority !== 'undefined') {
        data.priority =
          typeof payload.priority === 'number' ? Math.floor(payload.priority) : null;
      }

      const updated = (await entityService.update(EDITOR_PERSONA_UID, id, {
        data,
        populate: PERSONA_POPULATE,
      })) as EditorPersonaRecord;

      return updated;
    },

    async remove(id: number): Promise<void> {
      await entityService.delete(EDITOR_PERSONA_UID, id);
    },

    async resolveForTopic(personaRef: string | number): Promise<EditorPersonaRecord | null> {
      if (typeof personaRef === 'number') {
        return this.getById(personaRef);
      }

      if (typeof personaRef === 'string') {
        const trimmed = personaRef.trim();

        if (!trimmed) {
          return null;
        }

        const numeric = Number(trimmed);

        if (Number.isInteger(numeric) && /^\d+$/.test(trimmed)) {
          return this.getById(numeric);
        }

        return this.getByKey(trimmed);
      }

      return null;
    },
  };
};

export default personas;
