import type { EntityId } from '../../domain/models/common';
import type {
  Scrapbook,
  ScrapbookCoverLayout,
  ScrapbookPage,
  ScrapbookThemeId,
} from '../../domain/models/scrapbook';
import { resolveCoverTitlePosition, resolveScrapbookCoverTemplateId } from './coverDesignRegistry.ts';

export interface ScrapbookPageDraft {
  pageId: string;
  pageTitle: string;
  isHidden: boolean;
  coverTitle: string;
  coverSubtitle: string;
  coverPhotoId?: EntityId;
  coverShowDate: boolean;
  coverShowLocation: boolean;
  coverShowSubtitle: boolean;
  coverTitlePosition: string;
  coverLayout: ScrapbookCoverLayout;
  coverThemeId: ScrapbookThemeId;
}

export function createScrapbookPageDraft(
  page: ScrapbookPage,
  scrapbook: Scrapbook,
): ScrapbookPageDraft {
  const coverLayout = resolveScrapbookCoverTemplateId(scrapbook);
  return {
    pageId: page.id,
    pageTitle: page.title,
    isHidden: page.isHidden ?? false,
    coverTitle: scrapbook.title,
    coverSubtitle: scrapbook.subtitle ?? '',
    coverPhotoId: scrapbook.coverSettings?.photoId ?? scrapbook.coverAssetId,
    coverShowDate: scrapbook.coverSettings?.showDate !== false,
    coverShowLocation: scrapbook.coverSettings?.showLocation !== false,
    coverShowSubtitle: scrapbook.coverSettings?.showSubtitle !== false,
    coverTitlePosition: resolveCoverTitlePosition(coverLayout, scrapbook.coverSettings?.titlePosition),
    coverLayout,
    coverThemeId: scrapbook.themeId,
  };
}

export function isScrapbookPageDraftDirty(
  draft: ScrapbookPageDraft,
  page: ScrapbookPage,
  scrapbook: Scrapbook,
): boolean {
  const coverLayout = resolveScrapbookCoverTemplateId(scrapbook);
  return draft.pageTitle !== page.title
    || draft.isHidden !== (page.isHidden ?? false)
    || (page.pageKind === 'cover' && (
      draft.coverTitle !== scrapbook.title
      || draft.coverSubtitle !== (scrapbook.subtitle ?? '')
      || draft.coverPhotoId !== (scrapbook.coverSettings?.photoId ?? scrapbook.coverAssetId)
      || draft.coverShowDate !== (scrapbook.coverSettings?.showDate !== false)
      || draft.coverShowLocation !== (scrapbook.coverSettings?.showLocation !== false)
      || draft.coverShowSubtitle !== (scrapbook.coverSettings?.showSubtitle !== false)
      || draft.coverTitlePosition !== resolveCoverTitlePosition(coverLayout, scrapbook.coverSettings?.titlePosition)
      || draft.coverLayout !== coverLayout
      || draft.coverThemeId !== scrapbook.themeId
    ));
}

export function areScrapbookPageDraftsEqual(
  left: ScrapbookPageDraft,
  right: ScrapbookPageDraft,
): boolean {
  return left.pageId === right.pageId
    && left.pageTitle === right.pageTitle
    && left.isHidden === right.isHidden
    && left.coverTitle === right.coverTitle
    && left.coverSubtitle === right.coverSubtitle
    && left.coverPhotoId === right.coverPhotoId
    && left.coverShowDate === right.coverShowDate
    && left.coverShowLocation === right.coverShowLocation
    && left.coverShowSubtitle === right.coverShowSubtitle
    && left.coverTitlePosition === right.coverTitlePosition
    && left.coverLayout === right.coverLayout
    && left.coverThemeId === right.coverThemeId;
}

export function applyScrapbookPageDraft<T extends ScrapbookPage>(
  page: T,
  draft: ScrapbookPageDraft,
): T {
  return {
    ...page,
    title: draft.pageTitle,
    isHidden: false,
  };
}

export function applyScrapbookCoverDraft(
  scrapbook: Scrapbook,
  draft: ScrapbookPageDraft,
): Scrapbook {
  return {
    ...scrapbook,
    title: draft.coverTitle,
    subtitle: draft.coverSubtitle || undefined,
    coverSettings: {
      ...scrapbook.coverSettings,
      photoId: draft.coverPhotoId,
      showDate: draft.coverShowDate,
      showLocation: draft.coverShowLocation,
      showSubtitle: draft.coverShowSubtitle,
      titlePosition: draft.coverTitlePosition,
    },
    coverLayout: draft.coverLayout,
    themeId: draft.coverThemeId,
    userEditedFields: [...new Set([
      ...(scrapbook.userEditedFields ?? []),
      'coverSettings',
      'coverLayout',
      'themeId',
    ])],
  };
}
