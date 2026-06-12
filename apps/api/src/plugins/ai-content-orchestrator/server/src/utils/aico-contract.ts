import fs from 'node:fs';
import path from 'node:path';

type AicoContentContract = {
  prompts: Record<string, string>;
};

let cachedContract: AicoContentContract | null = null;

const CONTRACT_FILENAME = 'aico-content-contract.json';

const unique = (values: string[]): string[] => Array.from(new Set(values));

export const getAicoContractCandidates = (): string[] =>
  unique([
    path.resolve(__dirname, '../../../../../bootstrap', CONTRACT_FILENAME),
    path.resolve(__dirname, '../../../../../../src/bootstrap', CONTRACT_FILENAME),
    path.resolve(__dirname, '../../../../../../dist/src/bootstrap', CONTRACT_FILENAME),
    path.resolve(process.cwd(), 'src/bootstrap', CONTRACT_FILENAME),
    path.resolve(process.cwd(), 'apps/api/src/bootstrap', CONTRACT_FILENAME),
    path.resolve(process.cwd(), 'dist/src/bootstrap', CONTRACT_FILENAME),
  ]);

export const resolveAicoContentContractPath = (): string | null =>
  getAicoContractCandidates().find((candidate) => fs.existsSync(candidate)) ?? null;

export const getAicoContentContract = (): AicoContentContract => {
  if (cachedContract) return cachedContract;

  const filePath = resolveAicoContentContractPath();
  if (!filePath) {
    throw new Error('AICO content contract file not found.');
  }

  cachedContract = JSON.parse(fs.readFileSync(filePath, 'utf8')) as AicoContentContract;
  return cachedContract;
};

export const getAicoPromptTemplate = (key: string): string => {
  const template = getAicoContentContract().prompts[key];
  if (!template) {
    throw new Error(`AICO prompt template "${key}" not found.`);
  }
  return template;
};

export const renderAicoPromptTemplate = (
  template: string,
  values: Record<string, string | number | null | undefined>
): string => template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => String(values[key] ?? ''));
