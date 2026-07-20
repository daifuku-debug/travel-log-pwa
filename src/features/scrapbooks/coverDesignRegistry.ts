import type { Scrapbook, ScrapbookCoverLayout, ScrapbookThemeId } from '../../domain/models/scrapbook';

export type CoverTitlePosition = 'bottom-left' | 'center' | 'bottom-right';

export interface CoverTemplateDefinition {
  id: ScrapbookCoverLayout;
  name: string;
  description: string;
  previewVariant: string;
  defaultTitlePosition: CoverTitlePosition;
  capabilities: {
    photo: boolean;
    subtitle: boolean;
    metadata: boolean;
    titlePositions: readonly CoverTitlePosition[];
  };
}

export interface CoverThemeDefinition {
  id: ScrapbookThemeId;
  name: string;
  description: string;
  swatches: readonly [string, string, string];
  previewText: string;
}

const ALL_TITLE_POSITIONS: readonly CoverTitlePosition[] = ['bottom-left', 'center', 'bottom-right'];

export const COVER_TEMPLATES: readonly CoverTemplateDefinition[] = [
  {
    id: 'magazine',
    name: 'Magazine',
    description: '旅雑誌らしい見出しと端正な余白',
    previewVariant: 'magazine',
    defaultTitlePosition: 'bottom-left',
    capabilities: { photo: true, subtitle: true, metadata: true, titlePositions: ALL_TITLE_POSITIONS },
  },
  {
    id: 'photo',
    name: 'Photo Full',
    description: '一枚の写真を大きく見せる表紙',
    previewVariant: 'photo',
    defaultTitlePosition: 'bottom-left',
    capabilities: { photo: true, subtitle: true, metadata: true, titlePositions: ALL_TITLE_POSITIONS },
  },
  {
    id: 'journal',
    name: 'Journal',
    description: '静かな線と文字で綴る旅日記',
    previewVariant: 'journal',
    defaultTitlePosition: 'bottom-left',
    capabilities: { photo: true, subtitle: true, metadata: true, titlePositions: ALL_TITLE_POSITIONS },
  },
] as const;

export const COVER_THEMES: readonly CoverThemeDefinition[] = [
  { id: 'classic', name: 'Classic', description: '端正で落ち着いた旅行誌', swatches: ['#f7f4ed', '#246f68', '#182326'], previewText: 'TRAVEL' },
  { id: 'journal', name: 'Journal', description: '温もりのある旅の日記', swatches: ['#f6f0e4', '#8a5c35', '#2b211b'], previewText: 'Journal' },
  { id: 'minimal', name: 'Minimal', description: '写真と余白を引き立てる構成', swatches: ['#fbfbfa', '#176d68', '#172022'], previewText: 'journey' },
  { id: 'adventure', name: 'Adventure', description: '自然の気配を感じる色調', swatches: ['#f1f3e9', '#2d7053', '#1d2923'], previewText: 'EXPLORE' },
] as const;

export function resolveCoverTemplateId(value: unknown): ScrapbookCoverLayout {
  return COVER_TEMPLATES.some((template) => template.id === value)
    ? value as ScrapbookCoverLayout
    : 'journal';
}

export function resolveScrapbookCoverTemplateId(scrapbook: Scrapbook): ScrapbookCoverLayout {
  const candidate = scrapbook.userEditedFields?.includes('coverLayout')
    ? scrapbook.coverLayout
    : scrapbook.layoutVariant ?? scrapbook.coverSettings?.layout ?? scrapbook.coverLayout;
  return resolveCoverTemplateId(candidate);
}

export function getCoverTemplateDefinition(value: unknown): CoverTemplateDefinition {
  const id = resolveCoverTemplateId(value);
  return COVER_TEMPLATES.find((template) => template.id === id) ?? COVER_TEMPLATES[2];
}

export function resolveCoverTitlePosition(
  templateId: unknown,
  value: unknown,
): CoverTitlePosition {
  const template = getCoverTemplateDefinition(templateId);
  return template.capabilities.titlePositions.includes(value as CoverTitlePosition)
    ? value as CoverTitlePosition
    : template.defaultTitlePosition;
}
