import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { BlobReader, BlobWriter, TextReader, TextWriter, ZipReader, ZipWriter } from '@zip.js/zip.js';

import {
  calculateJapanConquestSummary,
  filterPrefectureViews,
  mergePrefectureViews,
  resolveStatus,
} from '../src/features/japanConquest/japanConquestLogic.ts';
import { BACKUP_SCHEMA_VERSION, normalizeBackupPayload } from '../src/features/backup/backupSchema.ts';
import {
  FULL_BACKUP_PACKAGE_VERSION,
  findDuplicateBackupPaths,
  validateFullBackupPackage,
} from '../src/features/backup/fullBackupPackage.ts';
import {
  buildFullBackupPackageFromSnapshot,
  estimateFullBackupFromSnapshot,
} from '../src/features/backup/fullBackupService.ts';
import {
  filterCoverAssetsForScrapbook,
  filterTripMediaAssets,
  isCoverAssetAvailableToScrapbook,
  isCoverOnlyMediaAsset,
  isTripMediaAsset,
  normalizeMediaAsset,
  normalizeMediaAssetOwnership,
  normalizeMediaAssetUsage,
} from '../src/domain/media/mediaAssetUsage.ts';
import { normalizeMediaAssetContentHash } from '../src/domain/media/mediaAssetContentHash.ts';
import {
  buildMediaIntegrityReport,
  MEDIA_INTEGRITY_ISSUE_TYPES,
} from '../src/domain/media/mediaIntegrity.ts';
import {
  collectMediaAssetReferencesFromScrapbookGraph,
  findBlockMediaAssetReferences,
  findScrapbookMediaAssetReferences,
  summarizeMediaAssetReferences,
} from '../src/domain/media/mediaAssetReferences.ts';
import {
  detachMediaAssetFromBlock,
  detachMediaAssetFromScrapbook,
  groupMediaAssetReferences,
} from '../src/domain/media/mediaAssetReferenceDetachment.ts';
import {
  collectScrapbookMediaAssetIds,
  mergeGeneratedScrapbookFields,
} from '../src/features/scrapbooks/scrapbookRevision.ts';
import { sortVisibleScrapbookPages } from '../src/features/scrapbooks/scrapbookPageLogic.ts';
import {
  applyScrapbookCoverDraft,
  applyScrapbookPageDraft,
  areScrapbookPageDraftsEqual,
  createScrapbookPageDraft,
  isScrapbookPageDraftDirty,
} from '../src/features/scrapbooks/scrapbookEditorDraft.ts';
import {
  COVER_TEMPLATES,
  getCoverTemplateDefinition,
  resolveCoverTemplateId,
  resolveCoverTitlePosition,
} from '../src/features/scrapbooks/coverDesignRegistry.ts';
import { resolveScrapbookCoverPhotoId } from '../src/features/scrapbooks/scrapbookCoverLogic.ts';
import {
  MAX_MEDIA_FILE_BYTES,
  prepareMediaImage,
  validateImageFile,
} from '../src/features/media/mediaAssetValidation.ts';
import { persistPreparedTripMediaAsset } from '../src/features/media/mediaAssetPersistence.ts';
import { webCryptoContentHasher } from '../src/features/media/contentHasher.ts';
import { findExactDuplicateMediaAssetsWithDependencies } from '../src/features/media/mediaAssetDuplicateLogic.ts';
import { findMediaAssetReferencesWithDependencies } from '../src/features/media/mediaAssetReferenceLogic.ts';
import {
  detachMediaAssetReferencesWithDependencies,
  MediaAssetReferenceDetachmentError,
} from '../src/features/media/mediaAssetReferenceDetachmentLogic.ts';
import {
  MediaIntegrityScanError,
  scanMediaAssetIntegrityWithDependencies,
} from '../src/features/media/mediaIntegrityLogic.ts';
import {
  getMediaIntegrityRepairAction,
  repairMediaIntegrityIssueWithDependencies,
  repairMediaIntegrityIssuesWithDependencies,
} from '../src/features/media/mediaIntegrityRepairLogic.ts';
import {
  deleteUnreferencedMediaAssetWithDependencies,
  MediaAssetDeletionError,
} from '../src/features/media/mediaAssetDeletionLogic.ts';
import { calculateLevelProgress, expRequiredForNextLevel } from '../src/features/rpg/rpgLevel.ts';
import {
  dateInputToIsoDateTime,
  dateTimeInputToIsoDateTime,
  isoDateTimeToDateInput,
  isoDateTimeToTimeInput,
} from '../src/shared/date/dateUtils.ts';
import {
  buildPlaceVisitDateTimeFields,
  createArrivalNowInput,
  createDepartureNowInput,
  findInProgressPlaceVisits,
  formatPlaceVisitTimeRange,
  getPlaceVisitDate,
  isPlaceVisitInProgress,
  validatePlaceVisitDateTimeInput,
} from '../src/features/trips/placeVisitDateTime.ts';
import {
  buildTransportLegDateTimeFields,
  createTransportArrivalNowInput,
  createTransportDepartureNowInput,
  findInProgressTransportLegs,
  formatTransportLegTimeRange,
  formatTransportLegTitle,
  getTransportLegArrivalDate,
  getTransportLegDepartureDate,
  isTransportLegInProgress,
  validateTransportLegDateTimeInput,
} from '../src/features/trips/transportLegDateTime.ts';
import {
  buildLinkedArrivalRecords,
  buildExplicitLinkedArrivalRecords,
  buildExplicitNewPlaceArrivalRecords,
  buildNewPlaceArrivalRecords,
  buildPlaceFromCompletedTransportRecords,
  isReverseTransportArrivalCandidate,
  isTransportDestinationUnregistered,
  resolveTransportArrivalVisitCandidate,
} from '../src/features/trips/tripArrivalLink.ts';
import { buildDepartureAndTransportRecords, buildStayEndRecord, resolveCurrentTripActivity } from '../src/features/trips/currentTripActivity.ts';
import { parseTripDetailEditorTarget, setTripDetailEditorTarget } from '../src/features/trips/tripDetailEditor.ts';
import { resolveTripLiveRecordingAvailability } from '../src/features/trips/tripLiveRecording.ts';
import { createEditorSaveErrorMessage } from '../src/features/trips/editorSaveError.ts';
import {
  buildQuickTravelRecordFields,
  createHistoricalQuickTravelRecordInput,
  createQuickTravelRecordInput,
  formatQuickTravelRecordDetail,
  formatQuickTravelRecordTitle,
  validateQuickTravelRecordTripDate,
  validateQuickTravelRecordInput,
} from '../src/features/trips/quickTravelRecord.ts';
import { getConditionValue } from '../src/features/rpg/rpgCondition.ts';
import { buildTravelStats } from '../src/features/rpg/rpgStats.ts';
import {
  buildCastleSummaryFromInput,
  calculateCastleStats,
  createEmptyCastleSummary,
  filterCastleRows,
  mergeCastleRows,
} from '../src/features/castles/castleLogic.ts';

const master = JSON.parse(await readFile(new URL('../src/domain/prefectures/prefectureMaster.json', import.meta.url), 'utf8'));
const castleMasterPayload = JSON.parse(await readFile(new URL('../src/domain/castles/castleMaster.json', import.meta.url), 'utf8'));
const castleMaster = castleMasterPayload.castles;
const achievementMaster = JSON.parse(await readFile(new URL('../src/domain/rpg/achievementMaster.json', import.meta.url), 'utf8'));
const titleMaster = JSON.parse(await readFile(new URL('../src/domain/rpg/titleMaster.json', import.meta.url), 'utf8'));
const questMaster = JSON.parse(await readFile(new URL('../src/domain/rpg/questMaster.json', import.meta.url), 'utf8'));
const experienceRules = JSON.parse(await readFile(new URL('../src/domain/rpg/experienceRules.json', import.meta.url), 'utf8'));
const geoJson = JSON.parse(await readFile(new URL('../public/maps/japan-prefectures.geojson', import.meta.url), 'utf8'));
const mapComponent = await readFile(new URL('../src/features/japanConquest/components/JapanGeoMap.tsx', import.meta.url), 'utf8');
const sw = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
const localRepository = await readFile(new URL('../src/infrastructure/localDb/LocalPrefectureRepository.ts', import.meta.url), 'utf8');
const conquestLogic = await readFile(new URL('../src/features/japanConquest/japanConquestLogic.ts', import.meta.url), 'utf8');
const tripService = await readFile(new URL('../src/features/trips/tripService.ts', import.meta.url), 'utf8');
const tripModel = await readFile(new URL('../src/domain/models/trip.ts', import.meta.url), 'utf8');
const tripRepository = await readFile(new URL('../src/domain/repositories/TripRepository.ts', import.meta.url), 'utf8');
const transportLegForm = await readFile(new URL('../src/features/trips/components/TransportLegForm.tsx', import.meta.url), 'utf8');
const rpgProgressService = await readFile(new URL('../src/features/rpg/rpgProgressService.ts', import.meta.url), 'utf8');
const rpgProfilePage = await readFile(new URL('../src/pages/RpgProfilePage.tsx', import.meta.url), 'utf8');
const collectionService = await readFile(new URL('../src/features/collections/collectionService.ts', import.meta.url), 'utf8');
const collectionPage = await readFile(new URL('../src/pages/CollectionPage.tsx', import.meta.url), 'utf8');
const wishlistService = await readFile(new URL('../src/features/wishlist/wishlistService.ts', import.meta.url), 'utf8');
const wishlistPage = await readFile(new URL('../src/pages/WishlistPage.tsx', import.meta.url), 'utf8');
const castleService = await readFile(new URL('../src/features/castles/castleService.ts', import.meta.url), 'utf8');
const castlePage = await readFile(new URL('../src/pages/CastleCollectionPage.tsx', import.meta.url), 'utf8');
const castleDocs = await readFile(new URL('../docs/castle-data.md', import.meta.url), 'utf8');
const placeVisitForm = await readFile(new URL('../src/features/trips/components/PlaceVisitForm.tsx', import.meta.url), 'utf8');
const quickPlaceVisit = await readFile(new URL('../src/features/trips/components/QuickPlaceVisit.tsx', import.meta.url), 'utf8');
const quickTransportLeg = await readFile(new URL('../src/features/trips/components/QuickTransportLeg.tsx', import.meta.url), 'utf8');
const currentTripActivitySource = await readFile(new URL('../src/features/trips/components/CurrentTripActivity.tsx', import.meta.url), 'utf8');
const currentTripActivityServiceSource = await readFile(new URL('../src/features/trips/currentTripActivityService.ts', import.meta.url), 'utf8');
const quickTravelRecordSource = await readFile(new URL('../src/features/trips/components/QuickTravelRecord.tsx', import.meta.url), 'utf8');
const quickTravelRecordServiceSource = await readFile(new URL('../src/features/trips/quickTravelRecordService.ts', import.meta.url), 'utf8');
const tripArrivalLinkService = await readFile(new URL('../src/features/trips/tripArrivalLinkService.ts', import.meta.url), 'utf8');
const tripArrivalLinkDataSource = await readFile(new URL('../src/infrastructure/localDb/tripArrivalLinkDataSource.ts', import.meta.url), 'utf8');
const updateCastleMasterScript = await readFile(new URL('../scripts/update-castle-master.mjs', import.meta.url), 'utf8');
const scrapbookModel = await readFile(new URL('../src/domain/models/scrapbook.ts', import.meta.url), 'utf8');
const scrapbookService = await readFile(new URL('../src/features/scrapbooks/scrapbookService.ts', import.meta.url), 'utf8');
const mediaAssetServiceSource = await readFile(new URL('../src/features/media/mediaAssetService.ts', import.meta.url), 'utf8');
const mediaAssetValidationSource = await readFile(new URL('../src/features/media/mediaAssetValidation.ts', import.meta.url), 'utf8');
const mediaAssetPersistenceSource = await readFile(new URL('../src/features/media/mediaAssetPersistence.ts', import.meta.url), 'utf8');
const backupServiceSource = await readFile(new URL('../src/features/backup/backupService.ts', import.meta.url), 'utf8');
const fullBackupServiceSource = await readFile(new URL('../src/features/backup/fullBackupService.ts', import.meta.url), 'utf8');
const fullBackupPanelSource = await readFile(new URL('../src/features/backup/FullBackupPanel.tsx', import.meta.url), 'utf8');
const coverPhotoImportSource = await readFile(new URL('../src/features/scrapbooks/useCoverPhotoImport.ts', import.meta.url), 'utf8');
const coverPhotoPanelSource = await readFile(new URL('../src/features/scrapbooks/components/CoverPhotoPanel.tsx', import.meta.url), 'utf8');
const mediaDeleteDialogSource = await readFile(new URL('../src/features/scrapbooks/components/MediaDeleteDialog.tsx', import.meta.url), 'utf8');
const mediaAssetDeletionServiceSource = await readFile(new URL('../src/features/media/mediaAssetDeletionService.ts', import.meta.url), 'utf8');
const mediaAssetReferenceDetachmentServiceSource = await readFile(new URL('../src/features/media/mediaAssetReferenceDetachmentService.ts', import.meta.url), 'utf8');
const mediaIntegrityDataSourceSource = await readFile(new URL('../src/infrastructure/localDb/mediaIntegrityDataSource.ts', import.meta.url), 'utf8');
const mediaIntegrityServiceSource = await readFile(new URL('../src/features/media/mediaIntegrityService.ts', import.meta.url), 'utf8');
const mediaIntegrityRepairDataSourceSource = await readFile(new URL('../src/infrastructure/localDb/mediaIntegrityRepairDataSource.ts', import.meta.url), 'utf8');
const mediaIntegrityPanelSource = await readFile(new URL('../src/features/media/components/MediaIntegrityPanel.tsx', import.meta.url), 'utf8');
const settingsPageSource = await readFile(new URL('../src/pages/SettingsPage.tsx', import.meta.url), 'utf8');
const duplicatePhotoReviewSource = await readFile(new URL('../src/features/scrapbooks/components/DuplicatePhotoReview.tsx', import.meta.url), 'utf8');
const scrapbookPage = await readFile(new URL('../src/pages/ScrapbookPage.tsx', import.meta.url), 'utf8');
const localScrapbookRepository = await readFile(new URL('../src/infrastructure/localDb/LocalScrapbookRepository.ts', import.meta.url), 'utf8');
const localDbSource = await readFile(new URL('../src/infrastructure/localDb/db.ts', import.meta.url), 'utf8');
const timeMachineModel = await readFile(new URL('../src/domain/models/timeMachine.ts', import.meta.url), 'utf8');
const timeMachineService = await readFile(new URL('../src/features/timeMachine/timeMachineService.ts', import.meta.url), 'utf8');
const locationInferenceService = await readFile(new URL('../src/features/timeMachine/locationInferenceService.ts', import.meta.url), 'utf8');
const timeMachinePage = await readFile(new URL('../src/pages/TimeMachinePage.tsx', import.meta.url), 'utf8');
const localTimeMachineRepository = await readFile(new URL('../src/infrastructure/localDb/LocalTimeMachineRepository.ts', import.meta.url), 'utf8');
const routerSource = await readFile(new URL('../src/app/router.tsx', import.meta.url), 'utf8');
const tripDetailPage = await readFile(new URL('../src/pages/TripDetailPage.tsx', import.meta.url), 'utf8');
const tripJournalMediaHook = await readFile(new URL('../src/features/trips/useTripJournalMedia.ts', import.meta.url), 'utf8');
const tripJournalVisual = await readFile(new URL('../src/features/trips/components/TripJournalVisual.tsx', import.meta.url), 'utf8');
const tripJournalTimeline = await readFile(new URL('../src/features/trips/components/TripJournalTimeline.tsx', import.meta.url), 'utf8');
const travelGachaModel = await readFile(new URL('../src/domain/models/travelGacha.ts', import.meta.url), 'utf8');
const travelGachaService = await readFile(new URL('../src/features/travelGacha/travelGachaService.ts', import.meta.url), 'utf8');
const travelGachaPage = await readFile(new URL('../src/pages/TravelGachaPage.tsx', import.meta.url), 'utf8');
const localTravelGachaRepository = await readFile(new URL('../src/infrastructure/localDb/LocalTravelGachaRepository.ts', import.meta.url), 'utf8');
const stylesSource = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8');
const indexHtml = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const githubPages404Source = await readFile(new URL('../public/404.html', import.meta.url), 'utf8');
const spaFallbackSource = await readFile(new URL('../public/spa-fallback.js', import.meta.url), 'utf8');
const manifestSource = await readFile(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8');
const spaFallbackContext = { URL, URLSearchParams };
runInNewContext(spaFallbackSource, spaFallbackContext);
const spaFallback = spaFallbackContext.TravelLogSpaFallback;
const appLayoutSource = await readFile(new URL('../src/shared/layout/AppLayout.tsx', import.meta.url), 'utf8');
const bottomNavigationSource = await readFile(new URL('../src/shared/navigation/BottomNavigation.tsx', import.meta.url), 'utf8');
const navigationItemsSource = await readFile(new URL('../src/shared/navigation/navigationItems.tsx', import.meta.url), 'utf8');
const buttonSource = await readFile(new URL('../src/shared/ui/Button.tsx', import.meta.url), 'utf8');
const cardSource = await readFile(new URL('../src/shared/ui/Card.tsx', import.meta.url), 'utf8');
const badgeSource = await readFile(new URL('../src/shared/ui/Badge.tsx', import.meta.url), 'utf8');
const pageHeaderSource = await readFile(new URL('../src/shared/ui/PageHeader.tsx', import.meta.url), 'utf8');
const skeletonSource = await readFile(new URL('../src/shared/ui/Skeleton.tsx', import.meta.url), 'utf8');
const inlineErrorSource = await readFile(new URL('../src/shared/ui/InlineError.tsx', import.meta.url), 'utf8');
const pageStateSource = await readFile(new URL('../src/shared/components/PageState.tsx', import.meta.url), 'utf8');
const tripsPageSource = await readFile(new URL('../src/pages/TripsPage.tsx', import.meta.url), 'utf8');
const morePageSource = await readFile(new URL('../src/pages/MorePage.tsx', import.meta.url), 'utf8');
const tripUiSource = await readFile(new URL('../src/features/trips/tripUi.ts', import.meta.url), 'utf8');
const scrapbookCoverSource = await readFile(new URL('../src/features/scrapbooks/components/ScrapbookCover.tsx', import.meta.url), 'utf8');
const scrapbookPageNavigationSource = await readFile(new URL('../src/features/scrapbooks/components/ScrapbookPageNavigation.tsx', import.meta.url), 'utf8');
const scrapbookViewerSource = await readFile(new URL('../src/features/scrapbooks/components/ScrapbookViewer.tsx', import.meta.url), 'utf8');
const scrapbookEditorSource = await readFile(new URL('../src/features/scrapbooks/components/ScrapbookEditor.tsx', import.meta.url), 'utf8');
const scrapbookCoverLogicSource = await readFile(new URL('../src/features/scrapbooks/scrapbookCoverLogic.ts', import.meta.url), 'utf8');
const coverDesignRegistrySource = await readFile(new URL('../src/features/scrapbooks/coverDesignRegistry.ts', import.meta.url), 'utf8');
const coverEditorPanelSource = await readFile(new URL('../src/features/scrapbooks/components/CoverEditorPanel.tsx', import.meta.url), 'utf8');
const coverEditorStudioSource = await readFile(new URL('../src/features/scrapbooks/components/CoverEditorStudio.tsx', import.meta.url), 'utf8');
const coverDesignPanelSource = await readFile(new URL('../src/features/scrapbooks/components/CoverDesignPanel.tsx', import.meta.url), 'utf8');
const scrapbookPageEditorSource = await readFile(new URL('../src/features/scrapbooks/components/PageEditorPanel.tsx', import.meta.url), 'utf8');
const scrapbookPageNavigatorSource = await readFile(new URL('../src/features/scrapbooks/components/PageNavigatorSheet.tsx', import.meta.url), 'utf8');
const scrapbookSaveBarSource = await readFile(new URL('../src/features/scrapbooks/components/SaveBar.tsx', import.meta.url), 'utf8');
const scrapbookMediaImageSource = await readFile(new URL('../src/features/scrapbooks/components/ScrapbookMediaImage.tsx', import.meta.url), 'utf8');
const navigationListItemSource = await readFile(new URL('../src/shared/ui/NavigationListItem.tsx', import.meta.url), 'utf8');
const formUiSource = await readFile(new URL('../src/shared/ui/Form.tsx', import.meta.url), 'utf8');
const progressBarSource = await readFile(new URL('../src/shared/ui/ProgressBar.tsx', import.meta.url), 'utf8');
const homePageSource = await readFile(new URL('../src/pages/HomePage.tsx', import.meta.url), 'utf8');
const homeLogicSource = await readFile(new URL('../src/features/home/homeLogic.ts', import.meta.url), 'utf8');
const homeServiceSource = await readFile(new URL('../src/features/home/homeService.ts', import.meta.url), 'utf8');
const tripMediaHookSource = await readFile(new URL('../src/features/home/useTripMedia.ts', import.meta.url), 'utf8');
const tripMediaSource = await readFile(new URL('../src/features/home/components/TripMedia.tsx', import.meta.url), 'utf8');
const tripHeroSource = await readFile(new URL('../src/features/home/components/TripHero.tsx', import.meta.url), 'utf8');
const tripPreviewCardSource = await readFile(new URL('../src/features/home/components/TripPreviewCard.tsx', import.meta.url), 'utf8');
const featureShortcutSource = await readFile(new URL('../src/features/home/components/FeatureShortcut.tsx', import.meta.url), 'utf8');
const japanMapPreviewSource = await readFile(new URL('../src/features/japanConquest/components/JapanMapPreview.tsx', import.meta.url), 'utf8');
const japanConquestPageSource = await readFile(new URL('../src/pages/JapanConquestPage.tsx', import.meta.url), 'utf8');
const prefectureDetailPanelSource = await readFile(new URL('../src/features/japanConquest/components/PrefectureDetailPanel.tsx', import.meta.url), 'utf8');
const tripEditPageSource = await readFile(new URL('../src/pages/TripEditPage.tsx', import.meta.url), 'utf8');
const tripFormSource = await readFile(new URL('../src/features/trips/components/TripForm.tsx', import.meta.url), 'utf8');
const bottomSheetSource = await readFile(new URL('../src/shared/ui/BottomSheet.tsx', import.meta.url), 'utf8');
const confirmDialogSource = await readFile(new URL('../src/shared/ui/ConfirmDialog.tsx', import.meta.url), 'utf8');
const toastSource = await readFile(new URL('../src/shared/ui/Toast.tsx', import.meta.url), 'utf8');
const toastContextSource = await readFile(new URL('../src/shared/ui/ToastContext.ts', import.meta.url), 'utf8');
const overlaySource = await readFile(new URL('../src/shared/ui/useOverlay.ts', import.meta.url), 'utf8');

async function test(name, fn) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

const expectedCodes = Array.from({ length: 47 }, (_, index) => String(index + 1).padStart(2, '0'));

await test('47都道府県のマスターが重複なく存在する', () => {
  assert.equal(master.length, 47);
  assert.equal(new Set(master.map((item) => item.code)).size, 47);
});

await test('都道府県コードが01〜47で揃っている', () => {
  assert.deepEqual([...master.map((item) => item.code)].sort(), expectedCodes);
});

await test('日本100名城と続日本100名城のマスターが200城重複なく存在する', () => {
  assert.equal(castleMaster.length, 200);
  assert.equal(new Set(castleMaster.map((item) => item.id)).size, 200);
  assert.equal(castleMaster.filter((item) => item.series === 'japanese_100_castles').length, 100);
  assert.equal(castleMaster.filter((item) => item.series === 'continued_japanese_100_castles').length, 100);
});

await test('城マスターの公式番号はシリーズごとに1〜100で揃っている', () => {
  const expectedCastleNumbers = Array.from({ length: 100 }, (_, index) => index + 1);
  for (const series of ['japanese_100_castles', 'continued_japanese_100_castles']) {
    assert.deepEqual(
      castleMaster.filter((item) => item.series === series).map((item) => item.officialNumber).sort((a, b) => a - b),
      expectedCastleNumbers,
    );
  }
});

await test('城マスターはJIS都道府県コードと紐付いている', () => {
  const validCodes = new Set(expectedCodes);
  assert.ok(castleMaster.every((castle) => validCodes.has(castle.prefectureCode)));
});

await test('城マスターの座標は未検証ならnull、値がある場合は範囲内', () => {
  for (const castle of castleMaster) {
    assert.ok(castle.latitude === null || (castle.latitude >= 20 && castle.latitude <= 46));
    assert.ok(castle.longitude === null || (castle.longitude >= 122 && castle.longitude <= 154));
  }
});

await test('城データの出典と利用方針をドキュメント化している', () => {
  assert.match(castleDocs, /公益財団法人日本城郭協会/);
  assert.match(castleDocs, /公式ロゴ、画像、スタンプ画像/);
  assert.match(castleDocs, /2026-07-18/);
});

await test('城マスター更新スクリプトが公式一覧を再取得する設計になっている', () => {
  assert.match(updateCastleMasterScript, /great-castles/);
  assert.match(updateCastleMasterScript, /great-castles-sequel/);
  assert.match(updateCastleMasterScript, /castles\.length !== 200/);
});

await test('地図データが47都道府県コードと紐付く', () => {
  const codes = geoJson.features
    .map((feature) => feature.properties?.shapeISO?.match(/^JP-(\d{2})$/)?.[1])
    .filter(Boolean)
    .sort();
  assert.equal(geoJson.features.length, 47);
  assert.deepEqual(codes, expectedCodes);
});

await test('状態優先順位はunvisited < passed < landed < visited < stayed < lived', () => {
  assert.equal(resolveStatus('passed', 'landed'), 'landed');
  assert.equal(resolveStatus('landed', 'visited'), 'visited');
  assert.equal(resolveStatus('stayed', 'visited'), 'stayed');
  assert.equal(resolveStatus('lived', 'stayed'), 'lived');
  assert.equal(resolveStatus('unvisited', 'passed'), 'passed');
});

await test('状態を保存しやすいよう都道府県コードを保存IDにしている', () => {
  assert.match(conquestLogic, /id:\s*prefectureCode/);
  assert.match(localRepository, /getById\(code\)/);
});

await test('訪問制覇率、宿泊制覇率、到達率の計算が正しい', () => {
  const visits = [
    { prefectureCode: '01', status: 'passed', manualStatus: 'passed', calculatedStatus: 'unvisited' },
    { prefectureCode: '02', status: 'landed', manualStatus: 'landed', calculatedStatus: 'unvisited' },
    { prefectureCode: '03', status: 'visited', manualStatus: 'visited', calculatedStatus: 'unvisited' },
    { prefectureCode: '04', status: 'stayed', manualStatus: 'stayed', calculatedStatus: 'unvisited' },
    { prefectureCode: '05', status: 'lived', manualStatus: 'lived', calculatedStatus: 'unvisited' },
  ];
  const views = mergePrefectureViews(master, visits);
  const summary = calculateJapanConquestSummary(views);
  assert.equal(summary.visitedCount, 3);
  assert.equal(summary.stayedCount, 2);
  assert.equal(summary.livedCount, 1);
  assert.equal(summary.passedOnlyCount, 1);
  assert.equal(summary.landedOnlyCount, 1);
  assert.equal(summary.unvisitedCount, 42);
  assert.equal(summary.visitRate, 6.4);
  assert.equal(summary.stayRate, 4.3);
  assert.equal(summary.livedRate, 2.1);
  assert.equal(summary.reachedRate, 10.6);
});

await test('passedとlandedは通常の訪問制覇率へ含まれない', () => {
  const views = mergePrefectureViews(master, [
    { prefectureCode: '01', status: 'passed', manualStatus: 'passed', calculatedStatus: 'unvisited' },
    { prefectureCode: '02', status: 'landed', manualStatus: 'landed', calculatedStatus: 'unvisited' },
  ]);
  const summary = calculateJapanConquestSummary(views);
  assert.equal(summary.visitedCount, 0);
  assert.equal(summary.visitRate, 0);
  assert.equal(summary.passedOnlyCount, 1);
  assert.equal(summary.landedOnlyCount, 1);
});

await test('地方別と状態別フィルターが正しく動く', () => {
  const views = mergePrefectureViews(master, [
    { prefectureCode: '13', status: 'visited', manualStatus: 'visited', calculatedStatus: 'unvisited' },
    { prefectureCode: '27', status: 'stayed', manualStatus: 'stayed', calculatedStatus: 'unvisited' },
  ]);
  assert.equal(filterPrefectureViews(views, { region: 'kanto', status: 'all', favoriteOnly: false, query: '' }).length, 7);
  assert.equal(filterPrefectureViews(views, { region: 'all', status: 'visited', favoriteOnly: false, query: '' }).length, 1);
  assert.equal(filterPrefectureViews(views, { region: 'all', status: 'all', favoriteOnly: false, query: '東京' }).length, 1);
});

await test('JSONエクスポート/インポート形式で訪問情報が復元できる', () => {
  const normalized = normalizeBackupPayload({
    app: 'travel-log-pwa',
    schemaVersion: 2,
    exportedAt: '2026-07-18T00:00:00.000Z',
    data: {
      prefectureVisits: [{ id: '13', prefectureCode: '13', status: 'visited' }],
      tripPrefectureVisits: [{ id: 'link-1', tripId: 'trip-1', prefectureCode: '13' }],
    },
  });
  assert.equal(normalized.data.prefectureVisits[0].prefectureCode, '13');
  assert.equal(normalized.data.tripPrefectureVisits[0].tripId, 'trip-1');
});

await test('JSONエクスポート/インポートで城訪問情報が復元できる', () => {
  const normalized = normalizeBackupPayload({
    app: 'travel-log-pwa',
    schemaVersion: 4,
    exportedAt: '2026-07-18T00:00:00.000Z',
    data: {
      castleVisitSummaries: [
        {
          id: 'castle-j100-001',
          castleId: 'castle-j100-001',
          status: 'visited',
          visitCount: 1,
          stampStatus: 'acquired',
          goshuinStatus: 'unknown',
          isFavorite: true,
          relatedTripIds: [],
        },
      ],
      castleVisitEvents: [
        {
          id: 'castle-event-1',
          castleId: 'castle-j100-001',
          visitedAt: '2026-07-18',
          sourceKey: 'castle-visit:manual:castle-j100-001:1',
        },
      ],
    },
  });
  assert.equal(normalized.data.castleVisitSummaries[0].castleId, 'castle-j100-001');
  assert.equal(normalized.data.castleVisitEvents[0].sourceKey, 'castle-visit:manual:castle-j100-001:1');
});

await test('JSONエクスポート/インポートでスクラップブック情報が復元できる', () => {
  const normalized = normalizeBackupPayload({
    app: 'travel-log-pwa',
    schemaVersion: 5,
    data: {
      scrapbooks: [{ id: 'scrapbook-1', tripId: 'trip-1', title: '旅', status: 'draft', layoutMode: 'pages', themeId: 'journal' }],
      scrapbookPages: [{ id: 'page-1', scrapbookId: 'scrapbook-1', title: '表紙', sortOrder: 10, layoutType: 'cover' }],
      scrapbookBlocks: [{ id: 'block-1', pageId: 'page-1', type: 'text', sortOrder: 10, text: 'hello' }],
      mediaAssets: [{ id: 'asset-1', tripId: 'trip-1', storageType: 'local', mimeType: 'image/jpeg', mediaSyncStatus: 'local_only' }],
    },
  });
  assert.equal(normalized.data.scrapbooks.length, 1);
  assert.equal(normalized.data.scrapbookPages.length, 1);
  assert.equal(normalized.data.scrapbookBlocks.length, 1);
  assert.equal(normalized.data.mediaAssets.length, 1);
});

await test('MediaAsset用途は旧値と不正値を通常旅行写真へ正規化する', () => {
  assert.equal(normalizeMediaAssetUsage(undefined), 'trip');
  assert.equal(normalizeMediaAssetUsage('trip'), 'trip');
  assert.equal(normalizeMediaAssetUsage('future-usage'), 'trip');
  assert.equal(normalizeMediaAssetUsage('cover-only'), 'cover-only');

  const base = { id: 'asset-1', tripId: 'trip-1' };
  assert.deepEqual(normalizeMediaAssetOwnership(base), { ...base, usage: 'trip' });
  assert.deepEqual(
    normalizeMediaAssetOwnership({ ...base, usage: 'trip', ownerScrapbookId: 'scrapbook-1' }),
    { ...base, usage: 'trip' },
  );
  assert.deepEqual(
    normalizeMediaAssetOwnership({ ...base, usage: 'cover-only', ownerScrapbookId: '  ' }),
    { ...base, usage: 'trip' },
  );
  assert.deepEqual(
    normalizeMediaAssetOwnership({ ...base, usage: 'cover-only', ownerScrapbookId: ' scrapbook-1 ' }),
    { ...base, usage: 'cover-only', ownerScrapbookId: 'scrapbook-1' },
  );
});

await test('MediaAsset分類は表紙専用写真の所有Scrapbookを考慮する', () => {
  const legacy = { id: 'legacy', tripId: 'trip-1' };
  const trip = { id: 'trip-photo', tripId: 'trip-1', usage: 'trip' };
  const cover = { id: 'cover-photo', tripId: 'trip-1', usage: 'cover-only', ownerScrapbookId: 'scrapbook-1' };
  const invalidCover = { id: 'invalid-cover', tripId: 'trip-1', usage: 'cover-only' };

  assert.equal(isTripMediaAsset(legacy), true);
  assert.equal(isTripMediaAsset(trip), true);
  assert.equal(isTripMediaAsset(cover), false);
  assert.equal(isCoverOnlyMediaAsset(cover), true);
  assert.equal(isCoverOnlyMediaAsset(invalidCover), false);
  assert.equal(isCoverAssetAvailableToScrapbook(cover, 'scrapbook-1'), true);
  assert.equal(isCoverAssetAvailableToScrapbook(cover, 'scrapbook-2'), false);
  assert.equal(isCoverAssetAvailableToScrapbook(invalidCover, 'scrapbook-2'), true);
});

await test('用途別MediaAsset一覧は通常写真と所有する表紙専用写真を分離する', () => {
  const legacy = { id: 'legacy', tripId: 'trip-1' };
  const trip = { id: 'trip-photo', tripId: 'trip-1', usage: 'trip' };
  const ownCover = { id: 'own-cover', tripId: 'trip-1', usage: 'cover-only', ownerScrapbookId: 'scrapbook-1' };
  const otherCover = { id: 'other-cover', tripId: 'trip-1', usage: 'cover-only', ownerScrapbookId: 'scrapbook-2' };
  const assets = [legacy, trip, ownCover, otherCover];

  assert.deepEqual(filterTripMediaAssets(assets).map((asset) => asset.id), ['legacy', 'trip-photo']);
  assert.deepEqual(
    filterCoverAssetsForScrapbook(assets, 'scrapbook-1').map((asset) => asset.id),
    ['legacy', 'trip-photo', 'own-cover'],
  );
});

await test('MediaAsset contentHashはSHA-256形式だけを小文字で保持する', () => {
  const upperHash = `sha256:${'AB'.repeat(32)}`;
  assert.equal(normalizeMediaAssetContentHash(upperHash), `sha256:${'ab'.repeat(32)}`);
  assert.equal(normalizeMediaAssetContentHash(`sha256:${'a'.repeat(63)}`), undefined);
  assert.equal(normalizeMediaAssetContentHash(`sha256:${'g'.repeat(64)}`), undefined);
  assert.equal(normalizeMediaAssetContentHash(`sha1:${'a'.repeat(64)}`), undefined);
  assert.equal(normalizeMediaAssetContentHash(''), undefined);
  assert.equal(normalizeMediaAssetContentHash(undefined), undefined);
  assert.equal(normalizeMediaAsset({ id: 'asset', tripId: 'trip', contentHash: 'invalid' }).contentHash, undefined);
});

await test('Backup v12はMediaAsset用途とcontentHashを正規化して往復できる', () => {
  const payload = {
    app: 'travel-log-pwa',
    schemaVersion: 12,
    data: {
      scrapbooks: [{ id: 'scrapbook-1', tripId: 'trip-1', title: '旅', status: 'draft', layoutMode: 'pages', themeId: 'journal' }],
      mediaAssets: [
        { id: 'trip-photo', tripId: 'trip-1', usage: 'trip', ownerScrapbookId: 'ignored', contentHash: `sha256:${'AB'.repeat(32)}`, storageType: 'local', mimeType: 'image/jpeg', mediaSyncStatus: 'local_only' },
        { id: 'cover-photo', tripId: 'trip-1', usage: 'cover-only', ownerScrapbookId: 'scrapbook-1', storageType: 'local', mimeType: 'image/jpeg', mediaSyncStatus: 'local_only' },
      ],
    },
  };
  const normalized = normalizeBackupPayload(JSON.parse(JSON.stringify(payload)));
  assert.equal(BACKUP_SCHEMA_VERSION, 12);
  assert.equal(normalized.schemaVersion, 12);
  assert.equal(normalized.data.mediaAssets[0].usage, 'trip');
  assert.equal(normalized.data.mediaAssets[0].ownerScrapbookId, undefined);
  assert.equal(normalized.data.mediaAssets[0].contentHash, `sha256:${'ab'.repeat(32)}`);
  assert.equal(normalized.data.mediaAssets[1].usage, 'cover-only');
  assert.equal(normalized.data.mediaAssets[1].ownerScrapbookId, 'scrapbook-1');
});

await test('Backup v11は不正な表紙専用写真を通常旅行写真へ戻す', () => {
  const normalized = normalizeBackupPayload({
    app: 'travel-log-pwa',
    schemaVersion: 11,
    data: {
      scrapbooks: [{ id: 'scrapbook-1', tripId: 'trip-1', title: '旅', status: 'draft', layoutMode: 'pages', themeId: 'journal' }],
      mediaAssets: [
        { id: 'unknown', tripId: 'trip-1', usage: 'future', storageType: 'local', mimeType: 'image/jpeg', mediaSyncStatus: 'local_only' },
        { id: 'missing-owner', tripId: 'trip-1', usage: 'cover-only', storageType: 'local', mimeType: 'image/jpeg', mediaSyncStatus: 'local_only' },
        { id: 'orphan-owner', tripId: 'trip-1', usage: 'cover-only', ownerScrapbookId: 'missing', storageType: 'local', mimeType: 'image/jpeg', mediaSyncStatus: 'local_only' },
      ],
    },
  });
  assert.deepEqual(normalized.data.mediaAssets.map((asset) => asset.usage), ['trip', 'trip', 'trip']);
  assert.ok(normalized.data.mediaAssets.every((asset) => asset.ownerScrapbookId === undefined));
  assert.equal(normalized.schemaVersion, 12);
});

await test('Backup v12は不正contentHashを除去し、Hashなしの旧Backupを維持する', () => {
  const invalid = normalizeBackupPayload({
    app: 'travel-log-pwa',
    schemaVersion: 12,
    data: { mediaAssets: [{ id: 'invalid-hash', tripId: 'trip-1', contentHash: 'sha256:invalid', storageType: 'local', mimeType: 'image/jpeg', mediaSyncStatus: 'local_only' }] },
  });
  const legacy = normalizeBackupPayload({
    app: 'travel-log-pwa',
    schemaVersion: 11,
    data: { mediaAssets: [{ id: 'legacy', tripId: 'trip-1', storageType: 'local', mimeType: 'image/jpeg', mediaSyncStatus: 'local_only' }] },
  });
  assert.equal(invalid.data.mediaAssets[0].contentHash, undefined);
  assert.equal(legacy.data.mediaAssets[0].contentHash, undefined);
  assert.equal(legacy.schemaVersion, 12);
});

await test('v10以前のMediaAssetは通常旅行写真として復元する', () => {
  for (const schemaVersion of [2, 9, 10]) {
    const normalized = normalizeBackupPayload({
      app: 'travel-log-pwa',
      schemaVersion,
      data: {
        mediaAssets: [{ id: `asset-v${schemaVersion}`, tripId: 'trip-1', storageType: 'local', mimeType: 'image/jpeg', mediaSyncStatus: 'local_only' }],
      },
    });
    assert.equal(normalized.data.mediaAssets[0].usage, 'trip');
  }
});

await test('将来VersionのBackupは読み込まない', () => {
  assert.throws(
    () => normalizeBackupPayload({ app: 'travel-log-pwa', schemaVersion: 13, data: {} }),
    /新しいバージョン/,
  );
});

function createBackupTestAsset(id, usage = 'trip') {
  return {
    id,
    userId: 'local-user',
    tripId: 'trip-1',
    usage,
    ownerScrapbookId: usage === 'cover-only' ? 'scrapbook-1' : undefined,
    contentHash: `sha256:${'a'.repeat(64)}`,
    storageType: 'local',
    localReference: `${id}:original`,
    thumbnailReference: `${id}:thumbnail`,
    mimeType: 'image/jpeg',
    mediaSyncStatus: 'local_only',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    syncStatus: 'pending',
  };
}

function createBackupTestBlob(assetId, kind, suffix = 0) {
  const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, suffix, 0x01, 0x02, 0x03]);
  return {
    id: `${assetId}:${kind}`,
    assetId,
    kind,
    blob: new Blob([bytes], { type: 'image/jpeg' }),
    mimeType: 'image/jpeg',
    createdAt: '2026-08-01T00:00:00.000Z',
  };
}

function createBackupTestSnapshot(assets = [], blobs = []) {
  return {
    trips: [],
    scrapbooks: [{ id: 'scrapbook-1', tripId: 'trip-1', title: '旅', status: 'draft', layoutMode: 'pages', themeId: 'journal' }],
    mediaAssets: assets,
    mediaAssetBlobs: blobs,
  };
}

async function rewriteBackupZip(source, options = {}) {
  const reader = new ZipReader(new BlobReader(source));
  const entries = await reader.getEntries();
  const files = [];
  for (const entry of entries) {
    if (entry.directory || options.omitPaths?.includes(entry.filename)) continue;
    let filename = options.renamePaths?.[entry.filename] ?? entry.filename;
    let data;
    if (entry.filename === 'manifest.json') {
      const manifest = JSON.parse(await entry.getData(new TextWriter()));
      options.mutateManifest?.(manifest);
      data = new TextReader(JSON.stringify(manifest));
    } else {
      data = new BlobReader(await entry.getData(new BlobWriter()));
    }
    files.push({ filename, data });
  }
  await reader.close();
  const writer = new ZipWriter(new BlobWriter('application/zip'));
  for (const file of files) await writer.add(file.filename, file.data, { level: file.filename.startsWith('media/') ? 0 : 6 });
  for (const extra of options.extraEntries ?? []) await writer.add(extra.path, new TextReader(extra.text), { level: 0 });
  return writer.close();
}

await test('完全Backup Package v1は写真なしMetadataを自己検証できる', async () => {
  const result = await buildFullBackupPackageFromSnapshot(createBackupTestSnapshot());
  assert.equal(FULL_BACKUP_PACKAGE_VERSION, 1);
  assert.equal(result.validation.success, true);
  assert.equal(result.manifest.metadataSchemaVersion, 12);
  assert.deepEqual(result.manifest.summary, {
    mediaAssetCount: 0,
    mediaEntryCount: 0,
    includedCount: 0,
    missingCount: 0,
    includedByteSize: 0,
    originalIncludedCount: 0,
    thumbnailIncludedCount: 0,
  });
});

await test('完全Backupはoriginalとthumbnailを無圧縮格納してchecksumを検証する', async () => {
  const asset = createBackupTestAsset('asset-both');
  const snapshot = createBackupTestSnapshot([asset], [
    createBackupTestBlob(asset.id, 'original', 1),
    createBackupTestBlob(asset.id, 'thumbnail', 2),
  ]);
  const result = await buildFullBackupPackageFromSnapshot(snapshot);
  assert.equal(result.validation.success, true);
  assert.equal(result.manifest.summary.includedCount, 2);
  assert.equal(result.manifest.summary.missingCount, 0);
  assert.ok(result.manifest.mediaEntries.every((entry) => entry.checksum?.startsWith('sha256:')));
  assert.equal(result.manifest.mediaEntries.find((entry) => entry.kind === 'original').contentHash, asset.contentHash);
  assert.equal(result.manifest.mediaEntries.find((entry) => entry.kind === 'thumbnail').contentHash, undefined);
});

await test('完全Backupはtripとcover-onlyを含み、Blob欠損をmanifestへ残す', async () => {
  const trip = createBackupTestAsset('asset-trip');
  const cover = createBackupTestAsset('asset-cover', 'cover-only');
  const snapshot = createBackupTestSnapshot([trip, cover], [
    createBackupTestBlob(trip.id, 'original', 1),
    createBackupTestBlob(cover.id, 'thumbnail', 2),
  ]);
  const result = await buildFullBackupPackageFromSnapshot(snapshot);
  assert.equal(result.validation.success, true);
  assert.equal(result.manifest.summary.includedCount, 2);
  assert.equal(result.manifest.summary.missingCount, 2);
  assert.equal(result.manifest.warnings.length, 2);
  assert.ok(result.manifest.mediaEntries.filter((entry) => entry.status === 'missing').every((entry) => entry.missingReason === 'blob-not-found'));
  assert.equal(result.validation.warnings.length, 2);
  assert.deepEqual(estimateFullBackupFromSnapshot(snapshot), {
    mediaAssetCount: 2,
    availableBlobCount: 2,
    missingBlobCount: 2,
    availableByteSize: 16,
  });
});

await test('完全Backup validatorはchecksum・容量・Summary改ざんを拒否する', async () => {
  const asset = createBackupTestAsset('asset-tamper');
  const source = (await buildFullBackupPackageFromSnapshot(createBackupTestSnapshot(
    [asset],
    [createBackupTestBlob(asset.id, 'original'), createBackupTestBlob(asset.id, 'thumbnail')],
  ))).blob;
  const checksum = await rewriteBackupZip(source, { mutateManifest: (manifest) => { manifest.mediaEntries[0].checksum = `sha256:${'b'.repeat(64)}`; } });
  const byteSize = await rewriteBackupZip(source, { mutateManifest: (manifest) => { manifest.mediaEntries[0].byteSize += 1; } });
  const summary = await rewriteBackupZip(source, { mutateManifest: (manifest) => { manifest.summary.includedCount = 0; } });
  assert.ok((await validateFullBackupPackage(checksum)).errors.some((issue) => issue.code === 'checksum-mismatch'));
  assert.ok((await validateFullBackupPackage(byteSize)).errors.some((issue) => issue.code === 'byte-size-mismatch'));
  assert.ok((await validateFullBackupPackage(summary)).errors.some((issue) => issue.code === 'summary-mismatch'));
});

await test('完全Backup validatorはMIME不一致と危険なpathを拒否する', async () => {
  const asset = createBackupTestAsset('asset-path');
  const source = (await buildFullBackupPackageFromSnapshot(createBackupTestSnapshot(
    [asset],
    [createBackupTestBlob(asset.id, 'original'), createBackupTestBlob(asset.id, 'thumbnail')],
  ))).blob;
  const oldPath = 'media/asset-path/original.jpg';
  const mimeMismatch = await rewriteBackupZip(source, {
    renamePaths: { [oldPath]: 'media/asset-path/original.png' },
    mutateManifest: (manifest) => {
      const entry = manifest.mediaEntries.find((item) => item.kind === 'original');
      entry.path = 'media/asset-path/original.png';
      entry.mimeType = 'image/png';
    },
  });
  const traversal = await rewriteBackupZip(source, {
    mutateManifest: (manifest) => { manifest.mediaEntries[0].path = '../original.jpg'; },
  });
  assert.ok((await validateFullBackupPackage(mimeMismatch)).errors.some((issue) => issue.code === 'mime-type-mismatch'));
  assert.ok((await validateFullBackupPackage(traversal)).errors.some((issue) => issue.code === 'unsafe-path'));
});

await test('完全Backup validatorは重複宣言・欠損・missing混入を拒否する', async () => {
  const asset = createBackupTestAsset('asset-shape');
  const source = (await buildFullBackupPackageFromSnapshot(createBackupTestSnapshot(
    [asset],
    [createBackupTestBlob(asset.id, 'original'), createBackupTestBlob(asset.id, 'thumbnail')],
  ))).blob;
  const duplicate = await rewriteBackupZip(source, { mutateManifest: (manifest) => { manifest.mediaEntries.push({ ...manifest.mediaEntries[0] }); manifest.summary.mediaEntryCount += 1; manifest.summary.includedCount += 1; manifest.summary.includedByteSize += manifest.mediaEntries[0].byteSize; manifest.summary.originalIncludedCount += 1; } });
  const missingFile = await rewriteBackupZip(source, { omitPaths: ['media/asset-shape/original.jpg'] });
  const missingMixed = await rewriteBackupZip(source, { mutateManifest: (manifest) => { const entry = manifest.mediaEntries[0]; entry.status = 'missing'; entry.missingReason = 'blob-not-found'; delete entry.checksum; manifest.summary.includedCount -= 1; manifest.summary.missingCount += 1; manifest.summary.includedByteSize -= entry.byteSize; manifest.summary.originalIncludedCount -= 1; entry.byteSize = 0; } });
  assert.ok((await validateFullBackupPackage(duplicate)).errors.some((issue) => issue.code === 'duplicate-media-entry'));
  assert.ok((await validateFullBackupPackage(missingFile)).errors.some((issue) => issue.code === 'included-file-missing'));
  assert.ok((await validateFullBackupPackage(missingMixed)).errors.some((issue) => issue.code === 'missing-file-present'));
  assert.deepEqual(findDuplicateBackupPaths(['manifest.json', 'media/a/original.jpg', 'manifest.json']), ['manifest.json']);
});

await test('完全Backup validatorは未知Package／Metadata Versionを拒否する', async () => {
  const source = (await buildFullBackupPackageFromSnapshot(createBackupTestSnapshot())).blob;
  const packageVersion = await rewriteBackupZip(source, { mutateManifest: (manifest) => { manifest.packageVersion = 2; } });
  const metadataVersion = await rewriteBackupZip(source, { mutateManifest: (manifest) => { manifest.metadataSchemaVersion = 13; } });
  assert.ok((await validateFullBackupPackage(packageVersion)).errors.some((issue) => issue.code === 'package-version-unsupported'));
  assert.ok((await validateFullBackupPackage(metadataVersion)).errors.some((issue) => issue.code === 'metadata-schema-unsupported'));
});

await test('完全BackupはCancel・Hash失敗・自己検証失敗でPackageを返さない', async () => {
  const asset = createBackupTestAsset('asset-errors');
  const snapshot = createBackupTestSnapshot([asset], [createBackupTestBlob(asset.id, 'original')]);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(() => buildFullBackupPackageFromSnapshot(snapshot, { signal: controller.signal }), /cancel|abort/i);
  await assert.rejects(() => buildFullBackupPackageFromSnapshot(snapshot, { hasher: { sha256: async () => { throw new Error('hash failed'); } } }), /作成できません/);
  await assert.rejects(() => buildFullBackupPackageFromSnapshot(snapshot, {
    validatePackage: async () => ({ success: false, warnings: [], errors: [{ code: 'checksum-mismatch' }] }),
  }), /自己検証/);
});

await test('完全Backup Exportは入力Snapshotを変更せず、軽量JSON Backup経路を維持する', async () => {
  const asset = createBackupTestAsset('asset-immutable');
  const snapshot = createBackupTestSnapshot([asset], [createBackupTestBlob(asset.id, 'original')]);
  const beforeAsset = { ...asset };
  await buildFullBackupPackageFromSnapshot(snapshot);
  assert.deepEqual(asset, beforeAsset);
  assert.match(backupServiceSource, /buildBackupPayloadFromSnapshot/);
  assert.match(settingsPageSource, /JSON\.stringify\(payload, null, 2\)/);
  assert.match(settingsPageSource, /restoreBackupPayload/);
});

await test('完全Backup UIは二重実行、Cancel、自己検証前Download、Object URLを安全に扱う', () => {
  assert.match(fullBackupPanelSource, /if \(controllerRef\.current\) return/);
  assert.match(fullBackupPanelSource, /controllerRef\.current\?\.abort/);
  assert.match(fullBackupPanelSource, /result\?\.validation\.success/);
  assert.match(fullBackupPanelSource, /URL\.createObjectURL/);
  assert.match(fullBackupPanelSource, /URL\.revokeObjectURL/);
  assert.match(fullBackupPanelSource, /aria-busy/);
  assert.match(fullBackupPanelSource, /aria-live/);
  assert.match(fullBackupPanelSource, /完全Backupを作成/);
  assert.match(settingsPageSource, /軽量Backup/);
  assert.match(settingsPageSource, /FullBackupPanel/);
  assert.match(fullBackupServiceSource, /level: 0/);
  assert.match(localDbSource, /readStoresSnapshot/);
});

await test('v8スクラップブックを既存情報を保ったままv10へ移行する', () => {
  const normalized = normalizeBackupPayload({
    app: 'travel-log-pwa',
    schemaVersion: 8,
    exportedAt: '2026-07-19T00:00:00.000Z',
    data: {
      scrapbooks: [{
        id: 'scrapbook-v8',
        tripId: 'trip-v8',
        title: '既存の旅',
        subtitle: '残したい説明',
        status: 'draft',
        layoutMode: 'pages',
        themeId: 'journal',
      }],
      scrapbookPages: [{
        id: 'page-v8',
        scrapbookId: 'scrapbook-v8',
        title: '表紙',
        sortOrder: 10,
        layoutType: 'cover',
      }],
      scrapbookBlocks: [{
        id: 'block-v8',
        pageId: 'page-v8',
        type: 'text',
        sortOrder: 10,
        text: '消してはいけない本文',
      }],
    },
  });

  assert.equal(normalized.schemaVersion, 12);
  assert.equal(normalized.data.scrapbooks[0].title, '既存の旅');
  assert.equal(normalized.data.scrapbooks[0].subtitle, '残したい説明');
  assert.equal(normalized.data.scrapbooks[0].origin, 'generated');
  assert.equal(normalized.data.scrapbooks[0].sourceRevision, 2);
  assert.deepEqual(normalized.data.scrapbooks[0].userEditedFields, []);
  assert.equal(normalized.data.scrapbookPages[0].origin, 'generated');
  assert.equal(normalized.data.scrapbookPages[0].pageKind, 'cover');
  assert.deepEqual(normalized.data.scrapbookPages[0].userEditedFields, []);
  assert.equal(normalized.data.scrapbookBlocks[0].text, '消してはいけない本文');
  assert.equal(normalized.data.scrapbookBlocks[0].origin, 'generated');
});

await test('v9ページは既存情報からpageKindを補完する', () => {
  const normalized = normalizeBackupPayload({
    app: 'travel-log-pwa',
    schemaVersion: 9,
    data: {
      scrapbookPages: [
        { id: 'cover', scrapbookId: 'book', title: '表紙', sortOrder: 10, layoutType: 'cover' },
        { id: 'story', scrapbookId: 'book', title: '旅のはじまり', sortOrder: 20, layoutType: 'section' },
        { id: 'timeline', scrapbookId: 'book', title: '旅の流れ', sortOrder: 30, layoutType: 'section' },
        { id: 'photo', scrapbookId: 'book', title: '旅の景色', sortOrder: 40, layoutType: 'section' },
        { id: 'place', scrapbookId: 'book', title: '訪問場所', sortOrder: 50, layoutType: 'section' },
        { id: 'ending', scrapbookId: 'book', title: '旅のまとめ', sortOrder: 60, layoutType: 'summary' },
        { id: 'custom', scrapbookId: 'book', title: '珈琲3選', sortOrder: 70, layoutType: 'section' },
      ],
    },
  });
  assert.deepEqual(normalized.data.scrapbookPages.map((page) => page.pageKind), [
    'cover', 'story', 'timeline', 'photo', 'place', 'ending', 'custom',
  ]);
});

await test('スクラップブックページはsortOrder順で非表示ページを除外する', () => {
  const pages = sortVisibleScrapbookPages([
    { id: 'third', sortOrder: 30 },
    { id: 'hidden', sortOrder: 5, isHidden: true },
    { id: 'first', sortOrder: 10 },
    { id: 'second', sortOrder: 20 },
  ]);
  assert.deepEqual(pages.map((page) => page.id), ['first', 'second', 'third']);
});

await test('再生成候補はユーザー編集済みのタイトルを上書きしない', () => {
  const current = {
    id: 'scrapbook-1',
    tripId: 'trip-1',
    title: '京都日帰り散歩',
    subtitle: '古い説明',
    origin: 'generated',
    sourceRevision: 1,
    userEditedFields: ['title'],
  };
  const merged = mergeGeneratedScrapbookFields(
    current,
    { title: '京都旅行', subtitle: '新しい旅行データの説明' },
    2,
  );
  assert.equal(merged.title, '京都日帰り散歩');
  assert.equal(merged.subtitle, '新しい旅行データの説明');
  assert.equal(merged.sourceRevision, 2);
});

await test('表紙写真とハイライト写真の参照を保存・復元できる', () => {
  const normalized = normalizeBackupPayload({
    app: 'travel-log-pwa',
    schemaVersion: 9,
    data: {
      scrapbooks: [{
        id: 'scrapbook-photo',
        tripId: 'trip-photo',
        origin: 'generated',
        title: '写真の旅',
        status: 'draft',
        layoutMode: 'pages',
        themeId: 'journal',
        coverSettings: { photoId: 'asset-cover', titlePosition: 'bottom', layout: 'magazine', showDate: false, showLocation: false, showSubtitle: false },
        highlightPhotoIds: ['asset-highlight-1', 'asset-highlight-2'],
      }],
    },
  });
  const scrapbook = normalized.data.scrapbooks[0];
  assert.equal(scrapbook.coverSettings?.photoId, 'asset-cover');
  assert.equal(scrapbook.coverSettings?.showDate, false);
  assert.equal(scrapbook.coverSettings?.showLocation, false);
  assert.equal(scrapbook.coverSettings?.showSubtitle, false);
  assert.deepEqual(scrapbook.highlightPhotoIds, ['asset-highlight-1', 'asset-highlight-2']);
  assert.deepEqual(collectScrapbookMediaAssetIds(scrapbook), [
    'asset-cover',
    'asset-highlight-1',
    'asset-highlight-2',
  ]);
});

await test('JSONエクスポート/インポートでタイムマシン手動補完が復元できる', () => {
  const normalized = normalizeBackupPayload({
    app: 'travel-log-pwa',
    schemaVersion: 6,
    data: {
      manualTimelineEntries: [
        {
          id: 'manual-1',
          date: '2026-07-18',
          timePrecision: 'day',
          locationName: '京都',
          sourceType: 'manual',
          confidence: 'medium',
        },
      ],
    },
  });
  assert.equal(normalized.schemaVersion, 12);
  assert.equal(normalized.data.manualTimelineEntries.length, 1);
});

await test('JSONエクスポート/インポートで旅ガチャ履歴が復元できる', () => {
  const normalized = normalizeBackupPayload({
    app: 'travel-log-pwa',
    schemaVersion: 7,
    data: {
      travelGachaDraws: [
        {
          id: 'travel-gacha-draw-1',
          userId: 'local-user',
          mode: 'condition',
          settingsSnapshot: {
            departureLabel: '東京',
            tripDurationDays: 1,
            stayType: 'dayTrip',
            maxBudget: 15000,
            maxOneWayTravelMinutes: 180,
            transportModes: ['train'],
            candidateScope: 'all',
            travelStyleTags: [],
            regionCodes: [],
            prefectureCodes: [],
            prioritizeUnvisited: true,
            prioritizeWishlist: true,
            includeVisited: true,
            includeRecentlyVisited: true,
            includeRecentlyDrawn: false,
            randomnessLevel: 'balanced',
            candidateLimit: 30,
          },
          selectedCandidateId: 'prefecture:13',
          candidateSnapshot: {
            id: 'prefecture:13',
            sourceType: 'prefecture',
            sourceId: '13',
            name: '東京都旅',
            travelStyleTags: ['city_walk'],
            estimatedTravelTimeMinutes: 60,
            recommendedTransportModes: ['train'],
            recommendedStayType: 'dayTrip',
            minimumRecommendedHours: 4,
            isVisited: false,
            visitCount: 0,
            isWishlist: false,
            isFavorite: false,
            collectionIds: [],
            sourcePriority: 6,
            eligibility: { eligible: true, rejectedReasons: [], suggestions: [] },
            costEstimate: {
              transportCost: 1200,
              accommodationCost: 0,
              foodCost: 2500,
              activityCost: 1800,
              localTransportCost: 1200,
              contingencyCost: 2000,
              totalEstimatedCost: 9900,
              minTotalEstimatedCost: 7920,
              maxTotalEstimatedCost: 12375,
              estimatePrecision: 'rough',
              estimateReasons: ['概算'],
            },
            score: 40,
            scoreReasons: ['条件に合う候補です。'],
          },
          candidateCount: 1,
          score: 40,
          scoreReasons: ['条件に合う候補です。'],
          drawnAt: '2026-07-18T00:00:00.000Z',
          createdAt: '2026-07-18T00:00:00.000Z',
          updatedAt: '2026-07-18T00:00:00.000Z',
          syncStatus: 'pending',
        },
      ],
    },
  });
  assert.equal(normalized.schemaVersion, 12);
  assert.equal(normalized.data.travelGachaDraws.length, 1);
  assert.equal(normalized.data.travelGachaDraws[0].selectedCandidateId, 'prefecture:13');
});

await test('JSONエクスポート/インポートで旅行の移動区間が復元できる', () => {
  const normalized = normalizeBackupPayload({
    app: 'travel-log-pwa',
    schemaVersion: 8,
    data: {
      tripTransportLegs: [
        {
          id: 'transport-leg-1',
          userId: 'local-user',
          tripId: 'trip-1',
          date: '2026-07-18',
          fromName: '東京駅',
          toName: '京都駅',
          transportMode: 'shinkansen',
          oneWayCost: 13970,
          partyCount: 1,
          totalCost: 13970,
          costSource: 'manual',
          estimatePrecision: 'exact',
          sortOrder: 1,
          createdAt: '2026-07-18T00:00:00.000Z',
          updatedAt: '2026-07-18T00:00:00.000Z',
          syncStatus: 'pending',
        },
      ],
    },
  });
  assert.equal(normalized.schemaVersion, 12);
  assert.equal(normalized.data.tripTransportLegs.length, 1);
  assert.equal(normalized.data.tripTransportLegs[0].transportMode, 'shinkansen');
});

await test('旧形式バックアップでも日本制覇マップデータなしでエラーにならない', () => {
  const oldObject = normalizeBackupPayload({ trips: [{ id: 'trip-1', title: '旧バックアップ' }] });
  const oldArray = normalizeBackupPayload([{ id: 'trip-2', title: 'さらに古い形式' }]);
  assert.equal(oldObject.data.prefectureVisits.length, 0);
  assert.equal(oldObject.data.castleVisitSummaries.length, 0);
  assert.equal(oldObject.data.scrapbooks.length, 0);
  assert.equal(oldObject.data.manualTimelineEntries.length, 0);
  assert.equal(oldObject.data.travelGachaDraws.length, 0);
  assert.equal(oldObject.data.tripTransportLegs.length, 0);
  assert.equal(oldObject.data.trips.length, 1);
  assert.equal(oldArray.data.trips.length, 1);
});

await test('旅行の移動区間は旅行本体と分離したモデルを持つ', () => {
  assert.match(tripModel, /interface TripTransportLeg extends BaseEntity/);
  assert.match(tripModel, /TransportCostSource = 'manual' \| 'estimated' \| 'api'/);
  assert.match(tripModel, /externalProvider/);
  assert.match(tripModel, /externalRouteId/);
});

await test('旅行の移動区間はRepository経由で端末内保存する', () => {
  assert.match(tripRepository, /TripTransportLegRepository/);
  assert.match(localDbSource, /tripTransportLegs/);
  assert.match(tripService, /repositories\.tripTransportLegs/);
});

await test('旅行詳細で移動区間の追加、編集、削除ができる', () => {
  assert.match(tripDetailPage, /交通費・移動/);
  assert.match(tripDetailPage, /createTripTransportLeg/);
  assert.match(tripDetailPage, /updateTripTransportLeg/);
  assert.match(tripDetailPage, /deleteTripTransportLeg/);
  assert.match(transportLegForm, /片道交通費/);
  assert.match(transportLegForm, /交通費合計/);
});

await test('移動区間は将来の交通API連携用フィールドを持つ', () => {
  assert.match(tripModel, /costSource/);
  assert.match(tripModel, /estimatePrecision/);
  assert.match(tripModel, /externalProvider/);
  assert.match(tripModel, /externalRouteId/);
  assert.doesNotMatch(tripService, /fetch\(|API_KEY/);
});

await test('旅ガチャは候補モデルと抽選履歴モデルを分離する', () => {
  assert.match(travelGachaModel, /interface TravelCandidate /);
  assert.match(travelGachaModel, /interface TravelGachaDraw extends BaseEntity/);
  assert.match(travelGachaModel, /TravelGachaRandomnessLevel = 'realistic' \| 'balanced' \| 'adventure' \| 'chaos'/);
});

await test('旅ガチャ候補は既存データから生成し外部APIに依存しない', () => {
  assert.match(travelGachaService, /fromPrefecture/);
  assert.match(travelGachaService, /fromWishlist/);
  assert.match(travelGachaService, /fromPlaceVisit/);
  assert.match(travelGachaService, /fromCastle/);
  assert.match(travelGachaService, /fromCollectionItem/);
  assert.match(travelGachaService, /pickWeightedCandidate/);
  assert.match(travelGachaService, /interface RandomProvider/);
  assert.doesNotMatch(travelGachaService, /fetch\(|getCurrentPosition|API_KEY/);
});

await test('旅ガチャは初期条件で全候補が予算超過にならない', () => {
  assert.match(travelGachaService, /maxBudget:\s*25000/);
});

await test('旅ガチャは予算や移動時間が厳しい場合に近い候補を返せる', () => {
  assert.match(travelGachaService, /SOFT_REJECTION_REASONS/);
  assert.match(travelGachaService, /buildRelaxedCandidates/);
  assert.match(travelGachaService, /条件が少し厳しいため、近い候補として表示しています。/);
});

await test('旅ガチャ画面とルート導線がある', () => {
  assert.match(routerSource, /travel-gacha/);
  assert.match(travelGachaPage, /旅ガチャ/);
  assert.match(travelGachaPage, /候補を見る/);
  assert.match(travelGachaPage, /旅ガチャを引く/);
  assert.match(travelGachaPage, /この旅に決める/);
  assert.match(travelGachaPage, /もう一度引く/);
  assert.match(travelGachaPage, /抽選できる候補が見つかりませんでした。/);
});

await test('旅ガチャ履歴Repositoryは端末内保存を使う', () => {
  assert.match(localDbSource, /travelGachaDraws/);
  assert.match(localTravelGachaRepository, /LocalTravelGachaDrawRepository/);
  assert.match(localTravelGachaRepository, /listRecent/);
});

await test('旅ガチャRPG経験値はsourceKeyで二重付与を防ぐ設計', () => {
  assert.match(travelGachaService, /travel-gacha-first-draw/);
  assert.match(travelGachaService, /travel-gacha-accepted:\$\{draw\.id\}/);
  assert.equal(experienceRules.travelGachaFirstDraw, 10);
  assert.equal(experienceRules.travelGachaAccepted, 20);
});

await test('タイムマシンは表示用TimelineEventと手動補完モデルを分離する', () => {
  assert.match(timeMachineModel, /interface TimelineEvent /);
  assert.match(timeMachineModel, /interface LocationInferenceResult /);
  assert.match(timeMachineModel, /interface ManualTimelineEntry extends BaseEntity/);
  assert.match(localTimeMachineRepository, /LocalManualTimelineEntryRepository/);
});

await test('タイムマシンは日付移動と去年の今日を安全に扱う', () => {
  assert.match(timeMachineService, /export function shiftDate/);
  assert.match(timeMachineService, /export function getLastYearDate/);
  assert.match(timeMachineService, /2月28日を表示します/);
  assert.match(timeMachineService, /candidate\.getFullYear\(\) === lastYear/);
});

await test('タイムマシン画面とルート導線がある', () => {
  assert.match(routerSource, /time-machine/);
  assert.match(timeMachinePage, /タイムマシン/);
  assert.match(timeMachinePage, /去年の今日/);
});

await test('タイムマシンは時刻不明データを正確な時刻として扱わない', () => {
  assert.match(timeMachineService, /timePrecision:\s*'day'/);
  assert.match(timeMachinePage, /時刻不明・この日の記録/);
  assert.doesNotMatch(timeMachineService, /T00:00:00.*timePrecision:\s*'exact'/s);
});

await test('タイムマシンは推定と確定を確度で分ける', () => {
  assert.match(timeMachineModel, /TimelineConfidence = 'exact' \| 'high' \| 'medium' \| 'low' \| 'unknown'/);
  assert.match(locationInferenceService, /inferLocationFromTimeline/);
  assert.match(locationInferenceService, /confidenceReason/);
  assert.match(timeMachinePage, /CONFIDENCE_LABELS/);
});

await test('場所推定は前後同一地点と移動中候補を区別する', () => {
  assert.match(timeMachineModel, /between_same_place/);
  assert.match(timeMachineModel, /moving_between_places/);
  assert.match(locationInferenceService, /samePlace\(beforeEvent, afterEvent\)/);
  assert.match(locationInferenceService, /移動中または記録誤差/);
  assert.match(timeMachinePage, /INFERENCE_MODE_LABELS/);
});

await test('場所推定は候補を複数表示し根拠件数を持つ', () => {
  assert.match(timeMachineModel, /supportingEventIds/);
  assert.match(timeMachineModel, /distanceMinutes/);
  assert.match(locationInferenceService, /candidateLocations/);
  assert.match(timeMachinePage, /ほかの候補/);
});

await test('タイムマシンは常時GPSや写真ライブラリ自動走査を追加しない', () => {
  assert.doesNotMatch(timeMachineService, /watchPosition|getCurrentPosition/);
  assert.doesNotMatch(timeMachinePage, /webkitdirectory|capture/);
});

await test('タイムマシンの簡易地図は正確なGPS軌跡と断定しない', () => {
  assert.match(timeMachinePage, /GPS軌跡ではなく/);
  assert.match(timeMachinePage, /簡易地図/);
});

await test('タイムマシン地図は地点選択とタイムライン選択を連動する', () => {
  assert.match(timeMachinePage, /selectedEventId/);
  assert.match(timeMachinePage, /onSelectEvent=\{selectEvent\}/);
  assert.match(timeMachinePage, /TimelineList events=\{data\.events\} selectedEventId=\{selectedEventId\}/);
  assert.match(timeMachinePage, /地図で見る/);
});

await test('タイムマシン地図は推定経路と地点詳細を表示する', () => {
  assert.match(timeMachinePage, /time-map__route/);
  assert.match(timeMachinePage, /SelectedEventPanel/);
  assert.match(timeMachinePage, /地図外の記録/);
  assert.match(timeMachinePage, /線はGPS軌跡ではなく/);
});

await test('スクラップブックは旅行記録と編集データを分離したモデルを持つ', () => {
  assert.match(scrapbookModel, /interface Scrapbook /);
  assert.match(scrapbookModel, /interface ScrapbookPage /);
  assert.match(scrapbookModel, /type ScrapbookBlock =/);
  assert.match(scrapbookModel, /interface MediaAsset /);
});

await test('MediaAsset用途追加はIndexedDB構造を変更せず既存モデルを利用する', () => {
  assert.match(scrapbookModel, /MediaAssetUsage = 'trip' \| 'cover-only'/);
  assert.match(scrapbookModel, /usage\?: MediaAssetUsage/);
  assert.match(scrapbookModel, /ownerScrapbookId\?: EntityId/);
  assert.match(localDbSource, /const DB_VERSION = 10/);
  assert.match(backupServiceSource, /return normalizeBackupPayload\(/);
});

await test('旅行詳細からスクラップブック画面へ移動できる', () => {
  assert.match(routerSource, /trips\/:tripId\/scrapbook/);
  assert.match(tripDetailPage, /スクラップブック/);
});

await test('スクラップブックは1旅行に重複作成されない', () => {
  assert.match(scrapbookService, /getByTripId\(tripId\)/);
  assert.match(scrapbookService, /if \(existing\) return existing/);
});

await test('スクラップブック初期生成はsourceKeyで重複防止する', () => {
  assert.match(scrapbookService, /sourceKey: `cover:\$\{trip\.id\}`/);
  assert.match(scrapbookService, /sourceKey: `story:\$\{trip\.id\}`/);
  assert.match(scrapbookService, /sourceKey: `timeline:\$\{trip\.id\}`/);
  assert.match(scrapbookService, /const sourceKey = `day:\$\{trip\.id\}:\$\{date\}`/);
  assert.match(scrapbookService, /sourceKey: `place:\$\{place\.id\}`/);
  assert.match(scrapbookService, /sourceKey: `photo:\$\{trip\.id\}`/);
  assert.match(scrapbookService, /sourceKey: `ending:\$\{trip\.id\}`/);
  assert.match(scrapbookService, /pageKind: 'cover'/);
  assert.match(scrapbookService, /pageKind: 'story'/);
  assert.match(scrapbookService, /pageKind: 'timeline'/);
  assert.match(scrapbookService, /pageKind: 'place'/);
  assert.match(scrapbookService, /pageKind: 'photo'/);
  assert.match(scrapbookService, /pageKind: 'ending'/);
});

await test('スクラップブック画面は閲覧モードと編集モードを分ける', () => {
  assert.match(scrapbookPage, /mode, setMode/);
  assert.match(scrapbookPage, /mode === 'edit'/);
  assert.match(scrapbookPage, /mode === 'view'/);
  assert.match(scrapbookPage, /<ScrapbookViewer/);
  assert.match(scrapbookPage, /<ScrapbookEditor/);
});

await test('スクラップブック編集はViewerと同じページRendererをプレビューに使う', () => {
  assert.match(scrapbookViewerSource, /export function ScrapbookPagePreview/);
  assert.match(scrapbookViewerSource, /<ScrapbookPageRenderer/);
  assert.match(scrapbookEditorSource, /<ScrapbookPagePreview/);
  assert.doesNotMatch(scrapbookViewerSource, /useState/);
});

await test('スクラップブック編集はページ単位Draftを保存まで永続化しない', () => {
  const scrapbook = { id: 'book-1', title: '京都旅行', subtitle: '喫茶店めぐり' };
  const page = { id: 'page-1', title: '旅のはじまり', pageKind: 'story', isHidden: false };
  const initial = createScrapbookPageDraft(page, scrapbook);
  const changed = { ...initial, pageTitle: '雨上がりの京都' };
  assert.equal(areScrapbookPageDraftsEqual(initial, changed), false);
  assert.equal(isScrapbookPageDraftDirty(changed, page, scrapbook), true);
  assert.equal(applyScrapbookPageDraft(page, changed).title, '雨上がりの京都');
  assert.equal(applyScrapbookPageDraft({ ...page, isHidden: true }, changed).isHidden, false);
  assert.equal(applyScrapbookCoverDraft(scrapbook, { ...changed, coverTitle: '京都日帰り散歩' }).title, '京都日帰り散歩');
  assert.match(scrapbookEditorSource, /useState<ScrapbookPageDraft>/);
  assert.doesNotMatch(scrapbookEditorSource, /IndexedDB|repositories\./);
});

await test('表紙編集Draftは旧写真参照を引き継ぎ、設定変更をプレビューへ反映する', () => {
  const scrapbook = {
    id: 'book-cover',
    title: '京都旅行',
    subtitle: '喫茶店めぐり',
    coverAssetId: 'legacy-cover',
    coverLayout: 'journal',
    themeId: 'journal',
    coverSettings: { showDate: true, showLocation: true, showSubtitle: true },
  };
  const page = { id: 'cover-page', title: '表紙', pageKind: 'cover', isHidden: false };
  const initial = createScrapbookPageDraft(page, scrapbook);
  assert.equal(initial.coverPhotoId, 'legacy-cover');
  const changed = {
    ...initial,
    coverPhotoId: 'new-cover',
    coverShowDate: false,
    coverShowLocation: false,
    coverShowSubtitle: false,
    coverTitlePosition: 'center',
    coverLayout: 'magazine',
    coverThemeId: 'minimal',
  };
  assert.equal(isScrapbookPageDraftDirty(changed, page, scrapbook), true);
  const preview = applyScrapbookCoverDraft(scrapbook, changed);
  assert.equal(preview.coverSettings.photoId, 'new-cover');
  assert.equal(preview.coverSettings.showDate, false);
  assert.equal(preview.coverSettings.showLocation, false);
  assert.equal(preview.coverSettings.showSubtitle, false);
  assert.equal(preview.coverSettings.titlePosition, 'center');
  assert.equal(preview.coverLayout, 'magazine');
  assert.equal(preview.themeId, 'minimal');
});

await test('表紙テンプレートRegistryは重複せず未知値を安全に解決する', () => {
  assert.deepEqual(COVER_TEMPLATES.map((template) => template.id), ['magazine', 'photo', 'journal']);
  assert.equal(new Set(COVER_TEMPLATES.map((template) => template.id)).size, COVER_TEMPLATES.length);
  assert.equal(resolveCoverTemplateId('photo'), 'photo');
  assert.equal(resolveCoverTemplateId('unknown-template'), 'journal');
  assert.equal(getCoverTemplateDefinition('unknown-template').id, 'journal');
  for (const template of COVER_TEMPLATES) {
    assert.ok(template.name);
    assert.ok(template.description);
    assert.ok(template.previewVariant);
    assert.ok(template.capabilities.titlePositions.length > 0);
  }
  assert.equal(resolveCoverTitlePosition('journal', 'unsupported-position'), 'bottom-left');
});

await test('代表写真は新設定、旧設定、ハイライト、ページ写真の順で解決する', () => {
  const pages = [{
    id: 'page-photo',
    sortOrder: 1,
    blocks: [
      { id: 'block-photo', type: 'photo', assetId: 'page-photo', sortOrder: 1 },
      { id: 'block-grid', type: 'photo_grid', assetIds: ['grid-photo'], sortOrder: 2 },
    ],
  }];
  const scrapbook = {
    coverSettings: { photoId: 'new-cover' },
    coverAssetId: 'legacy-cover',
    highlightPhotoIds: ['highlight-photo'],
  };
  assert.equal(resolveScrapbookCoverPhotoId(scrapbook, pages, ['new-cover', 'legacy-cover', 'highlight-photo', 'page-photo']), 'new-cover');
  assert.equal(resolveScrapbookCoverPhotoId(scrapbook, pages, ['legacy-cover', 'highlight-photo', 'page-photo']), 'legacy-cover');
  assert.equal(resolveScrapbookCoverPhotoId(scrapbook, pages, ['highlight-photo', 'page-photo']), 'highlight-photo');
  assert.equal(resolveScrapbookCoverPhotoId(scrapbook, pages, ['page-photo']), 'page-photo');
  assert.equal(resolveScrapbookCoverPhotoId(scrapbook, pages, []), undefined);
});

await test('テンプレート候補は明示適用まで表紙Draftを変更しない', () => {
  assert.match(scrapbookEditorSource, /coverPreviewTemplateId/);
  assert.match(scrapbookEditorSource, /previewDraft/);
  assert.match(scrapbookEditorSource, /applyCoverTemplate/);
  assert.match(coverDesignPanelSource, /このデザインを使用/);
  assert.match(coverDesignPanelSource, /onPreviewTemplate\(template\.id\)/);
  assert.doesNotMatch(coverDesignPanelSource, /onThemeChange\(template\.id\)/);
});

await test('表紙編集は写真・デザイン・文字タブでDraftを共有する', () => {
  assert.match(coverEditorPanelSource, /role="tablist"/);
  assert.match(coverEditorPanelSource, /role="tab"/);
  assert.match(coverEditorPanelSource, /aria-selected/);
  assert.match(coverEditorPanelSource, /CoverPhotoPanel/);
  assert.match(coverEditorPanelSource, /CoverDesignPanel/);
  assert.match(coverEditorPanelSource, /CoverTextPanel/);
  assert.match(coverEditorPanelSource, /onChange\(\{ \.\.\.draft/);
});

await test('表紙編集は専用Bottom Sheetと既存Rendererを使い保存までRepositoryへ触れない', () => {
  assert.match(scrapbookEditorSource, /<CoverEditorPanel/);
  assert.match(scrapbookEditorSource, /表紙を編集/);
  assert.match(scrapbookEditorSource, /coverSettings: coverSettingsChanged \? \{/);
  assert.match(scrapbookEditorSource, /coverLayout: draft\.coverLayout/);
  assert.match(scrapbookEditorSource, /themeId: draft\.coverThemeId/);
  assert.match(scrapbookService, /\['coverSettings', current\.coverSettings, nextCoverSettings\]/);
  assert.match(scrapbookService, /\['coverLayout', current\.coverLayout, nextCoverLayout\]/);
  assert.doesNotMatch(scrapbookEditorSource, /repositories\./);
});

await test('表紙編集室のヘッダーは説明文を省きコンパクトに表示する', () => {
  assert.match(scrapbookEditorSource, /description=\{selectedPage\.pageKind === 'cover'[\s\S]*\? undefined/);
  assert.match(bottomSheetSource, /bottom-sheet__header--compact/);
  assert.match(stylesSource, /\.bottom-sheet__header--compact\s*\{[\s\S]*padding-block: var\(--space-2\)/);
});

await test('表紙編集室は完成プレビューと実際の旅行データを使う編集パネルを並べる', () => {
  assert.match(scrapbookEditorSource, /<CoverEditorStudio/);
  assert.match(coverEditorStudioSource, /<ScrapbookPagePreview/);
  assert.match(coverEditorStudioSource, /scrapbook-cover-studio__stage/);
  assert.match(coverEditorStudioSource, /scrapbook-cover-studio__controls/);
  assert.match(coverDesignPanelSource, /formatCompactDateRange/);
  assert.match(coverDesignPanelSource, /selectedAsset/);
  assert.match(coverEditorPanelSource, /startDate=\{tripDetail\.trip\.startDate\}/);
});

await test('スクラップブック編集はページ選択、保存、失敗時保持、破棄確認を備える', () => {
  assert.match(scrapbookEditorSource, /<PageNavigatorSheet/);
  assert.match(scrapbookEditorSource, /<SaveBar/);
  assert.match(scrapbookEditorSource, /<ConfirmDialog/);
  assert.match(scrapbookEditorSource, /secondaryLabel="破棄する"/);
  assert.match(scrapbookEditorSource, /useBlocker\(dirty \|\| hasPendingPhoto\)/);
  assert.match(scrapbookEditorSource, /入力内容は残っています/);
  assert.match(scrapbookEditorSource, /variant: 'success'/);
  assert.match(scrapbookEditorSource, /variant: 'error'/);
  assert.match(scrapbookEditorSource, /variant: 'info'/);
  assert.match(scrapbookPageNavigatorSource, /pageKind/);
  assert.match(scrapbookPageNavigatorSource, /自動生成/);
  assert.match(scrapbookSaveBarSource, /disabled=\{!dirty \|\| disabled\}/);
  assert.match(scrapbookPageEditorSource, /ページ名/);
  assert.match(scrapbookPageEditorSource, /このページを表示する/);
});

await test('スクラップブック編集室はページ送りと没入表示を備える', () => {
  assert.match(scrapbookEditorSource, /編集を終了/);
  assert.match(scrapbookEditorSource, /requestAdjacentPage/);
  assert.match(scrapbookEditorSource, /onPointerDown=\{handlePointerDown\}/);
  assert.match(scrapbookEditorSource, /onPointerUp=\{handlePointerUp\}/);
  assert.match(scrapbookEditorSource, /スクラップブックのページ移動/);
  assert.match(scrapbookEditorSource, /scrapbook-editor-active/);
  assert.match(scrapbookPageNavigatorSource, /雑誌全体を見渡す/);
  assert.match(scrapbookEditorSource, /tripDetail\.trip\.title/);
  assert.match(scrapbookSaveBarSource, /編集内容があります/);
  assert.match(scrapbookSaveBarSource, /最新の状態です/);
  assert.match(scrapbookSaveBarSource, /記録を更新/);
  assert.match(stylesSource, /body\.scrapbook-editor-active \.bottom-nav/);
  assert.match(stylesSource, /scrapbook-page-turn-next 280ms/);
  assert.match(stylesSource, /prefers-reduced-motion/);
});

await test('スクラップブック閲覧はpageKind別Rendererで雑誌を構成する', () => {
  assert.match(scrapbookViewerSource, /ScrapbookPageRenderer/);
  assert.match(scrapbookViewerSource, /ScrapbookCoverPage/);
  assert.match(scrapbookViewerSource, /StoryPage/);
  assert.match(scrapbookViewerSource, /TimelinePage/);
  assert.match(scrapbookViewerSource, /PhotoPage/);
  assert.match(scrapbookViewerSource, /PlacePage/);
  assert.match(scrapbookViewerSource, /EndingPage/);
  assert.match(scrapbookViewerSource, /FeaturePage/);
});

await test('スクラップブック閲覧はPhase2の表紙・ハイライト・テーマ情報を利用する', () => {
  assert.match(scrapbookViewerSource, /resolveScrapbookCoverPhotoId/);
  assert.match(scrapbookCoverLogicSource, /coverSettings\?\.photoId/);
  assert.match(scrapbookCoverLogicSource, /highlightPhotoIds/);
  assert.match(scrapbookViewerSource, /scrapbook\.themeId/);
  assert.match(coverDesignRegistrySource, /scrapbook\.layoutVariant/);
  assert.match(scrapbookViewerSource, /sortVisibleScrapbookPages/);
  assert.match(scrapbookViewerSource, /!block\.isHidden/);
  assert.match(scrapbookViewerSource, /showSubtitle !== false/);
  assert.match(scrapbookViewerSource, /showDate !== false/);
  assert.match(scrapbookViewerSource, /showLocation !== false/);
});

await test('スクラップブック閲覧は写真なしでも旅行データ由来の表紙を表示する', () => {
  assert.match(scrapbookViewerSource, /<TripJournalVisual/);
  assert.match(scrapbookViewerSource, /placeNames=\{tripDetail\.places/);
});

await test('スクラップブック閲覧の写真は遅延読込とObject URL解放を維持する', () => {
  assert.match(scrapbookMediaImageSource, /loading = 'lazy'/);
  assert.match(scrapbookMediaImageSource, /createMediaObjectUrl\(asset, 'thumbnail'\)/);
  assert.match(scrapbookMediaImageSource, /URL\.revokeObjectURL/);
});

await test('スクラップブックは上下ボタンでページとブロックを並び替えできる', () => {
  assert.match(scrapbookService, /moveScrapbookPage/);
  assert.match(scrapbookService, /moveScrapbookBlock/);
  assert.match(scrapbookPageNavigationSource, />↑<\/Button>/);
  assert.match(scrapbookPageNavigationSource, />↓<\/Button>/);
});

await test('スクラップブックの画像本体はJSONバックアップに含めない設計', () => {
  assert.match(localDbSource, /mediaAssetBlobs/);
  assert.match(localScrapbookRepository, /LocalMediaAssetBlobRepository/);
  assert.doesNotMatch(scrapbookModel, /base64/i);
});

await test('スクラップブックは写真と写真グリッドを端末内Blobから表示できる', () => {
  assert.match(scrapbookService, /addPhotoBlockFromFile/);
  assert.match(scrapbookService, /addPhotoGridBlockFromFiles/);
  assert.match(scrapbookService, /saveTripMediaAsset/);
  assert.match(mediaAssetValidationSource, /createThumbnail/);
  assert.match(scrapbookService, /createMediaObjectUrl/);
  assert.match(scrapbookViewerSource, /block\.type === 'photo'/);
  assert.match(scrapbookViewerSource, /block\.type === 'photo_grid'/);
  assert.match(scrapbookViewerSource, /<ScrapbookMediaImage/);
});

await test('MediaAsset Blob削除は対象2キーだけを同一Transactionで削除する', () => {
  assert.match(localScrapbookRepository, /deleteManyById\('mediaAssetBlobs'/);
  assert.match(localScrapbookRepository, /`\$\{assetId\}:original`/);
  assert.match(localScrapbookRepository, /`\$\{assetId\}:thumbnail`/);
  assert.doesNotMatch(localScrapbookRepository, /clearStore\('mediaAssetBlobs'\)/);
  assert.match(localDbSource, /function deleteManyById/);
  assert.match(localDbSource, /const transaction = db\.transaction\(storeName, 'readwrite'\)/);
  assert.match(localDbSource, /ids\.forEach\(\(id\) => store\.delete\(id\)\)/);
});

await test('SHA-256 ContentHasherは原本Blobの完全一致Hashを返す', async () => {
  const sameA = new Blob(['same-photo']);
  const sameB = new Blob(['same-photo']);
  const different = new Blob(['different-photo']);
  const first = await webCryptoContentHasher.sha256(sameA);
  assert.equal(first, await webCryptoContentHasher.sha256(sameB));
  assert.notEqual(first, await webCryptoContentHasher.sha256(different));
  assert.match(first, /^sha256:[0-9a-f]{64}$/);
  const nearLimit = new Blob([new Uint8Array(MAX_MEDIA_FILE_BYTES)]);
  assert.match(await webCryptoContentHasher.sha256(nearLimit), /^sha256:[0-9a-f]{64}$/);
});

await test('端末写真はJPEG、PNG、WebPを検証し、容量超過と非画像を拒否する', async () => {
  const processor = {
    decode: async () => ({ source: {}, width: 1200, height: 800 }),
    createThumbnail: async (_image, mimeType) => new Blob(['thumbnail'], { type: mimeType === 'image/png' ? 'image/png' : 'image/jpeg' }),
  };
  for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
    const file = new File(['image'], `photo.${type.split('/')[1]}`, { type });
    assert.equal(validateImageFile(file), type);
    const prepared = await prepareMediaImage(file, processor);
    assert.equal(prepared.width, 1200);
    assert.equal(prepared.height, 800);
  }
  assert.throws(
    () => validateImageFile(new File(['text'], 'memo.txt', { type: 'text/plain' })),
    /JPEG、PNG、WebP/,
  );
  assert.throws(
    () => validateImageFile(new File([new Uint8Array(MAX_MEDIA_FILE_BYTES + 1)], 'large.jpg', { type: 'image/jpeg' })),
    /12MB以下/,
  );
});

await test('画像デコードまたはサムネイル生成失敗時は保存処理へ進まない', async () => {
  const file = new File(['broken'], 'broken.jpg', { type: 'image/jpeg' });
  let blobSaves = 0;
  const persistence = {
    mediaAssetBlobs: { getById: async () => undefined, save: async (value) => { blobSaves += 1; return value; }, deleteByAssetId: async () => {} },
    mediaAssets: { list: async () => [], getById: async () => undefined, save: async (value) => value, softDelete: async () => {}, listByTripId: async () => [] },
  };
  await assert.rejects(
    prepareMediaImage(file, {
      decode: async () => { throw new Error('decode failed'); },
      createThumbnail: async () => new Blob(['unused']),
    }),
    /この画像を読み込めませんでした/,
  );
  await assert.rejects(
    prepareMediaImage(file, {
      decode: async () => ({ source: {}, width: 640, height: 480 }),
      createThumbnail: async () => { throw new Error('thumbnail failed'); },
    }),
    /プレビューを作成できませんでした/,
  );
  assert.equal(blobSaves, 0);
});

await test('Hash計算失敗時はThumbnail生成とBlob保存へ進まない', async () => {
  const file = new File(['image'], 'photo.jpg', { type: 'image/jpeg' });
  let thumbnailCreates = 0;
  await assert.rejects(
    prepareMediaImage(file, {
      decode: async () => ({ source: {}, width: 640, height: 480 }),
      createThumbnail: async () => { thumbnailCreates += 1; return new Blob(['thumbnail']); },
    }, {
      sha256: async () => { throw new Error('crypto unavailable'); },
    }),
    /重複確認に必要な情報/,
  );
  assert.equal(thumbnailCreates, 0);

  let blobSaves = 0;
  await assert.rejects(
    persistPreparedTripMediaAsset('trip-1', {
      file,
      mimeType: 'image/jpeg',
      width: 640,
      height: 480,
      thumbnailBlob: new Blob(['thumbnail']),
    }, {
      contentHasher: { sha256: async () => { throw new Error('crypto unavailable'); } },
      mediaAssetBlobs: { getById: async () => undefined, save: async (value) => { blobSaves += 1; return value; }, deleteByAssetId: async () => {} },
      mediaAssets: { list: async () => [], getById: async () => undefined, save: async (value) => value, softDelete: async () => {}, listByTripId: async () => [] },
    }),
    /端末に保存できませんでした/,
  );
  assert.equal(blobSaves, 0);
});

await test('MediaAsset保存は既定で通常旅行写真になり表紙専用optionsを保持する', async () => {
  const prepared = {
    file: new File(['image'], 'photo.jpg', { type: 'image/jpeg' }),
    mimeType: 'image/jpeg',
    width: 640,
    height: 480,
    thumbnailBlob: new Blob(['thumbnail'], { type: 'image/jpeg' }),
  };
  const savedAssets = [];
  const persistence = {
    mediaAssetBlobs: { getById: async () => undefined, save: async (value) => value, deleteByAssetId: async () => {} },
    mediaAssets: {
      list: async () => [],
      getById: async () => undefined,
      save: async (value) => { savedAssets.push(value); return value; },
      softDelete: async () => {},
      listByTripId: async () => [],
    },
  };

  const tripAsset = await persistPreparedTripMediaAsset('trip-1', prepared, persistence);
  const explicitTripAsset = await persistPreparedTripMediaAsset('trip-1', prepared, persistence, { usage: 'trip' });
  const coverAsset = await persistPreparedTripMediaAsset('trip-1', prepared, persistence, {
    usage: 'cover-only',
    ownerScrapbookId: 'scrapbook-1',
  });

  assert.equal(tripAsset.usage, 'trip');
  assert.equal(explicitTripAsset.usage, 'trip');
  assert.equal(coverAsset.usage, 'cover-only');
  assert.equal(coverAsset.ownerScrapbookId, 'scrapbook-1');
  assert.match(tripAsset.contentHash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(tripAsset.contentHash, explicitTripAsset.contentHash);
  assert.equal(tripAsset.contentHash, coverAsset.contentHash);
  assert.equal(savedAssets.length, 3);
});

await test('表紙専用MediaAssetは所有Scrapbookなしで保存を開始しない', async () => {
  const prepared = {
    file: new File(['image'], 'photo.jpg', { type: 'image/jpeg' }),
    mimeType: 'image/jpeg',
    width: 640,
    height: 480,
    thumbnailBlob: new Blob(['thumbnail'], { type: 'image/jpeg' }),
  };
  let blobSaves = 0;
  const persistence = {
    mediaAssetBlobs: {
      getById: async () => undefined,
      save: async (value) => { blobSaves += 1; return value; },
      deleteByAssetId: async () => {},
    },
    mediaAssets: { list: async () => [], getById: async () => undefined, save: async (value) => value, softDelete: async () => {}, listByTripId: async () => [] },
  };
  await assert.rejects(
    persistPreparedTripMediaAsset('trip-1', prepared, persistence, { usage: 'cover-only' }),
    /所有するスクラップブック/,
  );
  assert.equal(blobSaves, 0);
});

await test('MediaAssetの部分保存失敗時はBlobを補償削除する', async () => {
  const file = new File(['image'], 'photo.jpg', { type: 'image/jpeg' });
  const processor = {
    decode: async () => ({ source: {}, width: 640, height: 480 }),
    createThumbnail: async () => new Blob(['thumbnail'], { type: 'image/jpeg' }),
  };
  let blobSaves = 0;
  let blobDeletes = 0;
  let metadataSaves = 0;
  const persistence = {
    mediaAssetBlobs: {
      getById: async () => undefined,
      save: async (value) => {
        blobSaves += 1;
        if (blobSaves === 2) throw new Error('thumbnail store failed');
        return value;
      },
      deleteByAssetId: async () => { blobDeletes += 1; },
    },
    mediaAssets: {
      list: async () => [],
      getById: async () => undefined,
      save: async (value) => { metadataSaves += 1; return value; },
      softDelete: async () => {},
      listByTripId: async () => [],
    },
  };
  const prepared = await prepareMediaImage(file, processor);
  await assert.rejects(persistPreparedTripMediaAsset('trip-1', prepared, persistence), /端末に保存できませんでした/);
  assert.equal(blobDeletes, 1);
  assert.equal(metadataSaves, 0);
});

await test('MediaAssetメタデータ保存失敗時もBlobと見かけ上のAssetを補償削除する', async () => {
  const file = new File(['image'], 'photo.jpg', { type: 'image/jpeg' });
  const prepared = await prepareMediaImage(file, {
    decode: async () => ({ source: {}, width: 640, height: 480 }),
    createThumbnail: async () => new Blob(['thumbnail'], { type: 'image/jpeg' }),
  });
  let blobDeletes = 0;
  let assetDeletes = 0;
  const persistence = {
    mediaAssetBlobs: {
      getById: async () => undefined,
      save: async (value) => value,
      deleteByAssetId: async () => { blobDeletes += 1; },
    },
    mediaAssets: {
      list: async () => [],
      getById: async () => undefined,
      save: async () => { throw new Error('metadata store failed'); },
      softDelete: async () => { assetDeletes += 1; },
      listByTripId: async () => [],
    },
  };
  await assert.rejects(persistPreparedTripMediaAsset('trip-1', prepared, persistence), /端末に保存できませんでした/);
  assert.equal(blobDeletes, 1);
  assert.equal(assetDeletes, 1);
});

await test('完全一致検索はTrip写真と所有中の表紙専用写真だけを返す', async () => {
  const targetBlob = new Blob(['same-photo']);
  const targetHash = await webCryptoContentHasher.sha256(targetBlob);
  const now = '2026-07-25T00:00:00.000Z';
  const base = {
    userId: 'local-user', tripId: 'trip-1', usage: 'trip', storageType: 'local', mimeType: 'image/jpeg',
    fileSize: targetBlob.size, width: 640, height: 480, mediaSyncStatus: 'local_only', createdAt: now, updatedAt: now, syncStatus: 'pending',
  };
  const assets = [
    { ...base, id: 'trip-match', contentHash: targetHash, createdAt: '2026-07-20T00:00:00.000Z' },
    { ...base, id: 'own-cover', usage: 'cover-only', ownerScrapbookId: 'scrapbook-1', contentHash: targetHash, createdAt: '2026-07-24T00:00:00.000Z' },
    { ...base, id: 'other-cover', usage: 'cover-only', ownerScrapbookId: 'scrapbook-2', contentHash: targetHash },
    { ...base, id: 'deleted', contentHash: targetHash, deletedAt: now },
    { ...base, id: 'other-trip', tripId: 'trip-2', contentHash: targetHash },
    { ...base, id: 'different', contentHash: await webCryptoContentHasher.sha256(new Blob(['different'])) },
  ];
  const dependencies = {
    mediaAssets: {
      list: async () => assets,
      getById: async () => undefined,
      save: async (asset) => asset,
      softDelete: async () => {},
      listByTripId: async () => assets,
    },
    mediaAssetBlobs: { getById: async () => undefined, save: async (value) => value, deleteByAssetId: async () => {} },
  };
  const matches = await findExactDuplicateMediaAssetsWithDependencies({
    tripId: 'trip-1',
    scrapbookId: 'scrapbook-1',
    contentHash: targetHash,
    fileInfo: { fileSize: targetBlob.size, mimeType: 'image/jpeg', width: 640, height: 480 },
  }, dependencies);
  assert.deepEqual(matches.map((match) => match.asset.id), ['trip-match', 'own-cover']);
  assert.ok(matches.every((match) => match.matchType === 'exact'));
});

await test('完全一致検索は候補を絞ってHashなしAssetを遅延計算しMissing Blobを無視する', async () => {
  const targetBlob = new Blob(['same-photo']);
  const targetHash = await webCryptoContentHasher.sha256(targetBlob);
  const now = '2026-07-25T00:00:00.000Z';
  const base = {
    userId: 'local-user', tripId: 'trip-1', usage: 'trip', storageType: 'local', mimeType: 'image/jpeg',
    width: 640, height: 480, mediaSyncStatus: 'local_only', createdAt: now, updatedAt: now, syncStatus: 'pending',
  };
  const assets = [
    { ...base, id: 'lazy-match', fileSize: targetBlob.size, localReference: 'lazy:original' },
    { ...base, id: 'size-mismatch', fileSize: targetBlob.size + 1, localReference: 'size:original' },
    { ...base, id: 'missing-original', fileSize: targetBlob.size, localReference: 'missing:original' },
  ];
  const hashedBlobIds = [];
  const saved = [];
  const matches = await findExactDuplicateMediaAssetsWithDependencies({
    tripId: 'trip-1',
    contentHash: targetHash,
    fileInfo: { fileSize: targetBlob.size, width: 640, height: 480 },
  }, {
    contentHasher: {
      sha256: async (blob) => {
        hashedBlobIds.push(blob === targetBlob ? 'lazy:original' : 'unknown');
        return webCryptoContentHasher.sha256(blob);
      },
    },
    mediaAssets: {
      list: async () => assets,
      getById: async () => undefined,
      save: async (asset) => { saved.push(asset); return asset; },
      softDelete: async () => {},
      listByTripId: async () => assets,
    },
    mediaAssetBlobs: {
      getById: async (id) => id === 'lazy:original' ? { id, assetId: 'lazy-match', kind: 'original', blob: targetBlob, mimeType: 'image/jpeg', createdAt: now } : undefined,
      save: async (value) => value,
      deleteByAssetId: async () => {},
    },
  });
  assert.deepEqual(matches.map((match) => match.asset.id), ['lazy-match']);
  assert.deepEqual(hashedBlobIds, ['lazy:original']);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].contentHash, targetHash);
});

const referenceTestNow = '2026-07-26T00:00:00.000Z';
const referenceTestBase = {
  userId: 'local-user',
  createdAt: referenceTestNow,
  updatedAt: referenceTestNow,
  syncStatus: 'pending',
};
const referenceTestScrapbook = {
  ...referenceTestBase,
  id: 'scrapbook-1',
  tripId: 'trip-1',
  origin: 'generated',
  title: '京都の旅',
  coverSettings: { photoId: 'asset-target' },
  coverAssetId: 'asset-target',
  highlightPhotoIds: ['asset-target', 'asset-other', 'asset-target'],
  coverLayout: 'journal',
  themeId: 'journal',
  layoutMode: 'pages',
  status: 'draft',
  isFavorite: false,
  version: 1,
};
const referenceTestPage = {
  ...referenceTestBase,
  id: 'page-1',
  scrapbookId: 'scrapbook-1',
  title: '旅の景色',
  sortOrder: 10,
  pageKind: 'photo',
  layoutType: 'section',
};

await test('MediaAsset参照抽出は表紙・旧表紙・ハイライトの永続フィールドを個別に返す', () => {
  const references = findScrapbookMediaAssetReferences(referenceTestScrapbook, 'asset-target');
  assert.deepEqual(references.map((reference) => [reference.type, reference.field, reference.occurrenceIndex]), [
    ['scrapbook-cover', 'coverSettings.photoId', undefined],
    ['scrapbook-legacy-cover', 'coverAssetId', undefined],
    ['scrapbook-highlight', 'highlightPhotoIds', 0],
    ['scrapbook-highlight', 'highlightPhotoIds', 2],
  ]);
  assert.ok(references.every((reference) => reference.ownerLabel === '京都の旅'));
  assert.deepEqual(findScrapbookMediaAssetReferences(referenceTestScrapbook, 'missing'), []);
});

await test('MediaAsset参照抽出は写真を保持する5種類のBlockと配列内重複を網羅する', () => {
  const context = { tripId: 'trip-1', scrapbookId: 'scrapbook-1', page: referenceTestPage };
  const blocks = [
    { ...referenceTestBase, id: 'photo', pageId: 'page-1', type: 'photo', assetId: 'asset-target', title: '一枚', displaySize: 'large', sortOrder: 10 },
    { ...referenceTestBase, id: 'grid', pageId: 'page-1', type: 'photo_grid', assetIds: ['asset-target', 'asset-other', 'asset-target'], title: '景色', columns: 3, sortOrder: 20 },
    { ...referenceTestBase, id: 'meal', pageId: 'page-1', type: 'meal', name: '昼食', assetIds: ['asset-target'], isBestMeal: false, sortOrder: 30 },
    { ...referenceTestBase, id: 'ticket', pageId: 'page-1', type: 'ticket', assetId: 'asset-target', itemType: 'ticket', title: '乗車券', sortOrder: 40 },
    { ...referenceTestBase, id: 'purchase', pageId: 'page-1', type: 'purchase', name: 'お土産', assetIds: ['asset-target'], sortOrder: 50 },
    { ...referenceTestBase, id: 'place', pageId: 'page-1', type: 'place', locationId: 'place-1', snapshotName: '京都駅', sortOrder: 60 },
  ];
  const references = blocks.flatMap((block) => findBlockMediaAssetReferences(block, context, 'asset-target'));
  assert.deepEqual(references.map((reference) => [reference.blockType, reference.field, reference.occurrenceIndex]), [
    ['photo', 'assetId', undefined],
    ['photo_grid', 'assetIds', 0],
    ['photo_grid', 'assetIds', 2],
    ['meal', 'assetIds', 0],
    ['ticket', 'assetId', undefined],
    ['purchase', 'assetIds', 0],
  ]);
  assert.equal(references.some((reference) => reference.blockType === 'place'), false);
  assert.deepEqual(findBlockMediaAssetReferences({
    ...referenceTestBase, id: 'ticket-empty', pageId: 'page-1', type: 'ticket', itemType: 'ticket', title: '未設定', sortOrder: 70,
  }, context, 'asset-target'), []);
  assert.deepEqual(findBlockMediaAssetReferences({
    ...referenceTestBase, id: 'grid-empty', pageId: 'page-1', type: 'photo_grid', assetIds: [], columns: 2, sortOrder: 80,
  }, context, 'asset-target'), []);
});

await test('MediaAsset参照Graphは論理削除を除外し表紙・ページ・Block・配列順で安定する', () => {
  const pageLater = { ...referenceTestPage, id: 'page-z', title: '後のページ', sortOrder: 20 };
  const pageEarlier = { ...referenceTestPage, id: 'page-a', title: '先のページ', sortOrder: 10 };
  const pageDeleted = { ...referenceTestPage, id: 'page-deleted', deletedAt: referenceTestNow, sortOrder: 1 };
  const photoBlock = (id, pageId, sortOrder, extra = {}) => ({
    ...referenceTestBase, id, pageId, type: 'photo_grid', assetIds: ['asset-target'], columns: 2, sortOrder, ...extra,
  });
  const references = collectMediaAssetReferencesFromScrapbookGraph({
    scrapbook: referenceTestScrapbook,
    pages: [
      { page: pageLater, blocks: [photoBlock('block-z', pageLater.id, 10), photoBlock('block-a', pageLater.id, 10)] },
      { page: pageDeleted, blocks: [photoBlock('deleted-page-block', pageDeleted.id, 1)] },
      { page: pageEarlier, blocks: [
        photoBlock('deleted-block', pageEarlier.id, 1, { deletedAt: referenceTestNow }),
        photoBlock('block-first', pageEarlier.id, 5),
      ] },
    ],
  }, 'asset-target');
  assert.deepEqual(references.map((reference) => reference.type), [
    'scrapbook-cover', 'scrapbook-legacy-cover', 'scrapbook-highlight', 'scrapbook-highlight',
    'scrapbook-block', 'scrapbook-block', 'scrapbook-block',
  ]);
  assert.deepEqual(references.filter((reference) => reference.blockId).map((reference) => reference.blockId), [
    'block-first', 'block-a', 'block-z',
  ]);
  assert.equal(references.some((reference) => reference.blockId?.includes('deleted')), false);
  assert.deepEqual(collectMediaAssetReferencesFromScrapbookGraph({
    scrapbook: { ...referenceTestScrapbook, deletedAt: referenceTestNow },
    pages: [{ page: pageEarlier, blocks: [photoBlock('block', pageEarlier.id, 1)] }],
  }, 'asset-target'), []);
});

await test('MediaAsset参照サマリーは削除前の参照解除要否を集計する', () => {
  const references = collectMediaAssetReferencesFromScrapbookGraph({
    scrapbook: referenceTestScrapbook,
    pages: [{
      page: referenceTestPage,
      blocks: [{ ...referenceTestBase, id: 'photo', pageId: 'page-1', type: 'photo', assetId: 'asset-target', displaySize: 'large', sortOrder: 10 }],
    }],
  }, 'asset-target');
  assert.deepEqual(summarizeMediaAssetReferences(references), {
    totalCount: 5,
    coverCount: 2,
    highlightCount: 2,
    blockCount: 1,
    canDeleteWithoutDetaching: false,
  });
  assert.deepEqual(summarizeMediaAssetReferences([]), {
    totalCount: 0,
    coverCount: 0,
    highlightCount: 0,
    blockCount: 0,
    canDeleteWithoutDetaching: true,
  });
});

function createReferenceServiceDependencies(overrides = {}) {
  const photoBlock = { ...referenceTestBase, id: 'photo', pageId: 'page-1', type: 'photo', assetId: 'asset-target', displaySize: 'large', sortOrder: 10 };
  return {
    mediaAssets: { getById: async () => ({ ...referenceTestBase, id: 'asset-target', tripId: 'trip-1' }) },
    scrapbooks: { list: async () => [referenceTestScrapbook, { ...referenceTestScrapbook, id: 'scrapbook-other', tripId: 'trip-2' }] },
    scrapbookPages: { listByScrapbookId: async (scrapbookId) => scrapbookId === 'scrapbook-1' ? [referenceTestPage] : [] },
    scrapbookBlocks: { listByPageId: async (pageId) => pageId === 'page-1' ? [photoBlock] : [] },
    ...overrides,
  };
}

await test('MediaAsset参照ServiceはAssetのTripへ範囲を絞り永続Graphだけを検索する', async () => {
  const calls = [];
  const dependencies = createReferenceServiceDependencies({
    scrapbookPages: {
      listByScrapbookId: async (scrapbookId) => {
        calls.push(scrapbookId);
        return scrapbookId === 'scrapbook-1' ? [referenceTestPage] : [];
      },
    },
  });
  const references = await findMediaAssetReferencesWithDependencies({ assetId: 'asset-target' }, dependencies);
  assert.deepEqual(calls, ['scrapbook-1']);
  assert.deepEqual(references.map((reference) => reference.type), [
    'scrapbook-cover', 'scrapbook-legacy-cover', 'scrapbook-highlight', 'scrapbook-highlight', 'scrapbook-block',
  ]);
  assert.ok(references.every((reference) => reference.tripId === 'trip-1'));
});

await test('MediaAsset参照Serviceはmetadata欠損時も全ScrapbookからDangling参照を検索できる', async () => {
  const dependencies = createReferenceServiceDependencies({
    mediaAssets: { getById: async () => undefined },
    scrapbookPages: {
      listByScrapbookId: async (scrapbookId) => scrapbookId === 'scrapbook-1' ? [referenceTestPage] : [],
    },
  });
  const references = await findMediaAssetReferencesWithDependencies({ assetId: 'asset-target' }, dependencies);
  assert.ok(references.length > 0);
  assert.deepEqual([...new Set(references.map((reference) => reference.scrapbookId))], [
    'scrapbook-1', 'scrapbook-other',
  ]);
});

await test('MediaAsset参照Serviceは取得失敗を参照0件として扱わず段階付きErrorを返す', async () => {
  await assert.rejects(findMediaAssetReferencesWithDependencies({ assetId: 'asset-target' }, createReferenceServiceDependencies({
    mediaAssets: { getById: async () => { throw new Error('asset failed'); } },
  })), /写真情報の取得中/);
  await assert.rejects(findMediaAssetReferencesWithDependencies({ assetId: 'asset-target', tripId: 'trip-1' }, createReferenceServiceDependencies({
    scrapbooks: { list: async () => { throw new Error('scrapbooks failed'); } },
  })), /スクラップブック一覧の取得中/);
  await assert.rejects(findMediaAssetReferencesWithDependencies({ assetId: 'asset-target' }, createReferenceServiceDependencies({
    scrapbookPages: { listByScrapbookId: async () => { throw new Error('pages failed'); } },
  })), /ページ取得中/);
  await assert.rejects(findMediaAssetReferencesWithDependencies({ assetId: 'asset-target' }, createReferenceServiceDependencies({
    scrapbookBlocks: { listByPageId: async () => { throw new Error('blocks failed'); } },
  })), /ブロック取得中/);
});

await test('MediaAsset参照検索は派生表示・Draft・Pending・Blob参照を永続参照へ数えない', () => {
  const references = findBlockMediaAssetReferences({
    ...referenceTestBase,
    id: 'text',
    pageId: 'page-1',
    type: 'text',
    title: 'Home Hero TimeMachine Draft Pending localReference asset-target',
    text: 'asset-target',
    textStyle: 'body',
    sortOrder: 10,
  }, { tripId: 'trip-1', scrapbookId: 'scrapbook-1', page: referenceTestPage }, 'asset-target');
  assert.deepEqual(references, []);
});

function createDetachmentBlocks() {
  return [
    { ...referenceTestBase, id: 'photo', pageId: 'page-1', type: 'photo', assetId: 'asset-target', title: '一枚', body: '本文', displaySize: 'large', sortOrder: 10 },
    { ...referenceTestBase, id: 'grid', pageId: 'page-1', type: 'photo_grid', assetIds: ['asset-target', 'asset-other', 'asset-target'], title: '景色', body: '本文', columns: 3, sortOrder: 20 },
    { ...referenceTestBase, id: 'meal', pageId: 'page-1', type: 'meal', name: '昼食', body: '本文', assetIds: ['asset-other', 'asset-target', 'asset-target'], isBestMeal: false, sortOrder: 30 },
    { ...referenceTestBase, id: 'ticket', pageId: 'page-1', type: 'ticket', assetId: 'asset-target', itemType: 'ticket', title: '乗車券', body: '本文', sortOrder: 40 },
    { ...referenceTestBase, id: 'purchase', pageId: 'page-1', type: 'purchase', name: 'お土産', body: '本文', assetIds: ['asset-target', 'asset-other'], sortOrder: 50 },
  ];
}

function createDetachmentReferences() {
  const context = { tripId: 'trip-1', scrapbookId: 'scrapbook-1', page: referenceTestPage };
  return [
    ...findScrapbookMediaAssetReferences(referenceTestScrapbook, 'asset-target'),
    ...createDetachmentBlocks().flatMap((block) => findBlockMediaAssetReferences(block, context, 'asset-target')),
  ];
}

await test('写真参照一覧は表紙の新旧参照と同一Block内の複数出現をまとめて件数表示できる', () => {
  const groups = groupMediaAssetReferences(createDetachmentReferences());
  assert.deepEqual(groups.map((group) => [group.kind, group.occurrenceCount, group.detachable]), [
    ['cover', 2, true],
    ['highlight', 2, true],
    ['photo', 1, false],
    ['photo-grid', 2, true],
    ['meal', 2, true],
    ['ticket', 1, true],
    ['purchase', 1, true],
  ]);
  assert.deepEqual(groups[0].fields, ['coverSettings.photoId', 'coverAssetId']);
  assert.equal(groups[0].ownerLabel, '京都の旅');
  assert.equal(groups.find((group) => group.kind === 'photo-grid').pageLabel, '旅の景色');
});

await test('解除用純粋関数は対象写真だけを外し本文・順序・Block設定を維持する', () => {
  const now = '2026-08-01T00:00:00.000Z';
  const scrapbook = detachMediaAssetFromScrapbook(
    referenceTestScrapbook,
    'asset-target',
    new Set(['cover', 'highlight']),
    now,
  );
  assert.equal(scrapbook.coverSettings.photoId, undefined);
  assert.equal(scrapbook.coverAssetId, undefined);
  assert.deepEqual(scrapbook.highlightPhotoIds, ['asset-other']);
  assert.equal(scrapbook.title, referenceTestScrapbook.title);
  assert.equal(scrapbook.version, referenceTestScrapbook.version + 1);

  const [photo, grid, meal, ticket, purchase] = createDetachmentBlocks();
  assert.equal(detachMediaAssetFromBlock(photo, 'asset-target', now), undefined);
  const detachedGrid = detachMediaAssetFromBlock(grid, 'asset-target', now);
  const detachedMeal = detachMediaAssetFromBlock(meal, 'asset-target', now);
  const detachedTicket = detachMediaAssetFromBlock(ticket, 'asset-target', now);
  const detachedPurchase = detachMediaAssetFromBlock(purchase, 'asset-target', now);
  assert.deepEqual(detachedGrid.assetIds, ['asset-other']);
  assert.deepEqual(detachedMeal.assetIds, ['asset-other']);
  assert.equal(detachedTicket.assetId, undefined);
  assert.deepEqual(detachedPurchase.assetIds, ['asset-other']);
  for (const [before, after] of [[grid, detachedGrid], [meal, detachedMeal], [ticket, detachedTicket], [purchase, detachedPurchase]]) {
    assert.equal(after.body, before.body);
    assert.equal(after.sortOrder, before.sortOrder);
    assert.equal(after.type, before.type);
  }
});

function createDetachmentDependencies({ references, failBlockSave = false } = {}) {
  const calls = [];
  const blocks = new Map(createDetachmentBlocks().map((block) => [block.id, block]));
  let scrapbook = referenceTestScrapbook;
  let findCount = 0;
  const scriptedReferences = references ?? createDetachmentReferences();
  return {
    calls,
    get scrapbook() { return scrapbook; },
    get blocks() { return blocks; },
    dependencies: {
      scrapbooks: {
        getById: async () => { calls.push('scrapbook:get'); return scrapbook; },
        save: async (next) => { calls.push('scrapbook:save'); scrapbook = next; return next; },
      },
      scrapbookBlocks: {
        getById: async (id) => { calls.push(`block:get:${id}`); return blocks.get(id); },
        save: async (next) => {
          calls.push(`block:save:${next.id}`);
          if (failBlockSave) throw new Error('block save failed');
          blocks.set(next.id, next);
          return next;
        },
      },
      findReferences: async () => {
        calls.push('references:find');
        findCount += 1;
        return findCount <= 2 ? scriptedReferences : [];
      },
      now: () => '2026-08-01T00:00:00.000Z',
    },
  };
}

await test('参照解除Serviceは実行直前と更新後に再検索し参照0件だけ削除可能と返す', async () => {
  const references = createDetachmentReferences().filter((reference) => (
    reference.type !== 'scrapbook-block' || reference.blockType === 'photo_grid'
  ));
  const keys = groupMediaAssetReferences(references).map((group) => group.key);
  const state = createDetachmentDependencies({ references });
  const result = await detachMediaAssetReferencesWithDependencies({
    assetId: 'asset-target', tripId: 'trip-1', selectedGroupKeys: keys,
  }, state.dependencies);
  assert.equal(result.canDelete, true);
  assert.equal(result.detachedCover, true);
  assert.deepEqual(result.remainingReferences, []);
  assert.deepEqual(state.calls, [
    'references:find', 'references:find', 'scrapbook:get', 'block:get:grid',
    'scrapbook:save', 'block:save:grid', 'references:find',
  ]);
  assert.equal(state.scrapbook.coverSettings.photoId, undefined);
  assert.equal(state.scrapbook.coverAssetId, undefined);
  assert.deepEqual(state.blocks.get('grid').assetIds, ['asset-other']);
  assert.match(mediaAssetReferenceDetachmentServiceSource, /findReferences: findMediaAssetReferences/);
});

await test('解除不可のPhotoBlock、未保存Draft、参照再検索失敗では永続データを変更しない', async () => {
  const photoReference = createDetachmentReferences().filter((reference) => reference.blockType === 'photo');
  const photoKey = groupMediaAssetReferences(photoReference)[0].key;
  for (const input of [
    { assetId: 'asset-target', tripId: 'trip-1', selectedGroupKeys: [photoKey] },
    { assetId: 'asset-target', tripId: 'trip-1', selectedGroupKeys: ['scrapbook:scrapbook-1:cover'], protectedAssetIds: ['asset-target'] },
  ]) {
    const state = createDetachmentDependencies({ references: photoReference });
    await assert.rejects(
      detachMediaAssetReferencesWithDependencies(input, state.dependencies),
      (error) => error instanceof MediaAssetReferenceDetachmentError
        && ['unsupported-reference', 'transient-reference'].includes(error.code),
    );
    assert.equal(state.calls.some((call) => call.includes(':save')), false);
  }

  const state = createDetachmentDependencies({ references: createDetachmentReferences() });
  let checks = 0;
  state.dependencies.findReferences = async () => {
    checks += 1;
    if (checks === 2) throw new Error('latest reference failed');
    return createDetachmentReferences();
  };
  await assert.rejects(
    detachMediaAssetReferencesWithDependencies({
      assetId: 'asset-target', tripId: 'trip-1', selectedGroupKeys: ['scrapbook:scrapbook-1:cover'],
    }, state.dependencies),
    (error) => error instanceof MediaAssetReferenceDetachmentError && error.code === 'reference-search-failed',
  );
  assert.equal(state.calls.some((call) => call.includes(':save')), false);
});

await test('一部参照の更新失敗時は削除可能とせず再試行情報を返す', async () => {
  const references = createDetachmentReferences().filter((reference) => (
    reference.type === 'scrapbook-cover'
    || reference.type === 'scrapbook-legacy-cover'
    || reference.blockType === 'photo_grid'
  ));
  const state = createDetachmentDependencies({ references, failBlockSave: true });
  await assert.rejects(
    detachMediaAssetReferencesWithDependencies({
      assetId: 'asset-target',
      tripId: 'trip-1',
      selectedGroupKeys: groupMediaAssetReferences(references).map((group) => group.key),
    }, state.dependencies),
    (error) => error instanceof MediaAssetReferenceDetachmentError
      && error.code === 'update-failed'
      && error.retryable
      && error.updatedGroupKeys.includes('scrapbook:scrapbook-1:cover'),
  );
  assert.equal(state.calls.includes('scrapbook:save'), true);
  assert.equal(state.calls.includes('block:save:grid'), true);
  assert.equal(state.calls.filter((call) => call === 'references:find').length, 2);
});

await test('同じ参照解除を再実行しても追加更新せず安全に完了する', async () => {
  const state = createDetachmentDependencies({ references: [] });
  const result = await detachMediaAssetReferencesWithDependencies({
    assetId: 'asset-target',
    tripId: 'trip-1',
    selectedGroupKeys: ['scrapbook:scrapbook-1:cover'],
  }, state.dependencies);
  assert.equal(result.canDelete, true);
  assert.deepEqual(result.updatedGroupKeys, []);
  assert.equal(state.calls.some((call) => call.includes(':get') || call.includes(':save')), false);
  assert.equal(state.calls.filter((call) => call === 'references:find').length, 3);
});

await test('参照解除UIは明示選択・解除可否・解除後の別段階削除をアクセシブルに表示する', () => {
  assert.match(mediaDeleteDialogSource, /使用中の参照/);
  assert.match(mediaDeleteDialogSource, /type="checkbox"/);
  assert.match(mediaDeleteDialogSource, /解除可能/);
  assert.match(mediaDeleteDialogSource, /先に編集が必要/);
  assert.match(mediaDeleteDialogSource, /選択した参照を解除/);
  assert.match(mediaDeleteDialogSource, /写真を削除/);
  assert.match(mediaDeleteDialogSource, /new Set\(\)/);
  assert.match(mediaDeleteDialogSource, /protectedByDraft/);
  assert.match(stylesSource, /\.scrapbook-media-references__list > label[\s\S]*min-height: var\(--tap-target-min\)/);
});

const integrityHash = `sha256:${'a'.repeat(64)}`;

function createIntegrityAsset(id, overrides = {}) {
  return {
    ...referenceTestBase,
    id,
    tripId: 'trip-1',
    usage: 'trip',
    contentHash: integrityHash,
    storageType: 'local',
    localReference: `${id}:original`,
    thumbnailReference: `${id}:thumbnail`,
    mimeType: 'image/png',
    mediaSyncStatus: 'local_only',
    ...overrides,
  };
}

function createIntegrityBlob(assetId, kind, overrides = {}) {
  return {
    id: `${assetId}:${kind}`,
    assetId,
    kind,
    blob: new Blob([`${assetId}:${kind}`], { type: 'image/png' }),
    ...overrides,
  };
}

function createIntegritySnapshot(overrides = {}) {
  return {
    mediaAssets: [],
    mediaAssetBlobs: [],
    scrapbooks: [],
    scrapbookPages: [],
    scrapbookBlocks: [],
    ...overrides,
  };
}

await test('Integrity Scanは正常なtrip写真と未使用cover-only素材を異常扱いしない', () => {
  const tripAsset = createIntegrityAsset('asset-trip');
  const coverAsset = createIntegrityAsset('asset-cover', {
    usage: 'cover-only', ownerScrapbookId: 'scrapbook-owner',
  });
  const report = buildMediaIntegrityReport(createIntegritySnapshot({
    mediaAssets: [tripAsset, coverAsset],
    mediaAssetBlobs: [
      createIntegrityBlob(tripAsset.id, 'original'), createIntegrityBlob(tripAsset.id, 'thumbnail'),
      createIntegrityBlob(coverAsset.id, 'original'), createIntegrityBlob(coverAsset.id, 'thumbnail'),
    ],
    scrapbooks: [{ ...referenceTestScrapbook, id: 'scrapbook-owner', coverSettings: undefined, coverAssetId: undefined, highlightPhotoIds: [] }],
  }), referenceTestNow);
  assert.equal(report.status, 'success');
  assert.deepEqual(report.issues, []);
  assert.equal(report.summary.totalIssues, 0);
  assert.equal(report.scanned.mediaAssets, 2);
});

await test('Integrity ScanはOrphan・不正Blob ID・Missing Blob・Cleanup Pendingを区別する', () => {
  const missingOriginal = createIntegrityAsset('asset-missing-original');
  const missingThumbnail = createIntegrityAsset('asset-missing-thumbnail');
  const missingBoth = createIntegrityAsset('asset-missing-both');
  const deleted = createIntegrityAsset('asset-deleted', { deletedAt: referenceTestNow });
  const report = buildMediaIntegrityReport(createIntegritySnapshot({
    mediaAssets: [missingOriginal, missingThumbnail, missingBoth, deleted],
    mediaAssetBlobs: [
      createIntegrityBlob(missingOriginal.id, 'thumbnail'),
      createIntegrityBlob(missingThumbnail.id, 'original'),
      createIntegrityBlob(deleted.id, 'original'),
      createIntegrityBlob(deleted.id, 'thumbnail'),
      createIntegrityBlob('asset-orphan', 'original'),
      createIntegrityBlob('asset-orphan', 'thumbnail'),
      createIntegrityBlob('asset-malformed', 'original', { id: 'not-a-valid-blob-id' }),
    ],
  }), referenceTestNow);
  assert.equal(report.summary.byType['orphan-blob'], 2);
  assert.equal(report.summary.byType['invalid-blob-id'], 1);
  assert.equal(report.summary.byType['missing-original'], 2);
  assert.equal(report.summary.byType['missing-thumbnail'], 2);
  assert.equal(report.summary.byType['cleanup-pending'], 2);
  assert.ok(report.issues.filter((issue) => issue.type === 'cleanup-pending').every((issue) => issue.repairability === 'repair-candidate'));
  assert.ok(report.issues.filter((issue) => issue.assetId === missingBoth.id).every((issue) => !['orphan-blob', 'cleanup-pending'].includes(issue.type)));
});

await test('Integrity ScanはBackup由来のBlob欠損を検出だけに留め削除可能とは判定しない', () => {
  const asset = createIntegrityAsset('asset-restored');
  const report = buildMediaIntegrityReport(createIntegritySnapshot({ mediaAssets: [asset] }), referenceTestNow);
  assert.deepEqual(report.issues.map((issue) => issue.type), ['missing-original', 'missing-thumbnail']);
  assert.equal(report.issues.find((issue) => issue.type === 'missing-original').repairability, 'manual');
  assert.equal('canDelete' in report.summary, false);
});

await test('Integrity Scanはcover-only所有先の欠損・不存在・削除済み・Trip不一致を生データから検出する', () => {
  const assets = [
    createIntegrityAsset('cover-owner-missing', { usage: 'cover-only', ownerScrapbookId: undefined }),
    createIntegrityAsset('cover-owner-unknown', { usage: 'cover-only', ownerScrapbookId: 'scrapbook-unknown' }),
    createIntegrityAsset('cover-owner-deleted', { usage: 'cover-only', ownerScrapbookId: 'scrapbook-deleted' }),
    createIntegrityAsset('cover-owner-mismatch', { usage: 'cover-only', ownerScrapbookId: 'scrapbook-other-trip' }),
  ];
  const report = buildMediaIntegrityReport(createIntegritySnapshot({
    mediaAssets: assets,
    mediaAssetBlobs: assets.flatMap((asset) => [createIntegrityBlob(asset.id, 'original'), createIntegrityBlob(asset.id, 'thumbnail')]),
    scrapbooks: [
      { ...referenceTestScrapbook, id: 'scrapbook-deleted', deletedAt: referenceTestNow },
      { ...referenceTestScrapbook, id: 'scrapbook-other-trip', tripId: 'trip-2' },
    ],
  }), referenceTestNow);
  assert.deepEqual(report.issues.filter((issue) => issue.type === 'invalid-cover-owner').map((issue) => issue.reason), [
    'owner-deleted', 'trip-mismatch', 'owner-missing', 'owner-not-found',
  ]);
});

await test('Integrity ScanはBlob参照とcontentHashの形式不整合を内容再Hashなしで報告する', () => {
  const asset = createIntegrityAsset('asset-invalid-fields', {
    localReference: 'other:original',
    thumbnailReference: 'other:thumbnail',
    contentHash: `sha256:${'A'.repeat(64)}`,
  });
  const report = buildMediaIntegrityReport(createIntegritySnapshot({
    mediaAssets: [asset],
    mediaAssetBlobs: [createIntegrityBlob(asset.id, 'original'), createIntegrityBlob(asset.id, 'thumbnail')],
  }), referenceTestNow);
  assert.deepEqual(report.issues.map((issue) => [issue.type, issue.field]), [
    ['invalid-blob-reference', 'localReference'],
    ['invalid-blob-reference', 'thumbnailReference'],
    ['invalid-content-hash', 'contentHash'],
  ]);
});

await test('Integrity Scanは全写真参照Blockの不存在・論理削除Asset参照を検出する', () => {
  const missingId = 'asset-missing-reference';
  const deletedId = 'asset-deleted-reference';
  const scrapbook = {
    ...referenceTestScrapbook,
    coverSettings: { photoId: missingId },
    coverAssetId: missingId,
    highlightPhotoIds: [missingId, missingId],
  };
  const blocks = createDetachmentBlocks().map((block) => {
    if (block.type === 'photo' || block.type === 'ticket') return { ...block, assetId: missingId };
    return { ...block, assetIds: block.assetIds.map(() => missingId) };
  });
  blocks.push({ ...referenceTestBase, id: 'deleted-target-ticket', pageId: 'page-1', type: 'ticket', assetId: deletedId, itemType: 'ticket', title: '削除済み', sortOrder: 60 });
  const report = buildMediaIntegrityReport(createIntegritySnapshot({
    mediaAssets: [createIntegrityAsset(deletedId, { deletedAt: referenceTestNow })],
    scrapbooks: [scrapbook],
    scrapbookPages: [referenceTestPage],
    scrapbookBlocks: blocks,
  }), referenceTestNow);
  const dangling = report.issues.filter((issue) => issue.type === 'dangling-reference');
  assert.equal(dangling.filter((issue) => issue.reason === 'metadata-missing').length, 14);
  assert.equal(dangling.filter((issue) => issue.reason === 'metadata-deleted').length, 1);
  assert.deepEqual(new Set(dangling.map((issue) => issue.field)), new Set([
    'coverSettings.photoId', 'coverAssetId', 'highlightPhotoIds', 'assetId', 'assetIds',
  ]));
});

await test('Integrity Scanは削除済み・所有元欠損のPage／Block参照を通常参照と分けて報告する', () => {
  const asset = createIntegrityAsset('asset-valid-reference');
  const deletedScrapbook = { ...referenceTestScrapbook, id: 'scrapbook-deleted-source', coverSettings: { photoId: asset.id }, coverAssetId: undefined, highlightPhotoIds: [], deletedAt: referenceTestNow };
  const deletedPage = { ...referenceTestPage, id: 'page-deleted-source', deletedAt: referenceTestNow };
  const deletedBlock = { ...referenceTestBase, id: 'block-deleted-source', pageId: 'page-1', type: 'ticket', assetId: asset.id, itemType: 'ticket', title: '削除済み', sortOrder: 10, deletedAt: referenceTestNow };
  const missingPageBlock = { ...referenceTestBase, id: 'block-missing-page', pageId: 'page-missing', type: 'photo_grid', assetIds: [asset.id], columns: 2, sortOrder: 20 };
  const pageDeletedBlock = { ...referenceTestBase, id: 'block-on-deleted-page', pageId: deletedPage.id, type: 'meal', name: '記録', assetIds: [asset.id], isBestMeal: false, sortOrder: 30 };
  const activeScrapbook = { ...referenceTestScrapbook, coverSettings: undefined, coverAssetId: undefined, highlightPhotoIds: [] };
  const report = buildMediaIntegrityReport(createIntegritySnapshot({
    mediaAssets: [asset],
    mediaAssetBlobs: [createIntegrityBlob(asset.id, 'original'), createIntegrityBlob(asset.id, 'thumbnail')],
    scrapbooks: [activeScrapbook, deletedScrapbook],
    scrapbookPages: [referenceTestPage, deletedPage],
    scrapbookBlocks: [deletedBlock, missingPageBlock, pageDeletedBlock],
  }), referenceTestNow);
  assert.deepEqual(
    report.issues.filter((issue) => issue.type === 'stale-reference-source').map((issue) => issue.reason).sort(),
    ['block-deleted', 'page-deleted', 'page-missing', 'scrapbook-deleted'],
  );
  assert.equal(report.issues.some((issue) => issue.type === 'dangling-reference'), false);
});

await test('Integrity Reportはtype・旅行・Asset・参照位置の安定順とSummaryを持つ', () => {
  const report = buildMediaIntegrityReport(createIntegritySnapshot({
    mediaAssets: [createIntegrityAsset('z-asset'), createIntegrityAsset('a-asset')],
    mediaAssetBlobs: [createIntegrityBlob('orphan-z', 'thumbnail'), createIntegrityBlob('orphan-a', 'original')],
  }), referenceTestNow);
  const typeIndexes = report.issues.map((issue) => MEDIA_INTEGRITY_ISSUE_TYPES.indexOf(issue.type));
  assert.deepEqual(typeIndexes, typeIndexes.slice().sort((left, right) => left - right));
  assert.deepEqual(report.issues.filter((issue) => issue.type === 'orphan-blob').map((issue) => issue.assetId), ['orphan-a', 'orphan-z']);
  assert.equal(report.summary.totalIssues, report.issues.length);
  assert.equal(report.summary.errorCount + report.summary.warningCount, report.issues.length);
  assert.equal(Object.keys(report.summary.byType).length, MEDIA_INTEGRITY_ISSUE_TYPES.length);
});

function createIntegrityScanDependencies(overrides = {}) {
  const calls = [];
  const track = (name, value) => async () => { calls.push(name); return value; };
  return {
    calls,
    dependencies: {
      listMediaAssetsRaw: track('media-assets', []),
      listMediaAssetBlobsRaw: track('media-asset-blobs', []),
      listScrapbooksRaw: track('scrapbooks', []),
      listScrapbookPagesRaw: track('scrapbook-pages', []),
      listScrapbookBlocksRaw: track('scrapbook-blocks', []),
      now: () => referenceTestNow,
      ...overrides,
    },
  };
}

await test('Integrity Scan Serviceは5 Storeを各1回だけ走査し入力データを変更しない', async () => {
  const asset = createIntegrityAsset('asset-read-once');
  const snapshot = createIntegritySnapshot({
    mediaAssets: [asset],
    mediaAssetBlobs: [createIntegrityBlob(asset.id, 'original'), createIntegrityBlob(asset.id, 'thumbnail')],
  });
  const before = structuredClone(snapshot);
  const state = createIntegrityScanDependencies({
    listMediaAssetsRaw: async () => { state.calls.push('media-assets'); return snapshot.mediaAssets; },
    listMediaAssetBlobsRaw: async () => { state.calls.push('media-asset-blobs'); return snapshot.mediaAssetBlobs; },
    listScrapbooksRaw: async () => { state.calls.push('scrapbooks'); return snapshot.scrapbooks; },
    listScrapbookPagesRaw: async () => { state.calls.push('scrapbook-pages'); return snapshot.scrapbookPages; },
    listScrapbookBlocksRaw: async () => { state.calls.push('scrapbook-blocks'); return snapshot.scrapbookBlocks; },
  });
  const report = await scanMediaAssetIntegrityWithDependencies(state.dependencies);
  assert.equal(report.summary.totalIssues, 0);
  assert.deepEqual(state.calls.slice().sort(), ['media-asset-blobs', 'media-assets', 'scrapbook-blocks', 'scrapbook-pages', 'scrapbooks']);
  assert.deepEqual(snapshot, before);
  assert.equal((mediaIntegrityDataSourceSource.match(/readAll</g) ?? []).length, 5);
  assert.doesNotMatch(mediaIntegrityDataSourceSource, /putOne|delete|clearStore/);
  assert.match(mediaIntegrityServiceSource, /scanMediaAssetIntegrityWithDependencies/);
});

await test('Integrity Scanは部分取得失敗と完全取得失敗を空の正常結果にしない', async () => {
  const partial = createIntegrityScanDependencies({
    listMediaAssetBlobsRaw: async () => { partial.calls.push('media-asset-blobs'); throw new Error('blob read failed'); },
  });
  await assert.rejects(
    scanMediaAssetIntegrityWithDependencies(partial.dependencies),
    (error) => error instanceof MediaIntegrityScanError
      && error.code === 'partial-read-failure'
      && error.failedStages.includes('media-asset-blobs')
      && error.completedStages.length === 4,
  );
  assert.equal(partial.calls.length, 5);

  const failure = async () => { throw new Error('read failed'); };
  const complete = createIntegrityScanDependencies({
    listMediaAssetsRaw: failure,
    listMediaAssetBlobsRaw: failure,
    listScrapbooksRaw: failure,
    listScrapbookPagesRaw: failure,
    listScrapbookBlocksRaw: failure,
  });
  await assert.rejects(
    scanMediaAssetIntegrityWithDependencies(complete.dependencies),
    (error) => error instanceof MediaIntegrityScanError
      && error.code === 'complete-read-failure'
      && error.failedStages.length === 5
      && error.completedStages.length === 0,
  );
});

function createIntegrityRepairState({ assets = [], blobs = [], scanReport } = {}) {
  const assetMap = new Map(assets.map((asset) => [asset.id, structuredClone(asset)]));
  const blobMap = new Map(blobs.map((blob) => [blob.id, blob]));
  const calls = [];
  const state = {
    assetMap,
    blobMap,
    calls,
    failMetadataSave: false,
    failThumbnail: false,
    dependencies: {
      getMediaAssetRaw: async (id) => { calls.push(`asset:get:${id}`); return assetMap.get(id); },
      listMediaAssetsRaw: async () => { calls.push('asset:list'); return [...assetMap.values()]; },
      saveMediaAssetRaw: async (asset) => {
        calls.push(`asset:save:${asset.id}`);
        if (state.failMetadataSave) throw new Error('metadata save failed');
        assetMap.set(asset.id, asset);
        return asset;
      },
      getMediaAssetBlobRaw: async (id) => { calls.push(`blob:get:${id}`); return blobMap.get(id); },
      saveMediaAssetBlobRaw: async (blob) => { calls.push(`blob:save:${blob.id}`); blobMap.set(blob.id, blob); return blob; },
      deleteMediaAssetBlobById: async (id) => { calls.push(`blob:delete:${id}`); blobMap.delete(id); },
      deleteMediaAssetBlobsByAssetId: async (assetId) => {
        calls.push(`blobs:delete:${assetId}`);
        blobMap.delete(`${assetId}:original`);
        blobMap.delete(`${assetId}:thumbnail`);
      },
      createThumbnail: async () => {
        calls.push('thumbnail:create');
        if (state.failThumbnail) throw new Error('thumbnail failed');
        return new Blob(['new-thumbnail'], { type: 'image/jpeg' });
      },
      scan: async () => scanReport ?? buildMediaIntegrityReport(createIntegritySnapshot(), referenceTestNow),
      now: () => referenceTestNow,
    },
  };
  return state;
}

function createRepairIssue(type, overrides = {}) {
  return {
    type,
    severity: type === 'missing-thumbnail' ? 'warning' : 'error',
    repairability: 'repair-candidate',
    reason: 'metadata-missing',
    ...overrides,
  };
}

await test('Integrity修復はMissing Thumbnailを既存originalから再生成して参照を揃える', async () => {
  const asset = createIntegrityAsset('repair-thumbnail', { thumbnailReference: 'legacy-thumbnail' });
  const issue = createRepairIssue('missing-thumbnail', { assetId: asset.id, blobId: `${asset.id}:thumbnail`, tripId: asset.tripId });
  const state = createIntegrityRepairState({ assets: [asset], blobs: [createIntegrityBlob(asset.id, 'original')] });
  const repair = await repairMediaIntegrityIssueWithDependencies(issue, state.dependencies);
  assert.equal(repair.status, 'success');
  assert.equal(state.blobMap.get(`${asset.id}:thumbnail`).kind, 'thumbnail');
  assert.equal(state.assetMap.get(asset.id).thumbnailReference, `${asset.id}:thumbnail`);
  assert.equal(state.assetMap.get(asset.id).contentHash, asset.contentHash);
  assert.equal(state.assetMap.get(asset.id).usage, asset.usage);
});

await test('Integrity修復はoriginal欠損またはThumbnail生成失敗でMetadataを変更しない', async () => {
  const asset = createIntegrityAsset('repair-thumbnail-fail', { thumbnailReference: 'legacy-thumbnail' });
  const issue = createRepairIssue('missing-thumbnail', { assetId: asset.id, blobId: `${asset.id}:thumbnail` });
  const missingState = createIntegrityRepairState({ assets: [asset] });
  const missing = await repairMediaIntegrityIssueWithDependencies(issue, missingState.dependencies);
  assert.equal(missing.status, 'skipped');
  assert.equal(missing.code, 'precondition-failed');
  assert.equal(missingState.calls.some((call) => call.startsWith('asset:save')), false);

  const failedState = createIntegrityRepairState({ assets: [asset], blobs: [createIntegrityBlob(asset.id, 'original')] });
  failedState.failThumbnail = true;
  const failed = await repairMediaIntegrityIssueWithDependencies(issue, failedState.dependencies);
  assert.equal(failed.status, 'failed');
  assert.equal(failed.code, 'thumbnail-generation-failed');
  assert.equal(failedState.calls.some((call) => call.startsWith('asset:save')), false);
});

await test('Integrity修復はThumbnail Metadata更新失敗時に新Blobを補償削除する', async () => {
  const asset = createIntegrityAsset('repair-thumbnail-compensation', { thumbnailReference: 'legacy-thumbnail' });
  const issue = createRepairIssue('missing-thumbnail', { assetId: asset.id, blobId: `${asset.id}:thumbnail` });
  const state = createIntegrityRepairState({ assets: [asset], blobs: [createIntegrityBlob(asset.id, 'original')] });
  state.failMetadataSave = true;
  const repair = await repairMediaIntegrityIssueWithDependencies(issue, state.dependencies);
  assert.equal(repair.status, 'failed');
  assert.equal(repair.code, 'metadata-save-failed');
  assert.equal(state.blobMap.has(`${asset.id}:thumbnail`), false);
  assert.equal(state.assetMap.get(asset.id).thumbnailReference, 'legacy-thumbnail');
});

await test('Integrity修復はCleanup Pendingを論理削除済み再確認後に対象2 Blobだけ清掃する', async () => {
  const deleted = createIntegrityAsset('repair-cleanup', { deletedAt: referenceTestNow });
  const other = createIntegrityAsset('repair-cleanup-other');
  const issue = createRepairIssue('cleanup-pending', { assetId: deleted.id, blobId: `${deleted.id}:original` });
  const state = createIntegrityRepairState({
    assets: [deleted, other],
    blobs: [
      createIntegrityBlob(deleted.id, 'original'), createIntegrityBlob(deleted.id, 'thumbnail'),
      createIntegrityBlob(other.id, 'original'), createIntegrityBlob(other.id, 'thumbnail'),
    ],
  });
  const repair = await repairMediaIntegrityIssueWithDependencies(issue, state.dependencies);
  assert.equal(repair.status, 'success');
  assert.equal(state.blobMap.has(`${deleted.id}:original`), false);
  assert.equal(state.blobMap.has(`${deleted.id}:thumbnail`), false);
  assert.equal(state.blobMap.has(`${other.id}:original`), true);

  state.assetMap.set(deleted.id, { ...deleted, deletedAt: undefined });
  const stale = await repairMediaIntegrityIssueWithDependencies(issue, state.dependencies);
  assert.equal(stale.status, 'skipped');
  assert.equal(stale.code, 'stale-issue');
});

await test('Integrity修復はOrphanと不正形式Blobを再検証し対象キーだけ削除する', async () => {
  const orphan = createIntegrityBlob('repair-orphan', 'original');
  const malformed = createIntegrityBlob('repair-malformed', 'thumbnail', { id: 'malformed-blob-key' });
  const state = createIntegrityRepairState({ blobs: [orphan, malformed] });
  const orphanIssue = createRepairIssue('orphan-blob', { assetId: orphan.assetId, blobId: orphan.id });
  const malformedIssue = createRepairIssue('invalid-blob-id', { assetId: malformed.assetId, blobId: malformed.id, reason: 'invalid-format' });
  assert.equal((await repairMediaIntegrityIssueWithDependencies(orphanIssue, state.dependencies)).status, 'success');
  assert.equal((await repairMediaIntegrityIssueWithDependencies(malformedIssue, state.dependencies)).status, 'success');
  assert.equal(state.blobMap.size, 0);

  const recreatedState = createIntegrityRepairState({ assets: [createIntegrityAsset(orphan.assetId)], blobs: [orphan] });
  const recreated = await repairMediaIntegrityIssueWithDependencies(orphanIssue, recreatedState.dependencies);
  assert.equal(recreated.status, 'skipped');
  assert.equal(recreatedState.blobMap.has(orphan.id), true);
});

await test('Integrity修復は有効Metadataが参照する不正形式Blobを削除しない', async () => {
  const malformed = createIntegrityBlob('repair-referenced-malformed', 'original', { id: 'legacy-blob-key' });
  const asset = createIntegrityAsset(malformed.assetId, { localReference: malformed.id });
  const state = createIntegrityRepairState({ assets: [asset], blobs: [malformed] });
  const issue = createRepairIssue('invalid-blob-id', { assetId: asset.id, blobId: malformed.id, reason: 'invalid-format' });
  const repair = await repairMediaIntegrityIssueWithDependencies(issue, state.dependencies);
  assert.equal(repair.status, 'skipped');
  assert.equal(repair.code, 'precondition-failed');
  assert.equal(state.blobMap.has(malformed.id), true);
});

await test('Integrity修復は既定Blobが存在する現在値だけを正規参照へ更新する', async () => {
  const asset = createIntegrityAsset('repair-reference', { localReference: 'legacy-original' });
  const issue = createRepairIssue('invalid-blob-reference', {
    assetId: asset.id,
    field: 'localReference',
    expectedValue: `${asset.id}:original`,
    actualValue: 'legacy-original',
    reason: 'reference-mismatch',
  });
  const state = createIntegrityRepairState({ assets: [asset], blobs: [createIntegrityBlob(asset.id, 'original')] });
  const repair = await repairMediaIntegrityIssueWithDependencies(issue, state.dependencies);
  assert.equal(repair.status, 'success');
  assert.equal(state.assetMap.get(asset.id).localReference, `${asset.id}:original`);

  const repeated = await repairMediaIntegrityIssueWithDependencies(issue, state.dependencies);
  assert.equal(repeated.status, 'skipped');
  const missingState = createIntegrityRepairState({ assets: [asset] });
  const missing = await repairMediaIntegrityIssueWithDependencies(issue, missingState.dependencies);
  assert.equal(missing.status, 'skipped');
  assert.equal(missing.code, 'precondition-failed');
});

await test('Integrity修復は対象外Issueを変更せず、各結果と修復後再Scanを返す', async () => {
  const unsupported = [
    createRepairIssue('missing-original', { assetId: 'missing-original' }),
    createRepairIssue('dangling-reference', { assetId: 'dangling' }),
    createRepairIssue('invalid-cover-owner', { assetId: 'owner' }),
  ];
  assert.ok(unsupported.every((issue) => getMediaIntegrityRepairAction(issue) === undefined));
  const report = buildMediaIntegrityReport(createIntegritySnapshot(), referenceTestNow);
  const state = createIntegrityRepairState({ scanReport: report });
  const batch = await repairMediaIntegrityIssuesWithDependencies(unsupported, state.dependencies);
  assert.equal(batch.rescanStatus, 'success');
  assert.equal(batch.report, report);
  assert.ok(batch.results.every((item) => item.status === 'skipped' && item.code === 'unsupported-issue'));
  assert.equal(state.calls.length, 0);
});

await test('Integrity修復は一部失敗を個別結果へ残し再Scan失敗も区別する', async () => {
  const asset = createIntegrityAsset('repair-partial', { thumbnailReference: 'legacy' });
  const issue = createRepairIssue('missing-thumbnail', { assetId: asset.id, blobId: `${asset.id}:thumbnail` });
  const unsupported = createRepairIssue('missing-original', { assetId: 'unsupported' });
  const state = createIntegrityRepairState({ assets: [asset], blobs: [createIntegrityBlob(asset.id, 'original')] });
  state.failThumbnail = true;
  state.dependencies.scan = async () => { throw new Error('rescan failed'); };
  const batch = await repairMediaIntegrityIssuesWithDependencies([issue, unsupported], state.dependencies);
  assert.equal(batch.results[0].status, 'failed');
  assert.equal(batch.results[1].status, 'skipped');
  assert.equal(batch.rescanStatus, 'failed');
  assert.equal(batch.report, undefined);
});

await test('写真データ診断UIは明示実行・Summary・分類・確認・Loading・再診断を備える', () => {
  assert.match(mediaIntegrityPanelSource, /写真データ診断/);
  assert.match(mediaIntegrityPanelSource, /診断を実行/);
  assert.match(mediaIntegrityPanelSource, /正常/);
  assert.match(mediaIntegrityPanelSource, /注意/);
  assert.match(mediaIntegrityPanelSource, /要確認/);
  assert.match(mediaIntegrityPanelSource, /ConfirmDialog/);
  assert.match(mediaIntegrityPanelSource, /aria-busy/);
  assert.match(mediaIntegrityPanelSource, /aria-live/);
  assert.match(mediaIntegrityPanelSource, /repair\.report/);
  assert.match(settingsPageSource, /MediaIntegrityPanel/);
  assert.match(stylesSource, /\.media-integrity__issues li[\s\S]*minmax\(0, 1fr\)/);
  assert.match(stylesSource, /@media \(max-width: 560px\)[\s\S]*\.media-integrity__issues li \.button[\s\S]*min-height: var\(--tap-target-min\)/);
  assert.match(mediaIntegrityRepairDataSourceSource, /deleteManyById\('mediaAssetBlobs', \[id\]\)/);
  assert.doesNotMatch(mediaIntegrityRepairDataSourceSource, /clearStore/);
});

function createDeletionDependencies(overrides = {}) {
  const calls = [];
  const asset = {
    ...referenceTestBase,
    id: 'asset-delete',
    tripId: 'trip-1',
    usage: 'trip',
    storageType: 'local',
    mimeType: 'image/jpeg',
    mediaSyncStatus: 'local_only',
  };
  return {
    calls,
    dependencies: {
      mediaAssets: {
        getById: async () => { calls.push('metadata:get'); return asset; },
        softDelete: async () => { calls.push('metadata:softDelete'); },
      },
      mediaAssetBlobs: {
        deleteByAssetId: async () => { calls.push('blobs:delete'); },
      },
      findReferences: async () => { calls.push('references:find'); return []; },
      ...overrides,
    },
  };
}

await test('参照ゼロ写真の削除は直前確認後にMetadataと2種Blobを順に削除する', async () => {
  const { calls, dependencies } = createDeletionDependencies();
  const result = await deleteUnreferencedMediaAssetWithDependencies({ assetId: 'asset-delete' }, dependencies);
  assert.deepEqual(calls, ['metadata:get', 'references:find', 'metadata:softDelete', 'blobs:delete']);
  assert.deepEqual(result, {
    assetId: 'asset-delete',
    tripId: 'trip-1',
    usage: 'trip',
    metadataWasPresent: true,
    metadataDeleted: true,
    blobsDeleted: true,
    removeFromLists: true,
  });
  assert.match(mediaAssetDeletionServiceSource, /findReferences: findMediaAssetReferences/);
});

await test('表紙・旧表紙・ハイライト・各Blockの参照が1件でもあれば削除しない', async () => {
  const referenceTypes = [
    ['scrapbook-cover', 'coverSettings.photoId'],
    ['scrapbook-legacy-cover', 'coverAssetId'],
    ['scrapbook-highlight', 'highlightPhotoIds'],
    ['scrapbook-block', 'assetId'],
    ['scrapbook-block', 'assetIds'],
  ];
  for (const [type, field] of referenceTypes) {
    const { calls, dependencies } = createDeletionDependencies({
      findReferences: async () => [{
        type,
        field,
        assetId: 'asset-delete',
        tripId: 'trip-1',
        scrapbookId: 'scrapbook-1',
      }],
    });
    await assert.rejects(
      deleteUnreferencedMediaAssetWithDependencies({ assetId: 'asset-delete' }, dependencies),
      (error) => error instanceof MediaAssetDeletionError && error.code === 'referenced' && error.references.length === 1,
    );
    assert.deepEqual(calls, ['metadata:get']);
  }
});

await test('参照検索失敗時は専用Errorで削除を禁止する', async () => {
  const { calls, dependencies } = createDeletionDependencies({
    findReferences: async () => { throw new Error('reference failed'); },
  });
  await assert.rejects(
    deleteUnreferencedMediaAssetWithDependencies({ assetId: 'asset-delete' }, dependencies),
    (error) => error instanceof MediaAssetDeletionError
      && error.code === 'reference-search-failed'
      && error.retryable
      && !error.metadataDeleted,
  );
  assert.deepEqual(calls, ['metadata:get']);
});

await test('Metadata更新失敗時はBlobを削除しない', async () => {
  const calls = [];
  const { dependencies } = createDeletionDependencies({
    mediaAssets: {
      getById: async () => ({ ...referenceTestBase, id: 'asset-delete', tripId: 'trip-1', usage: 'trip' }),
      softDelete: async () => { calls.push('metadata:softDelete'); throw new Error('metadata failed'); },
    },
    mediaAssetBlobs: { deleteByAssetId: async () => { calls.push('blobs:delete'); } },
  });
  await assert.rejects(
    deleteUnreferencedMediaAssetWithDependencies({ assetId: 'asset-delete' }, dependencies),
    (error) => error instanceof MediaAssetDeletionError && error.code === 'metadata-delete-failed' && !error.metadataDeleted,
  );
  assert.deepEqual(calls, ['metadata:softDelete']);
});

await test('Blob削除失敗はMetadata削除済みと再試行可能状態を明示する', async () => {
  let blobAttempts = 0;
  let metadataVisible = true;
  const { dependencies } = createDeletionDependencies({
    mediaAssets: {
      getById: async () => metadataVisible
        ? { ...referenceTestBase, id: 'asset-delete', tripId: 'trip-1', usage: 'cover-only', ownerScrapbookId: 'scrapbook-1' }
        : undefined,
      softDelete: async () => { metadataVisible = false; },
    },
    mediaAssetBlobs: {
      deleteByAssetId: async () => {
        blobAttempts += 1;
        if (blobAttempts === 1) throw new Error('blob failed');
      },
    },
  });
  await assert.rejects(
    deleteUnreferencedMediaAssetWithDependencies({ assetId: 'asset-delete' }, dependencies),
    (error) => error instanceof MediaAssetDeletionError
      && error.code === 'blob-delete-failed'
      && error.metadataDeleted
      && error.retryable,
  );
  const retryResult = await deleteUnreferencedMediaAssetWithDependencies({ assetId: 'asset-delete' }, dependencies);
  assert.equal(retryResult.metadataWasPresent, false);
  assert.equal(retryResult.blobsDeleted, true);
  assert.equal(blobAttempts, 2);
});

await test('削除処理はtripとcover-onlyを扱い、未保存Draft選択中は変更しない', async () => {
  for (const usage of ['trip', 'cover-only']) {
    const calls = [];
    const { dependencies } = createDeletionDependencies({
      mediaAssets: {
        getById: async () => ({
          ...referenceTestBase,
          id: `asset-${usage}`,
          tripId: 'trip-1',
          usage,
          ownerScrapbookId: usage === 'cover-only' ? 'scrapbook-1' : undefined,
        }),
        softDelete: async () => { calls.push('metadata:softDelete'); },
      },
      mediaAssetBlobs: { deleteByAssetId: async () => { calls.push('blobs:delete'); } },
    });
    const result = await deleteUnreferencedMediaAssetWithDependencies({ assetId: `asset-${usage}` }, dependencies);
    assert.equal(result.usage, usage);
    assert.deepEqual(calls, ['metadata:softDelete', 'blobs:delete']);
  }

  const { calls, dependencies } = createDeletionDependencies();
  await assert.rejects(
    deleteUnreferencedMediaAssetWithDependencies({
      assetId: 'asset-delete',
      protectedAssetIds: ['asset-delete'],
    }, dependencies),
    (error) => error instanceof MediaAssetDeletionError && error.code === 'transient-reference',
  );
  assert.deepEqual(calls, []);
});

await test('削除確認UIは写真・用途・使用中状態を示し成功時だけ候補一覧を更新する', () => {
  assert.match(mediaDeleteDialogSource, /写真を削除/);
  assert.match(mediaDeleteDialogSource, /isCoverOnlyMediaAsset\(asset\) \? '表紙専用' : '旅行写真'/);
  assert.match(mediaDeleteDialogSource, /使用中の参照/);
  assert.match(mediaDeleteDialogSource, /先に編集が必要/);
  assert.match(mediaDeleteDialogSource, /protectedByDraft/);
  assert.match(mediaDeleteDialogSource, /deleteUnreferencedMediaAsset/);
  assert.match(coverPhotoPanelSource, /scrapbook-cover-editor__photo-delete/);
  assert.match(coverPhotoPanelSource, /aria-label=\{`\$\{asset\.originalFileName \|\| '写真'\}を削除`\}/);
  assert.match(scrapbookEditorSource, /setAddedMediaAssets\(\(current\) => current\.filter\(\(asset\) => asset\.id !== assetId\)\)/);
  assert.match(stylesSource, /\.scrapbook-cover-editor__photo-delete\s*\{[\s\S]*min-height: var\(--tap-target-min\)/);
});

await test('表紙写真追加はPending確認後に保存し、古い非同期結果とObject URLを管理する', () => {
  assert.match(coverPhotoImportSource, /requestIdRef/);
  assert.match(coverPhotoImportSource, /savingRef/);
  assert.match(coverPhotoImportSource, /requestIdRef\.current !== requestId/);
  assert.match(coverPhotoImportSource, /URL\.revokeObjectURL/);
  assert.match(coverPhotoImportSource, /savePreparedTripMediaAsset/);
  assert.match(coverPhotoPanelSource, /accept="image\/\*"/);
  assert.match(coverPhotoPanelSource, /capture="environment"/);
  assert.match(coverPhotoPanelSource, /この写真を使う/);
  assert.match(coverPhotoPanelSource, /event\.currentTarget\.value = ''/);
  assert.match(scrapbookEditorSource, /追加中の写真があります/);
  assert.match(scrapbookEditorSource, /setDraft\(\(current\) => \(\{ \.\.\.current, coverPhotoId: asset\.id \}\)\)/);
  assert.doesNotMatch(coverPhotoPanelSource, /repositories\.|indexedDB|localStorage/);
  assert.match(mediaAssetPersistenceSource, /deleteByAssetId/);
});

await test('表紙写真追加UIはネイティブinputを隠し端末追加導線を一つにする', () => {
  assert.equal((coverPhotoPanelSource.match(/新しい写真を追加/g) ?? []).length, 1);
  assert.match(coverPhotoPanelSource, /className="scrapbook-cover-photo-input"/);
  assert.match(coverPhotoPanelSource, /tabIndex=\{-1\}/);
  assert.match(coverPhotoPanelSource, /aria-hidden="true"/);
  assert.match(stylesSource, /\.scrapbook-cover-photo-input\s*\{[\s\S]*clip-path: inset\(50%\)/);
  assert.doesNotMatch(coverPhotoPanelSource, /className="visually-hidden"/);
  assert.match(coverPhotoPanelSource, /input\?\.click\(\);[\s\S]*setSourceOpen\(false\)/);
  assert.match(coverPhotoPanelSource, /event\.currentTarget\.value = ''/);
});

await test('表紙写真追加UIは通常表示とPending確認を分離し再試行できる', () => {
  assert.match(coverPhotoPanelSource, /pendingPhoto \? \(/);
  assert.match(coverPhotoPanelSource, /追加前の写真/);
  assert.match(coverPhotoPanelSource, /写真を保存しています/);
  assert.match(coverPhotoPanelSource, /もう一度試す/);
  assert.match(coverPhotoPanelSource, /別の写真を選ぶ/);
  assert.match(coverPhotoPanelSource, /aria-busy=\{isBusy \|\| undefined\}/);
  assert.match(coverPhotoPanelSource, /initialFocusRef=\{sourcePrimaryActionRef\}/);
});

await test('表紙写真追加はPending内で保存先を選び用途に応じて保存する', () => {
  assert.match(coverPhotoImportSource, /destination: MediaAssetUsage/);
  assert.match(coverPhotoImportSource, /destination: 'trip'/);
  assert.match(coverPhotoImportSource, /ownerScrapbookId: scrapbookId/);
  assert.match(coverPhotoImportSource, /setDestination/);
  assert.match(coverPhotoPanelSource, /<fieldset className="scrapbook-cover-destination"/);
  assert.match(coverPhotoPanelSource, /旅行写真として追加/);
  assert.match(coverPhotoPanelSource, /表紙専用として追加/);
  assert.match(coverPhotoPanelSource, /disabled=\{isBusy\}/);
  assert.match(coverPhotoPanelSource, /表紙専用/);
});

await test('表紙写真追加は保存前に完全一致検索を行い古い検索結果を無視する', () => {
  assert.match(coverPhotoImportSource, /prepareMediaImage\(file\)[\s\S]*checkForDuplicates/);
  assert.match(coverPhotoImportSource, /findExactDuplicateMediaAssets/);
  assert.match(coverPhotoImportSource, /requestIdRef\.current !== requestId/);
  assert.match(coverPhotoImportSource, /status: 'checking-duplicates'/);
  assert.match(coverPhotoPanelSource, /同じ写真がないか確認しています/);
});

await test('完全一致写真はPending内で既存写真と比較できる', () => {
  assert.match(duplicatePhotoReviewSource, /同じ写真がすでに保存されています/);
  assert.match(duplicatePhotoReviewSource, /既存の写真/);
  assert.match(duplicatePhotoReviewSource, /今回選んだ写真/);
  assert.match(duplicatePhotoReviewSource, /既存写真を使う/);
  assert.match(duplicatePhotoReviewSource, /新しく追加する/);
  assert.match(duplicatePhotoReviewSource, /aria-live="polite"/);
  assert.match(duplicatePhotoReviewSource, /role="radiogroup"/);
});

await test('既存写真の再利用は新規保存せず表紙Draftだけを更新する', () => {
  const reuseImplementation = coverPhotoImportSource.match(/const reuseDuplicate[\s\S]*?\n  }, \[pending, releasePreview\]\);/)?.[0] ?? '';
  assert.match(reuseImplementation, /releasePreview\(\)/);
  assert.match(reuseImplementation, /setPending\(undefined\)/);
  assert.doesNotMatch(reuseImplementation, /savePreparedTripMediaAsset/);
  assert.match(scrapbookEditorSource, /const asset = coverPhotoImport\.reuseDuplicate\(\)/);
  assert.match(scrapbookEditorSource, /coverPhotoId: asset\.id/);
  assert.match(scrapbookEditorSource, /setAddedMediaAssets/);
});

await test('新規追加を選ぶと保存先とPendingを維持して重複確認を再表示しない', () => {
  assert.match(coverPhotoImportSource, /duplicateReviewStatus: 'bypassed'/);
  assert.match(coverPhotoImportSource, /\['none', 'bypassed'\]\.includes\(pending\.duplicateReviewStatus\)/);
  assert.match(coverPhotoPanelSource, /同じ写真を新しく追加します/);
  assert.match(coverPhotoPanelSource, /isDuplicateReview \?/);
  assert.match(coverPhotoPanelSource, /<fieldset className="scrapbook-cover-destination"/);
});

await test('重複検索失敗時はPendingを保ち再確認か確認なし追加を選べる', () => {
  assert.match(coverPhotoImportSource, /duplicateReviewStatus: 'error'/);
  assert.match(coverPhotoImportSource, /確認せずに新しく追加できます/);
  assert.match(coverPhotoPanelSource, /もう一度確認/);
  assert.match(coverPhotoPanelSource, /確認せず追加/);
  assert.match(coverPhotoPanelSource, /role="alert"/);
});

await test('表紙専用写真は通常写真の件数・本文・タイムマシンから除外する', () => {
  assert.match(tripJournalMediaHook, /filterTripMediaAssets\(detail\.mediaAssets\)/);
  assert.match(tripJournalMediaHook, /photoCount: tripMediaAssets\.length/);
  assert.match(tripJournalMediaHook, /const galleryAssets = tripMediaAssets\.slice\(0, 4\)/);
  assert.match(tripDetailPage, /const coverSource = media\.coverSource/);
  assert.match(timeMachineService, /const tripMediaAssets = filterTripMediaAssets\(mediaAssets\)/);
  assert.match(timeMachineService, /buildPhotoEvents\(tripMediaAssets/);
  assert.match(scrapbookViewerSource, /\.filter\(isTripMediaAsset\)/);
  assert.match(scrapbookService, /filterCoverAssetsForScrapbook\(mediaAssets, scrapbook\.id\)/);
});

await test('入れ子Overlayは最前面だけがEscとFocus Trapを処理する', () => {
  assert.match(overlaySource, /const overlayStack: symbol\[\] = \[\]/);
  assert.match(overlaySource, /overlayStack\.at\(-1\) !== overlayToken/);
  assert.match(overlaySource, /bodyScrollLockCount/);
  assert.match(overlaySource, /previousFocus\?\.isConnected/);
});

await test('スクラップブックの写真や記録ブロックは本文と補足メモを保持して表示する', () => {
  assert.match(scrapbookModel, /interface TextBlock[\s\S]*title\?: string/);
  assert.match(scrapbookModel, /interface PhotoBlock[\s\S]*body\?: string/);
  assert.match(scrapbookModel, /interface PhotoBlock[\s\S]*title\?: string/);
  assert.match(scrapbookModel, /interface PhotoGridBlock[\s\S]*body\?: string/);
  assert.match(scrapbookModel, /interface PhotoGridBlock[\s\S]*title\?: string/);
  assert.match(scrapbookModel, /interface MealBlock[\s\S]*body\?: string/);
  assert.match(scrapbookService, /body: optionalText\(input\.text\)/);
  assert.match(scrapbookService, /note: optionalText\(input\.note\)/);
  assert.match(scrapbookViewerSource, /block\.body && <p>\{block\.body\}<\/p>/);
  assert.match(scrapbookViewerSource, /block\.caption \|\| block\.note/);
});

await test('編集者モードは今回対象外の写真・ブロック編集を追加しない', () => {
  assert.doesNotMatch(scrapbookEditorSource, /addPhotoBlockFromFile|addPhotoGridBlockFromFiles|addScrapbookBlock/);
  assert.doesNotMatch(scrapbookEditorSource, /deleteScrapbookPage|deleteScrapbookBlock|moveScrapbookBlock/);
});

await test('GitHub Pagesのベースパス配下でも地図データを読み込む設定になっている', () => {
  assert.match(mapComponent, /import\.meta\.env\.BASE_URL\}maps\/japan-prefectures\.geojson/);
});

await test('PWAオフライン用キャッシュに地図データが含まれている', () => {
  assert.match(sw, /maps\/japan-prefectures\.geojson/);
});

await test('日本制覇マップは地図内だけをズームできる', () => {
  assert.match(mapComponent, /onWheel=\{interactive \? handleWheel : undefined\}/);
  assert.match(mapComponent, /event\.preventDefault\(\)/);
  assert.match(mapComponent, /viewport\.scale/);
  assert.match(mapComponent, /DEFAULT_VIEWPORT/);
  assert.match(mapComponent, /scale:\s*1,\s*x:\s*0,\s*y:\s*0/);
  assert.match(mapComponent, /onPointerMove=\{interactive \? handlePointerMove : undefined\}/);
  assert.match(mapComponent, /createPinchStart/);
  assert.match(mapComponent, /measurePinch/);
  assert.doesNotMatch(mapComponent, />\s*拡大\s*<\/button>/);
  assert.doesNotMatch(mapComponent, />\s*縮小\s*<\/button>/);
});

await test('日本制覇マップはズーム時に見やすい丸みと模様を持つ', () => {
  assert.match(mapComponent, /vectorEffect="non-scaling-stroke"/);
  assert.match(mapComponent, /strokeLinejoin="round"/);
  assert.match(mapComponent, /map-pattern-passed/);
  assert.match(mapComponent, /map-pattern-landed/);
  assert.match(mapComponent, /map-pattern-stayed/);
  assert.match(mapComponent, /map-pattern-lived/);
});

await test('日本制覇マップは沖縄を別枠で表示し本土を大きく見せる', () => {
  assert.match(mapComponent, /OKINAWA_CODE = '47'/);
  assert.match(mapComponent, /OKINAWA_INSET/);
  assert.match(mapComponent, /renderOkinawaInset/);
  assert.match(mapComponent, /okinawa-inset__hit-area/);
  assert.match(mapComponent, /MAINLAND_MAX_LON/);
});

await test('日本制覇マップは状態によって海岸線や県境線の太さを変えない', async () => {
  const styles = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8');
  const stayedBlock = styles.match(/\.status-stayed \{[^}]*\}/)?.[0] ?? '';
  const livedBlock = styles.match(/\.status-lived \{[^}]*\}/)?.[0] ?? '';
  assert.match(styles, /\.prefecture-shape[\s\S]*stroke-width:\s*0\.62/);
  assert.doesNotMatch(stayedBlock, /stroke-width/);
  assert.doesNotMatch(livedBlock, /stroke-width/);
});

await test('下部ナビゲーションにタブアイコンがある', async () => {
  assert.match(bottomNavigationSource, /bottom-nav__icon/);
  assert.match(navigationItemsSource, /icon:/);
});

await test('下部ナビゲーションは意味が伝わるSVGイラストを使う', async () => {
  assert.match(navigationItemsSource, /function NavSvg/);
  assert.match(navigationItemsSource, /function MapIcon/);
  assert.match(navigationItemsSource, /function SuitcaseIcon/);
  assert.match(navigationItemsSource, /function CollectionIcon/);
  assert.match(navigationItemsSource, /function MoreIcon/);
  assert.doesNotMatch(navigationItemsSource, /icon: '◎'|icon: '◇'/);
});


await test('城マスターはバンドル同梱でPWAオフライン閲覧できる設計', () => {
  assert.match(castleService, /repositories\.castleMaster\.list\(\)/);
  assert.match(castlePage, /getCastleCollectionView/);
});

await test('旅行の訪問場所から城コレクションへ連携できる', () => {
  assert.match(placeVisitForm, /城コレクション連携/);
  assert.match(tripService, /linkCastleVisitFromTripPlace\(place\)/);
  assert.match(castleService, /castle-visit:trip:\$\{place\.id\}/);
});

await test('城詳細で関連する旅行記録を表示する', () => {
  assert.match(castleService, /listCastleRelatedTrips/);
  assert.match(castlePage, /CastleRelatedTripList/);
  assert.ok(castlePage.includes('to={`/trips/${trip.tripId}`}'));
});

await test('城マップは検証済み座標がある場合だけプロットする', () => {
  assert.match(castlePage, /typeof row\.castle\.latitude === 'number'/);
  assert.match(castlePage, /検証済み座標がまだありません/);
});

await test('公式スタンプ認定と個人記録を混同しない表示がある', () => {
  assert.match(castlePage, /公式スタンプ・認定/);
  assert.match(castlePage, /個人メモ/);
});

await test('Cloudflare同期説明に城データの保存対象が含まれる', async () => {
  const settingsPage = await readFile(new URL('../src/pages/SettingsPage.tsx', import.meta.url), 'utf8');
  assert.match(settingsPage, /castleVisitSummaries/);
  assert.match(settingsPage, /castleVisitEvents/);
});

await test('GitHub Pagesのベースパス配下でも城画面ルートが動く', async () => {
  const router = await readFile(new URL('../src/app/router.tsx', import.meta.url), 'utf8');
  assert.match(router, /path: 'castles'/);
  assert.match(router, /basename: import\.meta\.env\.BASE_URL/);
});

await test('城の状態を変更すると保存用サマリーが作られる', () => {
  const summary = buildCastleSummaryFromInput('castle-j100-001', undefined, {
    status: 'visited',
    firstVisitedAt: '2026-07-18',
    lastVisitedAt: '',
    visitCount: 0,
    stampStatus: 'unknown',
    stampAcquiredAt: '',
    goshuinStatus: 'unknown',
    goshuinAcquiredAt: '',
    rating: '',
    isFavorite: false,
    note: '',
  }, '2026-07-18T00:00:00.000Z');
  assert.equal(summary.status, 'visited');
  assert.equal(summary.visitCount, 1);
  assert.equal(summary.firstVisitedAt, '2026-07-18');
});

await test('城の訪問制覇率は登城済みのみを対象にする', () => {
  const rows = mergeCastleRows(castleMaster, [
    { ...createEmptyCastleSummary('castle-j100-001', '2026-07-18T00:00:00.000Z'), status: 'visited', visitCount: 1 },
    { ...createEmptyCastleSummary('castle-j100-002', '2026-07-18T00:00:00.000Z'), status: 'planned', visitCount: 0 },
  ]);
  const stats = calculateCastleStats(rows);
  assert.equal(stats.visitedCount, 1);
  assert.equal(stats.plannedCount, 1);
  assert.equal(stats.visitedRate, 0.5);
});

await test('城スタンプ率と御城印率の計算が正しい', () => {
  const rows = mergeCastleRows(castleMaster, [
    { ...createEmptyCastleSummary('castle-j100-001', '2026-07-18T00:00:00.000Z'), stampStatus: 'acquired' },
    { ...createEmptyCastleSummary('castle-zoku-001', '2026-07-18T00:00:00.000Z'), goshuinStatus: 'acquired' },
  ]);
  const stats = calculateCastleStats(rows);
  assert.equal(stats.stampCount, 1);
  assert.equal(stats.goshuinCount, 1);
  assert.equal(stats.stampRate, 0.5);
});

await test('城の地方別・状態別・検索フィルターが正しく動く', () => {
  const rows = mergeCastleRows(castleMaster, [
    { ...createEmptyCastleSummary('castle-j100-001', '2026-07-18T00:00:00.000Z'), status: 'visited', visitCount: 1 },
  ]);
  assert.ok(filterCastleRows(rows, { query: '五稜郭', region: 'all', prefectureCode: 'all', series: 'all', status: 'all', stampStatus: 'all', goshuinStatus: 'all', favoriteOnly: false, sort: 'official' }).length >= 1);
  assert.equal(filterCastleRows(rows, { query: '', region: 'hokkaido', prefectureCode: 'all', series: 'all', status: 'visited', stampStatus: 'all', goshuinStatus: 'all', favoriteOnly: false, sort: 'official' }).length, 1);
});

await test('城検索は入力ごとに保存データを再読み込みしない', () => {
  assert.match(castlePage, /filterCastleRows\(data\.rows, filter\)/);
  assert.match(castlePage, /getCastleCollectionView\(getDefaultCastleFilter\(\)\), \[reloadKey\]/);
  assert.doesNotMatch(castlePage, /getCastleCollectionView\(filter\), \[filter, reloadKey\]/);
});

await test('城RPG経験値はsourceKeyで二重付与を防ぐ設計', () => {
  assert.match(castleService, /castle:first-visit:\$\{castle\.id\}/);
  assert.match(castleService, /castle:stamp:\$\{castle\.id\}/);
  assert.match(castleService, /castle:milestone:\$\{milestone\.count\}/);
});

await test('スクラップブックRPG経験値はsourceKeyで二重付与を防ぐ設計', () => {
  assert.match(scrapbookService, /scrapbook-created:\$\{scrapbookId\}/);
  assert.match(scrapbookService, /scrapbook-completed:\$\{scrapbookId\}/);
  assert.match(scrapbookService, /scrapbook-photo-milestone:\$\{scrapbookId\}:5/);
  assert.match(scrapbookService, /scrapbook-reflection-added:\$\{scrapbookId\}/);
});

await test('RPG初期レベルが1になる', () => {
  const level = calculateLevelProgress([]);
  assert.equal(level.currentLevel, 1);
  assert.equal(level.totalExp, 0);
});

await test('経験値付与後にtotalExpが正しく増える', () => {
  const level = calculateLevelProgress([{ effectiveAmount: 120 }]);
  assert.equal(level.totalExp, 120);
});

await test('必要経験値を超えるとレベルアップする', () => {
  const level = calculateLevelProgress([{ effectiveAmount: expRequiredForNextLevel(1) }]);
  assert.equal(level.currentLevel, 2);
});

await test('一度に複数レベル上がる場合も正しく計算される', () => {
  const level = calculateLevelProgress([{ effectiveAmount: 10000 }]);
  assert.ok(level.currentLevel > 5);
});

await test('同じsourceKeyはバックアップ正規化で重複除去される', () => {
  const normalized = normalizeBackupPayload({
    app: 'travel-log-pwa',
    schemaVersion: 3,
    data: {
      rpgExperienceEntries: [
        { id: 'a', amount: 10, effectiveAmount: 10, sourceKey: 'same' },
        { id: 'b', amount: 20, effectiveAmount: 20, sourceKey: 'same' },
      ],
    },
  });
  assert.equal(normalized.data.rpgExperienceEntries.length, 1);
});

await test('passedとlandedの都道府県は初訪問経験値の対象にならない', () => {
  assert.match(rpgProgressService, /status === 'unvisited' \|\| status === 'passed' \|\| status === 'landed'\) return/);
});

await test('visitedで初訪問経験値、stayed/livedで初宿泊経験値、livedで居住経験値が付与される定義がある', () => {
  assert.match(rpgProgressService, /prefecture-first-visit:\$\{prefectureCode\}/);
  assert.match(rpgProgressService, /prefecture-first-stay:\$\{prefectureCode\}/);
  assert.match(rpgProgressService, /prefecture-first-live:\$\{prefectureCode\}/);
  assert.equal(experienceRules.prefectureFirstLive, 250);
});

await test('ユーザー作成クエストEXPは上限500で丸められる', () => {
  assert.equal(experienceRules.customQuestRewardMax, 500);
});

await test('ユーザー作成クエストEXPが初期設定ではレベル計算に含まれない', async () => {
  const normalized = normalizeBackupPayload({ app: 'travel-log-pwa', schemaVersion: 3, data: {} });
  assert.equal(normalized.data.rpgSettings.length, 0);
  assert.match(await readFile(new URL('../src/features/rpg/rpgSettingsService.ts', import.meta.url), 'utf8'), /includeCustomQuestExpInLevel:\s*false/);
});

await test('実績は条件未達では解除されない値になる', () => {
  const stats = buildTravelStats({ tripTypes: [], placeVisitCount: 0, prefectures: [], collections: [], wishlistItemCount: 0 });
  assert.equal(getConditionValue(stats, 'tripCompletedCount'), 0);
  assert.equal(getConditionValue(stats, 'castleVisitedCount'), 0);
});

await test('条件達成時に実績マスターの対象値へ届く', () => {
  const stats = buildTravelStats({
    tripTypes: ['dayTrip'],
    placeVisitCount: 0,
    prefectures: [],
    collections: [],
    castleSummaries: [{ ...createEmptyCastleSummary('castle-j100-001', '2026-07-18T00:00:00.000Z'), status: 'visited', visitCount: 1 }],
    castleSeriesById: new Map([['castle-j100-001', 'japanese_100_castles']]),
    scrapbooks: [{ id: 'scrapbook-1', status: 'completed' }],
    wishlistItemCount: 0,
  });
  assert.equal(getConditionValue(stats, 'tripCompletedCount'), 1);
  assert.equal(getConditionValue(stats, 'castleVisitedCount'), 1);
  assert.equal(getConditionValue(stats, 'castleJapanese100VisitedCount'), 1);
  assert.equal(getConditionValue(stats, 'scrapbookCreatedCount'), 1);
  assert.equal(getConditionValue(stats, 'scrapbookCompletedCount'), 1);
  assert.equal(achievementMaster.find((item) => item.id === 'trip-1').targetValue, 1);
  assert.equal(achievementMaster.find((item) => item.id === 'castle-1').targetValue, 1);
  assert.equal(achievementMaster.find((item) => item.id === 'scrapbook-created-1').targetValue, 1);
});

await test('実績報酬EXPはsourceKeyで一度だけ付与される設計になっている', async () => {
  assert.match(await readFile(new URL('../src/features/rpg/achievementService.ts', import.meta.url), 'utf8'), /achievement-unlocked:\$\{master\.id\}/);
});

await test('称号を複数獲得できるマスターが存在する', () => {
  assert.ok(titleMaster.length >= 10);
});

await test('メイン称号を1つだけ設定する処理がある', async () => {
  const titleService = await readFile(new URL('../src/features/rpg/titleService.ts', import.meta.url), 'utf8');
  assert.match(titleService, /isEquipped: title\.titleId === titleId/);
});

await test('隠し実績は未解除時に条件を表示しない', async () => {
  const achievementService = await readFile(new URL('../src/features/rpg/achievementService.ts', import.meta.url), 'utf8');
  assert.match(achievementService, /？？？/);
});

await test('クエスト進捗は条件値から増える', () => {
  const stats = buildTravelStats({ tripTypes: ['dayTrip', 'overnight'], placeVisitCount: 3, prefectures: [], collections: [], wishlistItemCount: 1 });
  assert.equal(getConditionValue(stats, 'placeVisitCount'), 3);
});

await test('クエスト完了報酬は二重付与防止sourceKeyを持つ', async () => {
  const questService = await readFile(new URL('../src/features/rpg/questService.ts', import.meta.url), 'utf8');
  assert.match(questService, /quest-completed:\$\{nextQuest\.id\}/);
});

await test('期限切れクエストはexpiredになる実装がある', async () => {
  const questService = await readFile(new URL('../src/features/rpg/questService.ts', import.meta.url), 'utf8');
  assert.match(questService, /'expired'/);
});

await test('ユーザー作成クエストの追加、編集、削除関数がある', async () => {
  const questService = await readFile(new URL('../src/features/rpg/questService.ts', import.meta.url), 'utf8');
  assert.match(questService, /createCustomQuest/);
  assert.match(questService, /updateCustomQuest/);
  assert.match(questService, /deleteCustomQuest/);
});

await test('旅行完了時に経験値が付与される', () => {
  assert.match(tripService, /grantTripCompletionExperience\(trip\)/);
});

await test('旅行を再編集しても完了経験値が重複しないsourceKeyになっている', () => {
  assert.match(rpgProgressService, /trip-completed:\$\{trip\.id\}/);
});

await test('既訪問都道府県では再訪経験値sourceKeyを使う', () => {
  assert.match(rpgProgressService, /prefecture-revisit:\$\{prefectureCode\}:\$\{visitCount\}/);
});

await test('旅行リザルトを開くだけでは経験値付与Serviceを呼ばない', async () => {
  const tripResultPage = await readFile(new URL('../src/pages/TripResultPage.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(tripResultPage, /grantExperience/);
});

await test('JSONエクスポート/インポートでRPG情報が復元できる', () => {
  const normalized = normalizeBackupPayload({
    app: 'travel-log-pwa',
    schemaVersion: 3,
    data: {
      rpgExperienceEntries: [{ id: 'exp-1', amount: 10, effectiveAmount: 10, sourceKey: 'x' }],
      userRpgTitles: [{ id: 'title-1', titleId: 'first-traveler' }],
      userRpgAchievements: [{ id: 'ach-1', achievementId: 'trip-1' }],
      rpgQuests: [{ id: 'quest-1', status: 'available' }],
    },
  });
  assert.equal(normalized.data.rpgExperienceEntries.length, 1);
  assert.equal(normalized.data.userRpgTitles.length, 1);
  assert.equal(normalized.data.userRpgAchievements.length, 1);
  assert.equal(normalized.data.rpgQuests.length, 1);
});

await test('旧形式バックアップでもRPGデータなしでエラーにならない', () => {
  const normalized = normalizeBackupPayload({ app: 'travel-log-pwa', schemaVersion: 2, data: { trips: [] } });
  assert.equal(normalized.data.rpgExperienceEntries.length, 0);
});

await test('初回集計は複数回実行しても重複しないsourceKeyを使う', () => {
  assert.match(rpgProgressService, /ensureRpgProgressInitialized/);
  assert.match(rpgProgressService, /grantExperienceOnce/);
});

await test('PWAオフライン状態でもプロフィール表示に静的追加アセットが不要', () => {
  assert.match(rpgProfilePage, /冒険者プロフィール/);
});

await test('GitHub Pagesのベースパス配下でReact Routerが動く', async () => {
  const router = await readFile(new URL('../src/app/router.tsx', import.meta.url), 'utf8');
  assert.match(router, /basename: import\.meta\.env\.BASE_URL/);
});

await test('GitHub PagesのSPA fallbackはrootと既知Routeだけを対象にする', () => {
  assert.equal(spaFallback.BASE_PATH, '/travel-log-pwa/');
  assert.equal(spaFallback.isAppPath('/travel-log-pwa/'), true);
  assert.equal(spaFallback.isAppPath('/travel-log-pwa/trips'), true);
  assert.equal(spaFallback.isAppPath('/travel-log-pwa/trips/trip-1/scrapbook'), true);
  assert.equal(spaFallback.isAppPath('/travel-log-pwa/time-machine'), true);
  assert.equal(spaFallback.isAppPath('/travel-log-pwa/assets/missing.js'), false);
  assert.equal(spaFallback.isAppPath('/travel-log-pwa/api/trips'), false);
  assert.equal(spaFallback.isAppPath('/cdn-cgi/trace'), false);
});

await test('GitHub Pagesの404 redirectは深いURLのqueryとhashを保持する', () => {
  const redirectUrl = spaFallback.createRedirectUrl({
    origin: 'https://example.test',
    pathname: '/travel-log-pwa/trips/trip-1',
    search: '?tab=timeline&from=home',
    hash: '#visit-2',
  });
  const parsed = new URL(redirectUrl);
  assert.equal(parsed.pathname, '/travel-log-pwa/');
  assert.equal(parsed.searchParams.get('__spa'), '/travel-log-pwa/trips/trip-1?tab=timeline&from=home#visit-2');
});

await test('GitHub Pagesのroot、asset、API 404はSPA redirectへ変換しない', () => {
  for (const pathname of [
    '/travel-log-pwa/',
    '/travel-log-pwa/assets/missing.js',
    '/travel-log-pwa/api/trips',
    '/other-project/trips/trip-1',
  ]) {
    assert.equal(spaFallback.createRedirectUrl({ origin: 'https://example.test', pathname, search: '', hash: '' }), undefined);
  }
});

await test('React起動前にSPA redirectを履歴追加なしで元URLへ復元する', () => {
  const replacements = [];
  const restored = spaFallback.restoreRedirectLocation({
    origin: 'https://example.test',
    search: '?__spa=%2Ftravel-log-pwa%2Ftrips%2Ftrip-1%3Ftab%3Dtimeline%23visit-2',
  }, {
    replaceState: (...args) => replacements.push(args),
  });
  assert.equal(restored, true);
  assert.deepEqual(replacements, [[null, '', '/travel-log-pwa/trips/trip-1?tab=timeline#visit-2']]);
  assert.ok(indexHtml.indexOf('restoreRedirectLocation') < indexHtml.indexOf('/src/main.tsx'));
});

await test('SPA redirectは外部URLや未知Routeを復元しない', () => {
  const replacements = [];
  for (const target of ['https://other.test/trips/1', '/travel-log-pwa/unknown/path']) {
    const restored = spaFallback.restoreRedirectLocation({
      origin: 'https://example.test',
      search: `?__spa=${encodeURIComponent(target)}`,
    }, {
      replaceState: (...args) => replacements.push(args),
    });
    assert.equal(restored, false);
  }
  assert.deepEqual(replacements, []);
});

await test('GitHub Pages 404とService Workerは同じSPA Route判定を利用する', () => {
  assert.match(githubPages404Source, /\/travel-log-pwa\/spa-fallback\.js/);
  assert.match(githubPages404Source, /createRedirectUrl/);
  assert.match(githubPages404Source, /location\.replace/);
  assert.match(sw, /importScripts\('\.\/spa-fallback\.js'\)/);
  assert.match(sw, /TravelLogSpaFallback\.isAppPath/);
  assert.match(sw, /response\.status === 404/);
  assert.match(sw, /caches\.match\(BASE_PATH\)/);
  assert.match(sw, /if \(!response\.ok\) return response/);
});

await test('PWA起動とオフラインShellにSPA fallbackを含める', () => {
  const manifest = JSON.parse(manifestSource);
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
  assert.match(sw, /`\$\{BASE_PATH\}spa-fallback\.js`/);
  assert.match(sw, /travel-log-pwa-v4/);
});

await test('画面単位で遅延読み込みして初期JSを軽くする', () => {
  assert.match(routerSource, /lazyPage/);
  assert.match(routerSource, /Suspense/);
  assert.match(routerSource, /import\('\.\.\/pages\/TravelGachaPage'\)/);
  assert.doesNotMatch(routerSource, /import \{ TravelGachaPage \} from '\.\.\/pages\/TravelGachaPage'/);
});

await test('UI Phase2のDesign TokensとSafe Areaが定義されている', () => {
  assert.match(stylesSource, /--color-bg:/);
  assert.match(stylesSource, /--color-primary:/);
  assert.match(stylesSource, /--space-4:/);
  assert.match(stylesSource, /--radius-md:/);
  assert.match(stylesSource, /--shadow-card:/);
  assert.match(stylesSource, /--duration-fast:/);
  assert.match(stylesSource, /--bottom-nav-height:/);
  assert.match(stylesSource, /env\(safe-area-inset-bottom\)/);
  assert.match(stylesSource, /prefers-reduced-motion/);
  assert.match(indexHtml, /viewport-fit=cover/);
});

await test('AppShellは常時Headerを描画せずOutletとBottomNavigationを保持する', () => {
  assert.doesNotMatch(appLayoutSource, /AppHeader/);
  assert.match(appLayoutSource, /<Outlet \/>/);
  assert.match(appLayoutSource, /<BottomNavigation \/>/);
  assert.doesNotMatch(appLayoutSource, /旅ログ|端末内保存/);
  assert.match(stylesSource, /padding-bottom: calc\(var\(--bottom-nav-height\) \+ env\(safe-area-inset-bottom\)\)/);
});

await test('BottomNavigationは設定配列から生成しactive状態を持つ', () => {
  assert.match(bottomNavigationSource, /items = bottomNavigationItems/);
  assert.match(bottomNavigationSource, /aria-label=\{label\}/);
  assert.match(bottomNavigationSource, /aria-current=\{active \? 'page' : undefined\}/);
  assert.match(bottomNavigationSource, /isBottomNavigationItemActive/);
  assert.match(navigationItemsSource, /BottomNavigationItem/);
  assert.equal((navigationItemsSource.match(/to: '[^']+',\s*label:/g) ?? []).length, 5);
  assert.match(navigationItemsSource, /to: '\/more'/);
  assert.match(navigationItemsSource, /activePaths/);
});

await test('Button、Card、Badge、PageHeaderの共通UIが利用可能', () => {
  assert.match(buttonSource, /variant = 'secondary'/);
  assert.match(buttonSource, /variant === 'primary'/);
  assert.match(buttonSource, /variant === 'danger'/);
  assert.match(buttonSource, /variant === 'ghost'/);
  assert.match(buttonSource, /aria-busy=\{loading \|\| undefined\}/);
  assert.match(buttonSource, /aria-disabled=\{disabled \|\| loading \? true : undefined\}/);
  assert.match(cardSource, /title\?: string/);
  assert.match(cardSource, /actions\?: ReactNode/);
  assert.match(badgeSource, /BadgeVariant = 'neutral' \| 'primary' \| 'success' \| 'warning' \| 'danger' \| 'info'/);
  assert.match(pageHeaderSource, /backTo\?: string/);
  assert.match(pageHeaderSource, /actions\?: ReactNode/);
});

await test('Loading、Skeleton、EmptyState、InlineErrorがアクセシブルに整備されている', () => {
  assert.match(pageStateSource, /aria-live="polite"/);
  assert.match(pageStateSource, /aria-busy="true"/);
  assert.match(pageStateSource, /empty-state--rich/);
  assert.match(skeletonSource, /aria-hidden="true"/);
  assert.match(inlineErrorSource, /role="alert"/);
  assert.match(stylesSource, /skeleton-shimmer/);
});

await test('旅行一覧はPhase2共通UIの見本として導入されている', () => {
  assert.match(tripsPageSource, /<PageHeader/);
  assert.match(tripsPageSource, /<Button variant="primary" to="\/trips\/new">/);
  assert.match(tripsPageSource, /<Card as="article"/);
  assert.match(tripsPageSource, /<TripStatusBadge/);
  assert.match(tripsPageSource, /<EmptyState\s+title=/);
  assert.match(tripsPageSource, /<LoadingState variant="skeleton"/);
});

await test('UI Phase3のBottom Navigationは5タブで子ルートもactive対象にする', () => {
  for (const label of ['ホーム', '旅行', '地図', 'コレクション', 'その他']) {
    assert.match(navigationItemsSource, new RegExp(`label: '${label}'`));
  }
  assert.match(navigationItemsSource, /activePaths: \['\/trips'\]/);
  assert.match(navigationItemsSource, /activePaths: \['\/collections', '\/castles'\]/);
  assert.match(navigationItemsSource, /'\/time-machine', '\/travel-gacha', '\/rpg', '\/wishlist', '\/settings'/);
  assert.match(navigationItemsSource, /pathname\.startsWith\(`\$\{path\}\/`\)/);
  assert.match(bottomNavigationSource, /aria-current=\{active \? 'page' : undefined\}/);
  assert.match(stylesSource, /grid-template-columns: repeat\(5, minmax\(0, 1fr\)\)/);
});

await test('既存ルートを維持したままその他画面を追加する', () => {
  for (const route of ['trips', 'japan-map', 'castles', 'time-machine', 'travel-gacha', 'rpg', 'collections', 'wishlist', 'settings']) {
    assert.match(routerSource, new RegExp(route));
  }
  assert.match(routerSource, /path: 'more'/);
  assert.match(routerSource, /import\('\.\.\/pages\/MorePage'\)/);
});

await test('その他画面は機能を目的別にまとめて既存画面へ遷移できる', () => {
  for (const heading of ['旅を振り返る', '次の旅を探す', 'コレクション・達成', 'アプリ']) {
    assert.match(morePageSource, new RegExp(heading));
  }
  for (const to of ['/time-machine', '/travel-gacha', '/rpg', '/rpg/achievements', '/settings']) {
    assert.ok(morePageSource.includes(`to="${to}"`));
  }
  assert.match(morePageSource, /<NavigationListItem/);
  assert.match(navigationListItemSource, /aria-label=/);
});

await test('旅行一覧は日付から旅行中・予定・完了を分類して表示する', () => {
  assert.match(tripUiSource, /TripDisplayStatus = 'ongoing' \| 'upcoming' \| 'completed'/);
  assert.match(tripUiSource, /trip\.startDate > today/);
  assert.match(tripUiSource, /trip\.endDate < today/);
  assert.match(tripsPageSource, /groupTripsForDisplay/);
  assert.match(tripsPageSource, /<SegmentedControl/);
  assert.match(tripsPageSource, /to=\{`\/trips\/\$\{trip\.id\}`\}/);
  assert.match(tripsPageSource, /旅行を追加/);
  assert.match(tripsPageSource, /<LoadingState variant="skeleton"/);
  assert.match(tripsPageSource, /<ErrorState error=\{error\}/);
  assert.match(tripsPageSource, /旅行記録がまだありません/);
});

await test('旅行詳細はアルバム表示を優先し管理操作を下部に保持する', () => {
  assert.match(tripDetailPage, /<PageHeader/);
  assert.match(tripDetailPage, /backTo="\/trips"/);
  assert.match(tripDetailPage, /trip-journal-hero/);
  assert.match(tripDetailPage, /旅の概要/);
  assert.match(tripDetailPage, /旅の思い出/);
  assert.match(tripDetailPage, /旅のタイムライン/);
  assert.match(tripDetailPage, /この日の軌跡/);
  assert.match(tripDetailPage, /この旅で残したもの/);
  assert.match(tripDetailPage, /旅を編集する/);
  assert.match(tripDetailPage, /スクラップブックを開く/);
  assert.match(tripDetailPage, /旅行リザルト/);
  assert.match(tripDetailPage, /trip-detail__danger/);
  assert.match(tripDetailPage, /<LoadingState variant="skeleton"/);
  assert.match(tripDetailPage, /<InlineError message=\{actionError\}/);
  assert.match(tripDetailPage, /旅行が見つかりません/);
  assert.match(tripDetailPage, /<PlaceVisitForm/);
  assert.match(tripDetailPage, /<TransportLegForm/);
});

await test('旅行詳細の写真は既存スクラップブックServiceを再利用し保存処理へ直接触れない', () => {
  assert.match(tripJournalMediaHook, /getScrapbookByTripId/);
  assert.match(tripJournalMediaHook, /createMediaObjectUrl/);
  assert.match(tripJournalMediaHook, /URL\.revokeObjectURL/);
  assert.doesNotMatch(tripJournalMediaHook, /repositories\.|indexedDB|localStorage/);
});

await test('旅行詳細の写真なし表示は旅行内容から決定的なテーマを選ぶ', () => {
  assert.match(tripJournalVisual, /北海道\|雪\|冬/);
  assert.match(tripJournalVisual, /海\|島\|沖縄/);
  assert.match(tripJournalVisual, /京都\|奈良\|寺/);
  assert.match(tripJournalVisual, /for \(const character of/);
});

await test('旅行詳細タイムラインは訪問場所と移動区間を統合する', () => {
  assert.match(tripJournalTimeline, /places\.map/);
  assert.match(tripJournalTimeline, /transportLegs\.map/);
  assert.match(tripJournalTimeline, /localeCompare/);
});

await test('訪問場所の日時入力は到着のみ・出発のみ・日付またぎを検証する', () => {
  const baseInput = {
    name: '夜の展望台',
    address: '',
    visitedDate: '2026-08-08',
    arrivalTime: '',
    departureDate: '2026-08-08',
    departureTime: '',
    memo: '',
    castleId: '',
  };
  assert.deepEqual(validatePlaceVisitDateTimeInput({ ...baseInput, arrivalTime: '20:30' }), []);
  assert.deepEqual(validatePlaceVisitDateTimeInput({ ...baseInput, departureTime: '22:00' }), []);
  assert.deepEqual(validatePlaceVisitDateTimeInput({
    ...baseInput,
    arrivalTime: '23:30',
    departureDate: '2026-08-09',
    departureTime: '00:30',
  }), []);
  assert.match(
    validatePlaceVisitDateTimeInput({ ...baseInput, arrivalTime: '20:30', departureTime: '19:30' }).join(' '),
    /出発日時は到着日時以降/,
  );
  assert.match(
    validatePlaceVisitDateTimeInput({ ...baseInput, visitedDate: '', arrivalTime: '20:30' }).join(' '),
    /訪問日/,
  );
});

await test('訪問日時はローカル日付と時刻をISOへ変換して復元できる', () => {
  const value = dateTimeInputToIsoDateTime('2026-08-08', '09:05');
  assert.ok(value);
  assert.equal(isoDateTimeToDateInput(value), '2026-08-08');
  assert.equal(isoDateTimeToTimeInput(value), '09:05');
});

await test('訪問場所保存値は明示時刻だけを到着・出発へ保持する', () => {
  const dateOnly = buildPlaceVisitDateTimeFields({
    visitedDate: '2026-08-08', arrivalTime: '', departureDate: '2026-08-08', departureTime: '',
  });
  assert.ok(dateOnly.visitedAt);
  assert.equal(dateOnly.arrivalAt, undefined);
  assert.equal(dateOnly.departureAt, undefined);

  const stay = buildPlaceVisitDateTimeFields({
    visitedDate: '2026-08-08', arrivalTime: '23:30', departureDate: '2026-08-09', departureTime: '00:30',
  });
  assert.equal(isoDateTimeToTimeInput(stay.arrivalAt), '23:30');
  assert.equal(isoDateTimeToDateInput(stay.departureAt), '2026-08-09');
  assert.equal(stay.visitedAt, stay.arrivalAt);
});

await test('訪問場所の表示は時刻なし・到着のみ・日付またぎを区別する', () => {
  const arrivalAt = dateTimeInputToIsoDateTime('2026-08-08', '23:30');
  const departureAt = dateTimeInputToIsoDateTime('2026-08-09', '00:30');
  assert.equal(formatPlaceVisitTimeRange({ visitedAt: dateInputToIsoDateTime('2026-08-08') }), '時刻未設定');
  assert.equal(formatPlaceVisitTimeRange({ arrivalAt }), '23:30 到着');
  assert.equal(formatPlaceVisitTimeRange({ arrivalAt, departureAt }), '23:30–8/9 00:30');
  assert.equal(getPlaceVisitDate({ arrivalAt, departureAt }), '2026-08-08');
});

await test('訪問場所日時はBackup v12で維持し旧データも時刻なしで読める', () => {
  const arrivalAt = dateTimeInputToIsoDateTime('2026-08-08', '10:00');
  const departureAt = dateTimeInputToIsoDateTime('2026-08-08', '11:30');
  const normalized = normalizeBackupPayload({
    app: 'travel-log-pwa',
    schemaVersion: 12,
    data: {
      placeVisits: [
        { id: 'place-new', tripId: 'trip-1', visitedAt: arrivalAt, arrivalAt, departureAt },
        { id: 'place-old', tripId: 'trip-1', visitedAt: dateInputToIsoDateTime('2026-08-07') },
      ],
    },
  });
  assert.equal(normalized.data.placeVisits[0].arrivalAt, arrivalAt);
  assert.equal(normalized.data.placeVisits[0].departureAt, departureAt);
  assert.equal(formatPlaceVisitTimeRange(normalized.data.placeVisits[1]), '時刻未設定');
});

await test('訪問場所フォームはスマホ向け日時入力と現在時刻操作を提供する', () => {
  assert.match(placeVisitForm, /type="time"/);
  assert.match(placeVisitForm, /place-arrival-time/);
  assert.match(placeVisitForm, /place-departure-date/);
  assert.match(placeVisitForm, /place-departure-time/);
  assert.equal((placeVisitForm.match(/>\s*今\s*</g) ?? []).length, 2);
  assert.match(stylesSource, /\.visit-time-now[\s\S]*min-height: var\(--tap-target-min\)/);
});

await test('TimeMachineは訪問の到着・出発をrangeとして扱い旧訪問日はday精度を維持する', () => {
  assert.match(timeMachineService, /const startAt = place\.arrivalAt \?\? place\.departureAt/);
  assert.match(timeMachineService, /endAt,/);
  assert.match(timeMachineService, /timePrecision: startAt && endAt \? 'range'/);
  assert.match(timeMachineService, /dateSource = place\.arrivalAt \?\? place\.departureAt \?\? place\.visitedAt/);
});

await test('クイック訪問はT1と同じ現在日時入力を到着・出発へ利用する', () => {
  const now = new Date(2026, 5, 8, 9, 15);
  assert.deepEqual(createArrivalNowInput(now), {
    visitedDate: '2026-06-08',
    arrivalTime: '09:15',
    departureDate: '2026-06-08',
    departureTime: '',
  });
  assert.deepEqual(createDepartureNowInput(now), {
    departureDate: '2026-06-08',
    departureTime: '09:15',
  });
  assert.match(placeVisitForm, /createArrivalNowInput/);
  assert.match(placeVisitForm, /createDepartureNowInput/);
});

await test('到着だけの訪問を滞在中として判定し出発済みと区別する', () => {
  const active = { id: 'active', arrivalAt: '2026-06-08T00:15:00.000Z' };
  const finished = { id: 'finished', arrivalAt: active.arrivalAt, departureAt: '2026-06-08T01:00:00.000Z' };
  const legacy = { id: 'legacy' };
  assert.equal(isPlaceVisitInProgress(active), true);
  assert.equal(isPlaceVisitInProgress(finished), false);
  assert.equal(isPlaceVisitInProgress(legacy), false);
  assert.deepEqual(findInProgressPlaceVisits([finished, active, legacy]), [active]);
});

await test('クイック到着Serviceは最小入力で既存保存処理を使い同時滞在を防ぐ', () => {
  assert.match(tripService, /export async function createQuickPlaceVisit/);
  assert.match(tripService, /findInProgressPlaceVisits\(currentPlaces\)/);
  assert.match(tripService, /滞在中の場所を出発してから/);
  assert.match(tripService, /return await createPlaceVisit\(tripId/);
  assert.match(tripService, /\.\.\.createArrivalNowInput\(now\)/);
});

await test('クイック出発Serviceは二重実行を安全に扱い滞在終了Validationを通す', () => {
  assert.match(tripService, /export async function departPlaceVisitNow/);
  assert.match(tripService, /if \(current\.departureAt\) return current/);
  assert.match(tripService, /if \(!current\.arrivalAt\)/);
  assert.match(tripService, /buildStayEndRecord\(current, currentLegs, now\.toISOString\(\)\)/);
  assert.match(tripService, /return await repositories\.placeVisits\.save\(next\)/);
});

await test('クイック訪問UIは到着・滞在中・出発・詳細編集を段階表示する', () => {
  assert.match(quickPlaceVisit, /今ここに着いた/);
  assert.match(quickPlaceVisit, /<BottomSheet/);
  assert.match(quickPlaceVisit, /場所名/);
  assert.match(quickPlaceVisit, /滞在中/);
  assert.match(quickPlaceVisit, /滞在終了/);
  assert.match(quickPlaceVisit, /今出発/);
  assert.match(quickPlaceVisit, /詳細を編集/);
  assert.match(quickPlaceVisit, /loading=\{departingId === place\.id\}/);
});

await test('クイック訪問は保存後に旅行詳細を再読込し既存詳細フォームを維持する', () => {
  assert.match(tripDetailPage, /<CurrentTripActivity/);
  assert.match(tripDetailPage, /onChanged=\{\(\) => setReloadKey/);
  assert.match(tripDetailPage, /placeEditorRef/);
  assert.match(tripDetailPage, /<PlaceVisitForm/);
  assert.match(quickPlaceVisit, /setError\(caughtError instanceof Error/);
  assert.match(quickPlaceVisit, /dismissible=\{!saving\}/);
});

await test('クイック訪問UIはモバイル操作領域と固定要素に干渉しない流れを持つ', () => {
  assert.match(stylesSource, /\.quick-visit__actions \.button \{ min-height: var\(--tap-target-min\)/);
  assert.match(stylesSource, /@media \(max-width: 560px\)[\s\S]*\.quick-visit__heading/);
  assert.doesNotMatch(stylesSource.match(/\.quick-visit[\s\S]*?@media \(max-width: 560px\)/)?.[0] ?? '', /position:\s*fixed/);
});

await test('移動日時は現在時刻入力と日付またぎを安全に扱う', () => {
  const departure = new Date(2026, 5, 8, 23, 45);
  const arrival = new Date(2026, 5, 9, 0, 20);
  assert.deepEqual(createTransportDepartureNowInput(departure), {
    date: '2026-06-08', departureTime: '23:45', arrivalDate: '2026-06-08', arrivalTime: '',
  });
  assert.deepEqual(createTransportArrivalNowInput(arrival), {
    arrivalDate: '2026-06-09', arrivalTime: '00:20',
  });
  assert.deepEqual(validateTransportLegDateTimeInput({
    date: '2026-06-08', departureTime: '23:45', arrivalDate: '2026-06-09', arrivalTime: '00:20',
  }), []);
  assert.match(validateTransportLegDateTimeInput({
    date: '2026-06-08', departureTime: '23:45', arrivalDate: '2026-06-08', arrivalTime: '00:20',
  }).join(' '), /到着日時は出発日時以降/);
});

await test('移動日時保存値は旧時刻を維持しながら完全日時を保持する', () => {
  const fields = buildTransportLegDateTimeFields({
    date: '2026-06-08', departureTime: '23:45', arrivalDate: '2026-06-09', arrivalTime: '00:20',
  });
  assert.equal(fields.departureTime, '23:45');
  assert.equal(fields.arrivalTime, '00:20');
  assert.equal(getTransportLegDepartureDate(fields), '2026-06-08');
  assert.equal(getTransportLegArrivalDate(fields), '2026-06-09');
  assert.equal(formatTransportLegTimeRange(fields), '23:45–6/9 00:20');
});

await test('完全日時を持つ未到着区間だけを移動中として扱う', () => {
  const active = { id: 'active', departureAt: dateTimeInputToIsoDateTime('2026-06-08', '09:15') };
  const finished = { id: 'finished', departureAt: active.departureAt, arrivalAt: dateTimeInputToIsoDateTime('2026-06-08', '10:00') };
  const legacy = { id: 'legacy', departureTime: '09:00' };
  assert.equal(isTransportLegInProgress(active), true);
  assert.equal(isTransportLegInProgress(finished), false);
  assert.equal(isTransportLegInProgress(legacy), false);
  assert.deepEqual(findInProgressTransportLegs([finished, active, legacy]), [active]);
});

await test('移動表示は未到着・時刻なし・未確定目的地を自然に表す', () => {
  assert.equal(formatTransportLegTimeRange({ date: '2026-06-08' }), '時刻未設定');
  assert.equal(formatTransportLegTimeRange({ date: '2026-06-08', departureAt: dateTimeInputToIsoDateTime('2026-06-08', '09:15') }), '09:15 出発・移動中');
  assert.equal(formatTransportLegTitle({ fromName: '京都駅' }), '京都駅 → 目的地未定');
});

await test('クイック移動Serviceは二重開始を防ぎ到着を冪等に記録する', () => {
  assert.match(tripService, /export async function createQuickTripTransportLeg/);
  assert.match(tripService, /findInProgressTransportLegs\(currentLegs\)/);
  assert.match(tripService, /移動中の区間を到着済みにしてから/);
  assert.match(tripService, /departureAt: departure\.toISOString\(\)/);
  assert.match(tripService, /export async function arriveTripTransportLegNow/);
  assert.match(tripService, /if \(current\.arrivalAt\) return current/);
  assert.match(tripService, /arrivalAt: now\.toISOString\(\)/);
});

await test('クイック移動UIは開始・移動中・到着・詳細編集を段階表示する', () => {
  assert.match(quickTransportLeg, /移動を開始/);
  assert.match(quickTransportLeg, /移動中/);
  assert.match(quickTransportLeg, /今到着/);
  assert.match(quickTransportLeg, /詳細を編集/);
  assert.match(quickTransportLeg, /到着地（任意）/);
  assert.match(quickTransportLeg, /TRANSPORT_MODE_OPTIONS/);
  assert.match(quickTransportLeg, /disabled=\{activeLegs\.length > 0\}/);
  assert.match(quickTransportLeg, /loading=\{arrivingId === leg\.id\}/);
});

await test('訪問の出発からクイック移動へつながり既存詳細フォームも維持する', () => {
  assert.match(quickPlaceVisit, /移動を記録/);
  assert.match(quickPlaceVisit, /onStartTransport\(place\)/);
  assert.match(tripDetailPage, /<CurrentTripActivity/);
  assert.match(currentTripActivitySource, /startTransportFromPlace/);
  assert.match(tripDetailPage, /<TransportLegForm/);
  assert.match(transportLegForm, /到着日/);
  assert.match(transportLegForm, /getTransportLegArrivalDate/);
});

await test('移動の完全日時と未確定目的地はBackup v12で維持される', () => {
  const departureAt = dateTimeInputToIsoDateTime('2026-06-08', '09:15');
  const normalized = normalizeBackupPayload({
    app: 'travel-log-pwa',
    schemaVersion: 12,
    data: {
      tripTransportLegs: [{
        id: 'leg-quick', tripId: 'trip-1', date: '2026-06-08', fromName: '京都駅',
        transportMode: 'walk', departureTime: '09:15', departureAt, partyCount: 1,
        totalCost: 0, costSource: 'manual', estimatePrecision: 'exact', sortOrder: 1,
      }],
    },
  });
  assert.equal(normalized.data.tripTransportLegs[0].departureAt, departureAt);
  assert.equal(normalized.data.tripTransportLegs[0].toName, undefined);
});

await test('クイック移動UIはモバイル操作領域と固定要素に干渉しない', () => {
  assert.match(stylesSource, /\.quick-visit__form select \{ min-height: var\(--tap-target-min\)/);
  assert.match(stylesSource, /@media \(max-width: 560px\)[\s\S]*\.quick-visit__actions/);
  assert.doesNotMatch(quickTransportLeg, /position:\s*fixed/);
});

await test('移動到着はID一致を確定候補、単一の同名訪問を確認候補として扱う', () => {
  const place = { id: 'place-1', tripId: 'trip-1', name: '京都駅' };
  const arrivedAt = '2026-06-08T02:00:00.000Z';
  const linked = resolveTransportArrivalVisitCandidate({
    id: 'leg-1', tripId: 'trip-1', toName: '京都駅', toPlaceVisitId: 'place-1', departureAt: '2026-06-08T01:00:00.000Z',
  }, [place], arrivedAt);
  assert.equal(linked.kind, 'linked');
  assert.equal(linked.canRecordArrival, true);
  const suggested = resolveTransportArrivalVisitCandidate({
    id: 'leg-2', tripId: 'trip-1', toName: '京都駅', departureAt: '2026-06-08T01:00:00.000Z',
  }, [place], arrivedAt);
  assert.equal(suggested.kind, 'suggested');
  assert.equal(suggested.place.id, place.id);
  assert.deepEqual(resolveTransportArrivalVisitCandidate({
    id: 'leg-3', tripId: 'trip-1', toName: '京都駅', departureAt: '2026-06-08T01:00:00.000Z',
  }, [place, { ...place, id: 'place-2' }], arrivedAt), { kind: 'unregistered', suggestedName: '京都駅' });
});

await test('既存到着時刻は上書き候補にせず訪問の時刻矛盾も検出する', () => {
  const arrivedAt = '2026-06-08T03:00:00.000Z';
  const leg = { id: 'leg-1', tripId: 'trip-1', toPlaceVisitId: 'place-1', departureAt: '2026-06-08T01:00:00.000Z' };
  assert.equal(resolveTransportArrivalVisitCandidate(leg, [{ id: 'place-1', tripId: 'trip-1', arrivalAt: '2026-06-08T02:00:00.000Z' }], arrivedAt).canRecordArrival, false);
  assert.equal(resolveTransportArrivalVisitCandidate(leg, [{ id: 'place-1', tripId: 'trip-1', departureAt: '2026-06-08T02:30:00.000Z' }], arrivedAt).canRecordArrival, false);
});

await test('移動と既存訪問の到着へ同一timestampを設定する', () => {
  const arrivedAt = '2026-06-09T00:20:00.000Z';
  const result = buildLinkedArrivalRecords({
    id: 'leg-1', tripId: 'trip-1', toPlaceVisitId: 'place-1', departureAt: '2026-06-08T23:45:00.000Z',
  }, { id: 'place-1', tripId: 'trip-1' }, arrivedAt);
  assert.equal(result.leg.arrivalAt, arrivedAt);
  assert.equal(result.place.arrivalAt, arrivedAt);
  assert.equal(result.place.visitedAt, arrivedAt);
  assert.equal(result.leg.durationMinutes, 35);
});

await test('移動と訪問の同時到着は同一timestampで再実行しても冪等', () => {
  const arrivedAt = '2026-06-09T00:20:00.000Z';
  const first = buildLinkedArrivalRecords({
    id: 'leg-1', tripId: 'trip-1', toPlaceVisitId: 'place-1', departureAt: '2026-06-08T23:45:00.000Z',
  }, { id: 'place-1', tripId: 'trip-1' }, arrivedAt);
  const second = buildLinkedArrivalRecords(first.leg, first.place, arrivedAt);
  assert.deepEqual(second, first);
});

await test('訪問場所の新規追加は同一Tripに同名候補がない場合だけ許可する', () => {
  const leg = { id: 'leg-1', tripId: 'trip-1', toName: '京都駅' };
  assert.equal(isTransportDestinationUnregistered(leg, []), true);
  assert.equal(isTransportDestinationUnregistered(leg, [{ id: 'place-1', tripId: 'trip-1', name: ' 京都駅 ' }]), false);
  assert.equal(isTransportDestinationUnregistered({ ...leg, toPlaceVisitId: 'place-1' }, []), false);
  assert.equal(isTransportDestinationUnregistered(leg, [{ id: 'place-2', tripId: 'trip-2', name: '京都駅' }]), true);
});

await test('連携到着は移動出発前と訪問出発後を拒否する', () => {
  assert.throws(() => buildLinkedArrivalRecords({
    id: 'leg-1', tripId: 'trip-1', toPlaceVisitId: 'place-1', departureAt: '2026-06-08T10:00:00.000Z',
  }, { id: 'place-1', tripId: 'trip-1' }, '2026-06-08T09:00:00.000Z'), /到着日時は出発日時以降/);
  assert.throws(() => buildLinkedArrivalRecords({
    id: 'leg-1', tripId: 'trip-1', toPlaceVisitId: 'place-1', departureAt: '2026-06-08T08:00:00.000Z',
  }, { id: 'place-1', tripId: 'trip-1', departureAt: '2026-06-08T08:30:00.000Z' }, '2026-06-08T09:00:00.000Z'), /訪問の出発日時より後/);
});

await test('逆方向連携は未完了かつ未紐付けの正規化済み同名だけを候補にする', () => {
  const leg = { departureAt: '2026-06-08T08:00:00.000Z', toName: ' 京都駅 ' };
  assert.equal(isReverseTransportArrivalCandidate(leg, '京都駅'), true);
  assert.equal(isReverseTransportArrivalCandidate({ ...leg, toPlaceVisitId: 'place-1' }, '京都駅'), false);
  assert.equal(isReverseTransportArrivalCandidate({ ...leg, arrivalAt: '2026-06-08T09:00:00.000Z' }, '京都駅'), false);
  assert.equal(isReverseTransportArrivalCandidate(leg, '京都'), false);
});

await test('逆方向確認後は新規訪問IDを移動区間へ保存する', () => {
  const arrivedAt = '2026-06-08T09:00:00.000Z';
  const place = { id: 'place-new', tripId: 'trip-1', name: '京都駅', arrivalAt: arrivedAt };
  const result = buildNewPlaceArrivalRecords({
    id: 'leg-1', tripId: 'trip-1', toName: '京都駅', departureAt: '2026-06-08T08:00:00.000Z',
  }, place, arrivedAt);
  assert.equal(result.leg.toPlaceVisitId, place.id);
  assert.equal(result.leg.arrivalAt, arrivedAt);
});

await test('移動だけ到着後は明示操作で同時刻の訪問場所へ紐付ける', () => {
  const arrivedAt = '2026-06-08T09:00:00.000Z';
  const place = { id: 'place-new', tripId: 'trip-1', name: '京都駅', arrivalAt: arrivedAt };
  const result = buildPlaceFromCompletedTransportRecords({
    id: 'leg-1', tripId: 'trip-1', toName: '京都駅', arrivalAt: arrivedAt,
  }, place);
  assert.equal(result.leg.toPlaceVisitId, place.id);
  assert.equal(result.place.arrivalAt, arrivedAt);
});

await test('到着連携Serviceは2 Storeを同一Transactionで更新しUIは明示確認を行う', () => {
  assert.match(tripArrivalLinkDataSource, /transaction\(\['tripTransportLegs', 'placeVisits'\], 'readwrite'\)/);
  assert.match(tripArrivalLinkService, /arriveTransportAndPlaceNow/);
  assert.match(tripArrivalLinkService, /createQuickPlaceVisitAndArriveTransport/);
  assert.match(quickTransportLeg, /移動と訪問の両方に記録/);
  assert.match(quickTransportLeg, /移動だけ記録/);
  assert.match(quickTransportLeg, /訪問場所として追加/);
  assert.match(quickPlaceVisit, /直前の移動も同じ時刻で到着にしますか/);
  assert.match(quickPlaceVisit, /訪問だけ記録/);
});

await test('到着先IDはBackup v12で維持され既存データは未設定のまま読める', () => {
  const baseLeg = {
    id: 'leg-link', tripId: 'trip-1', date: '2026-06-08', fromName: '京都駅', toName: '清水寺',
    transportMode: 'bus', partyCount: 1, totalCost: 0, costSource: 'manual', estimatePrecision: 'exact', sortOrder: 1,
  };
  const linked = normalizeBackupPayload({ app: 'travel-log-pwa', schemaVersion: 12, data: { tripTransportLegs: [{ ...baseLeg, toPlaceVisitId: 'place-1' }] } });
  assert.equal(linked.data.tripTransportLegs[0].toPlaceVisitId, 'place-1');
  const legacy = normalizeBackupPayload({ app: 'travel-log-pwa', schemaVersion: 12, data: { tripTransportLegs: [baseLeg] } });
  assert.equal(legacy.data.tripTransportLegs[0].toPlaceVisitId, undefined);
});

await test('旅先クイック記録は現在日時と滞在中の場所を初期値にする', () => {
  const input = createQuickTravelRecordInput('meal', new Date(2026, 7, 9, 12, 34), { id: 'place-1' });
  assert.equal(input.date, '2026-08-09');
  assert.equal(input.time, '12:34');
  assert.equal(input.placeVisitId, 'place-1');
  assert.equal(input.recordType, 'meal');
});

await test('旅先クイック記録は種別ごとの最小入力を検証する', () => {
  const meal = createQuickTravelRecordInput('meal', new Date(2026, 7, 9, 12, 34));
  assert.match(validateQuickTravelRecordInput(meal).join(' '), /店名または食事タイトル/);
  assert.deepEqual(validateQuickTravelRecordInput({ ...meal, title: '昼ごはん' }), []);
  const memo = createQuickTravelRecordInput('memo', new Date(2026, 7, 9, 12, 34));
  assert.match(validateQuickTravelRecordInput(memo).join(' '), /出来事やメモ/);
  const expense = createQuickTravelRecordInput('expense', new Date(2026, 7, 9, 12, 34));
  assert.match(validateQuickTravelRecordInput(expense).join(' '), /出費の金額/);
  assert.deepEqual(validateQuickTravelRecordInput({ ...expense, amount: '1200' }), []);
});

await test('旅先クイック記録は任意項目を省略し既存訪問へ安全に関連付ける', () => {
  const input = { ...createQuickTravelRecordInput('purchase', new Date(2026, 7, 9, 13, 0)), title: 'おみやげ', amount: '' };
  const fields = buildQuickTravelRecordFields(input, { id: 'place-1', name: '京都駅' });
  assert.equal(fields.title, 'おみやげ');
  assert.equal(fields.amount, undefined);
  assert.equal(fields.placeVisitId, 'place-1');
  assert.equal(fields.locationName, '京都駅');
});

await test('旅先クイック記録は種別、金額、場所をBackup v12で維持する', () => {
  const normalized = normalizeBackupPayload({
    app: 'travel-log-pwa', schemaVersion: 12, data: { manualTimelineEntries: [{
      id: 'record-1', tripId: 'trip-1', date: '2026-08-09', startAt: '2026-08-09T03:00:00.000Z',
      timePrecision: 'minute', sourceType: 'manual', confidence: 'exact', recordType: 'purchase',
      title: 'おみやげ', amount: 850, shopName: '駅売店', placeVisitId: 'place-1',
    }] },
  });
  const record = normalized.data.manualTimelineEntries[0];
  assert.equal(record.recordType, 'purchase');
  assert.equal(record.amount, 850);
  assert.equal(record.shopName, '駅売店');
  assert.equal(record.placeVisitId, 'place-1');
});

await test('旅先クイック記録はTimelineへ日時順で混ざる', () => {
  const record = {
    id: 'record-1', date: '2026-08-09', startAt: dateTimeInputToIsoDateTime('2026-08-09', '12:00'),
    timePrecision: 'minute', sourceType: 'manual', confidence: 'exact', recordType: 'meal', title: '昼ごはん', amount: 1200,
  };
  assert.equal(formatQuickTravelRecordTitle(record), '昼ごはん');
  assert.match(formatQuickTravelRecordDetail(record), /1,200円/);
  assert.match(tripJournalTimeline, /quickRecords\.map/);
  assert.match(tripJournalTimeline, /kind: 'record'/);
  assert.match(tripJournalTimeline, /\.\.\.recordEntries/);
});

await test('旅先クイック記録UIは4種の入口、後編集、保存失敗保持を備える', () => {
  assert.match(quickTravelRecordSource, /記録を追加/);
  assert.match(quickTravelRecordSource, /QUICK_TRAVEL_RECORD_TYPES/);
  assert.match(quickTravelRecordSource, /詳細を編集/);
  assert.match(quickTravelRecordSource, /createEditorSaveErrorMessage\('旅先の記録'\)/);
  assert.match(quickTravelRecordSource, /if \(!editor \|\| editor\.mode === 'choose' \|\| saving\) return/);
  assert.match(quickTravelRecordServiceSource, /repositories\.manualTimelineEntries\.save/);
  assert.match(quickTravelRecordServiceSource, /resolvePlace/);
  assert.match(tripDetailPage, /<QuickTravelRecord/);
  assert.match(tripDetailPage, /quickRecords=\{quickRecords\}/);
});

await test('詳細Editorの保存失敗文は内部例外を露出せず入力保持と再試行を伝える', () => {
  assert.equal(
    createEditorSaveErrorMessage('訪問場所'),
    '訪問場所を保存できませんでした。入力内容は残っています。もう一度お試しください。',
  );
  assert.doesNotMatch(createEditorSaveErrorMessage('移動区間'), /IndexedDB|Repository|stack/i);
});

await test('訪問と移動の詳細Editorは保存失敗をフォーム内に表示して再試行できる', () => {
  for (const source of [placeVisitForm, transportLegForm]) {
    assert.match(source, /<InlineError title="保存できませんでした" message=\{saveError\}/);
    assert.match(source, /saveError \? 'もう一度保存' : submitLabel/);
    assert.match(source, /aria-busy=\{submitting \|\| undefined\}/);
    assert.match(source, /catch \{/);
  }
});

await test('詳細Editor保存の失敗は親で握りつぶさず成功時だけURLを閉じる', () => {
  assert.match(tripDetailPage, /if \(editingPlace\) await updatePlaceVisit[\s\S]*onEditorSaved\(\)/);
  assert.match(tripDetailPage, /if \(editingTransportLeg\) await updateTripTransportLeg[\s\S]*onEditorSaved\(\)/);
  assert.doesNotMatch(tripDetailPage, /runAction\(async \(\) => \{[\s\S]{0,240}updatePlaceVisit/);
  assert.match(tripDetailPage, /setReloadKey[\s\S]*closeEditor\(\)/);
});

await test('旅先記録Editorも失敗時は入力を保持して同じ操作から再試行できる', () => {
  assert.match(quickTravelRecordSource, /setError\(createEditorSaveErrorMessage\('旅先の記録'\)\)/);
  assert.match(quickTravelRecordSource, /setSaveFailed\(true\)/);
  assert.match(quickTravelRecordSource, /saveFailed \? 'もう一度保存'/);
  assert.match(quickTravelRecordSource, /if \(!editor \|\| editor\.mode === 'choose' \|\| saving\) return/);
});

await test('旅先クイック記録は既存T1からT4と詳細フォームを維持する', () => {
  assert.match(tripDetailPage, /<CurrentTripActivity/);
  assert.match(tripDetailPage, /<PlaceVisitForm/);
  assert.match(tripDetailPage, /<TransportLegForm/);
  assert.match(stylesSource, /\.quick-record__types button \{[\s\S]*min-height: 88px/);
  assert.doesNotMatch(quickTravelRecordSource, /position:\s*fixed/);
});

await test('旅行日程内だけライブ記録を許可する', () => {
  const trip = { startDate: '2026-08-10', endDate: '2026-08-12' };
  assert.deepEqual(resolveTripLiveRecordingAvailability(trip, new Date(2026, 7, 10, 0, 0)), { allowed: true, state: 'ongoing' });
  assert.deepEqual(resolveTripLiveRecordingAvailability(trip, new Date(2026, 7, 12, 23, 59)), { allowed: true, state: 'ongoing' });
  assert.deepEqual(resolveTripLiveRecordingAvailability(trip, new Date(2026, 7, 13, 0, 0)), { allowed: false, state: 'completed' });
  assert.deepEqual(resolveTripLiveRecordingAvailability(trip, new Date(2026, 7, 9, 23, 59)), { allowed: false, state: 'upcoming' });
});

await test('不正または曖昧な旧日程はデータを変えずライブ記録を止める', () => {
  assert.deepEqual(resolveTripLiveRecordingAvailability({ startDate: '', endDate: '' }), { allowed: false, state: 'unknown' });
  assert.deepEqual(resolveTripLiveRecordingAvailability({ startDate: '2026-08-12', endDate: '2026-08-10' }), { allowed: false, state: 'unknown' });
});

await test('完了旅行のクイック追記は旅行最終日を明示して日程外を拒否する', () => {
  const trip = { startDate: '2026-08-10', endDate: '2026-08-12' };
  const input = createHistoricalQuickTravelRecordInput('memo', trip, new Date(2026, 7, 20, 9, 30));
  assert.equal(input.date, '2026-08-12');
  assert.equal(input.time, '09:30');
  assert.deepEqual(validateQuickTravelRecordTripDate(input, trip), []);
  assert.match(validateQuickTravelRecordTripDate({ date: '2026-08-13' }, trip).join(' '), /旅行日程内/);
});

await test('ライブ不可旅行は現在CTAを隠し、詳細編集とTimelineを維持する', () => {
  assert.match(currentTripActivitySource, /if \(!liveRecordingAvailability\.allowed\)/);
  assert.match(currentTripActivitySource, /この旅行の日程は終了しています/);
  assert.match(quickTravelRecordSource, /過去の記録を追加/);
  assert.match(quickTravelRecordSource, /canCreate &&/);
  assert.match(tripDetailPage, /liveRecordingAvailability=\{liveRecordingAvailability\}/);
  assert.match(tripDetailPage, /<TripJournalTimeline/);
  assert.match(tripDetailPage, /<PlaceVisitForm/);
  assert.match(tripDetailPage, /<TransportLegForm/);
});

await test('旅行詳細の編集対象はEntity ID付きqueryで往復し他queryを維持する', () => {
  const initial = new URLSearchParams('view=timeline');
  const targeted = setTripDetailEditorTarget(initial, { kind: 'place', entityId: 'place-1' });
  assert.deepEqual(parseTripDetailEditorTarget(targeted), { kind: 'place', entityId: 'place-1' });
  assert.equal(targeted.get('view'), 'timeline');
  assert.equal(parseTripDetailEditorTarget(new URLSearchParams('edit=place')), undefined);
  const cleared = setTripDetailEditorTarget(targeted);
  assert.equal(cleared.get('edit'), null);
  assert.equal(cleared.get('entityId'), null);
  assert.equal(cleared.get('view'), 'timeline');
});

await test('訪問と移動の詳細編集は描画後に移動・Focus・一時強調する', () => {
  assert.match(tripDetailPage, /useSearchParams/);
  assert.match(tripDetailPage, /window\.requestAnimationFrame/);
  assert.match(tripDetailPage, /prefers-reduced-motion: reduce/);
  assert.match(tripDetailPage, /scrollIntoView\(\{ behavior: reduceMotion \? 'auto' : 'smooth'/);
  assert.match(tripDetailPage, /focus\(\{ preventScroll: true \}\)/);
  assert.match(tripDetailPage, /tabIndex=\{-1\}/);
  assert.match(stylesSource, /trip-journal-editor__panel--targeted/);
  assert.match(stylesSource, /scroll-margin-top: calc\(env\(safe-area-inset-top\) \+ 16px\)/);
});

await test('Timelineは訪問・移動・旅先記録をEntity IDで編集へ渡す', () => {
  assert.match(tripJournalTimeline, /onEditPlace\?: \(placeId: string\)/);
  assert.match(tripJournalTimeline, /onEditTransport\?: \(legId: string\)/);
  assert.match(tripJournalTimeline, /onEditRecord\?: \(recordId: string\)/);
  assert.match(tripJournalTimeline, /onEdit\(entry\.id\)/);
  assert.match(tripDetailPage, /onEditRecord=\{\(recordId\) => openEditor\('record', recordId\)\}/);
});

await test('T5記録はURL指定から既存Sheetを開き保存・キャンセルで対象を閉じる', () => {
  assert.match(quickTravelRecordSource, /records\.find\(\(entry\) => entry\.id === editRecordId/);
  assert.match(quickTravelRecordSource, /initialFocusRef=\{editor\?\.mode === 'edit' \? editorFormRef/);
  assert.match(quickTravelRecordSource, /onRequestEdit\(record\.id\)/);
  assert.match(quickTravelRecordSource, /if \(wasTargetedEdit\) onEditorClose\(\)/);
  assert.match(quickTravelRecordSource, /editor\.mode === 'edit' && editRecordId\) onEditorClose\(\)/);
  assert.match(tripDetailPage, /編集する記録が見つかりません/);
});

await test('現在行動はidle・staying・movingを排他的に判定する', () => {
  const place = { id: 'place-1', arrivalAt: '2026-08-10T01:00:00.000Z' };
  const leg = { id: 'leg-1', departureAt: '2026-08-10T02:00:00.000Z' };
  assert.deepEqual(resolveCurrentTripActivity([], []), { kind: 'idle' });
  assert.deepEqual(resolveCurrentTripActivity([place], []), { kind: 'staying', place });
  assert.deepEqual(resolveCurrentTripActivity([], [leg]), { kind: 'moving', leg });
});

await test('完了済みと論理削除済みの記録は現在行動に含めない', () => {
  const finishedPlace = { id: 'place-finished', arrivalAt: '2026-08-10T01:00:00.000Z', departureAt: '2026-08-10T02:00:00.000Z' };
  const deletedLeg = { id: 'leg-deleted', departureAt: '2026-08-10T02:00:00.000Z', deletedAt: '2026-08-10T03:00:00.000Z' };
  assert.deepEqual(resolveCurrentTripActivity([finishedPlace], [deletedLeg]), { kind: 'idle' });
});

await test('滞在と移動の同時進行や複数進行はconflictとして更新を止める', () => {
  const places = [{ id: 'place-1', arrivalAt: '2026-08-10T01:00:00.000Z' }];
  const legs = [{ id: 'leg-1', departureAt: '2026-08-10T02:00:00.000Z' }];
  assert.equal(resolveCurrentTripActivity(places, legs).kind, 'conflict');
  assert.equal(resolveCurrentTripActivity([...places, { ...places[0], id: 'place-2' }], []).kind, 'conflict');
});

await test('滞在終了と移動開始は同一timestampを共有する', () => {
  const timestamp = '2026-08-10T03:00:00.000Z';
  const place = { id: 'place-1', tripId: 'trip-1', name: '京都駅', arrivalAt: '2026-08-10T01:00:00.000Z' };
  const leg = { id: 'leg-1', tripId: 'trip-1', fromName: '京都駅', departureAt: timestamp };
  const result = buildDepartureAndTransportRecords(place, [], leg);
  assert.equal(result.place.departureAt, timestamp);
  assert.equal(result.leg.departureAt, timestamp);
});

await test('滞在だけ終了はdepartureAtだけを設定し現在行動をidleへ戻す', () => {
  const timestamp = '2026-08-10T03:00:00.000Z';
  const place = { id: 'place-1', tripId: 'trip-1', name: '京都駅', arrivalAt: '2026-08-10T01:00:00.000Z' };
  const ended = buildStayEndRecord(place, [], timestamp);
  assert.equal(ended.departureAt, timestamp);
  assert.equal(ended.updatedAt, timestamp);
  assert.equal(resolveCurrentTripActivity([ended], []).kind, 'idle');
  assert.equal(place.departureAt, undefined);
});

await test('滞在だけ終了は不正時刻・終了済み・移動中の状態を変更しない', () => {
  const place = { id: 'place-1', tripId: 'trip-1', name: '京都駅', arrivalAt: '2026-08-10T04:00:00.000Z' };
  assert.throws(() => buildStayEndRecord(place, [], '2026-08-10T03:00:00.000Z'), /到着日時以降/);
  assert.throws(() => buildStayEndRecord({ ...place, departureAt: '2026-08-10T05:00:00.000Z' }, [], '2026-08-10T06:00:00.000Z'), /すでに記録/);
  assert.throws(() => buildStayEndRecord(place, [{ id: 'leg-active', departureAt: '2026-08-10T02:00:00.000Z' }], '2026-08-10T05:00:00.000Z'), /移動中/);
  assert.equal(place.departureAt, undefined);
});

await test('滞在だけ終了Serviceは移動を作らず保存直前に状態を検証する', () => {
  assert.match(tripService, /export async function departPlaceVisitNow/);
  assert.match(tripService, /repositories\.tripTransportLegs\.listByTripId\(current\.tripId\)/);
  assert.match(tripService, /buildStayEndRecord\(current, currentLegs, now\.toISOString\(\)\)/);
  assert.match(tripService, /repositories\.placeVisits\.save\(next\)/);
  assert.doesNotMatch(tripService.match(/export async function departPlaceVisitNow[\s\S]*?export async function deletePlaceVisit/)?.[0] ?? '', /tripTransportLegs\.save|createQuickTripTransportLeg/);
});

await test('出発Sheetは移動開始と滞在だけ終了を分けCancelと二重実行防止を備える', () => {
  assert.match(currentTripActivitySource, /departureStep === 'choose'/);
  assert.match(currentTripActivitySource, /<strong>移動を開始<\/strong><small>次の場所への移動を記録します<\/small>/);
  assert.match(currentTripActivitySource, /<strong>滞在だけ終了<\/strong><small>この場所を出た時刻だけ記録します<\/small>/);
  assert.match(currentTripActivitySource, /departPlaceVisitNow\(activity\.place\.id, moment\)/);
  assert.match(currentTripActivitySource, /stayEndInFlightRef\.current/);
  assert.match(currentTripActivitySource, /<Button onClick=\{closeEditor\} disabled=\{saving\}>キャンセル<\/Button>/);
  assert.match(currentTripActivitySource, /startTransportFromPlace/);
});

await test('滞在終了と移動開始は移動中区間がある場合に拒否する', () => {
  const place = { id: 'place-1', tripId: 'trip-1', name: '京都駅', arrivalAt: '2026-08-10T01:00:00.000Z' };
  const leg = { id: 'leg-new', tripId: 'trip-1', fromName: '京都駅', departureAt: '2026-08-10T03:00:00.000Z' };
  assert.throws(() => buildDepartureAndTransportRecords(place, [{ id: 'leg-active', departureAt: '2026-08-10T02:00:00.000Z' }], leg), /移動中/);
});

await test('滞在終了と移動開始は到着より前の出発を拒否する', () => {
  const place = { id: 'place-1', tripId: 'trip-1', name: '京都駅', arrivalAt: '2026-08-10T04:00:00.000Z' };
  const leg = { id: 'leg-new', tripId: 'trip-1', fromName: '京都駅', departureAt: '2026-08-10T03:00:00.000Z' };
  assert.throws(() => buildDepartureAndTransportRecords(place, [], leg), /出発日時は到着日時以降/);
});

await test('明示した新規到着先は移動と同一timestampで作成できる', () => {
  const arrivedAt = '2026-08-10T04:00:00.000Z';
  const result = buildExplicitNewPlaceArrivalRecords(
    { id: 'leg-1', tripId: 'trip-1', fromName: '京都駅', departureAt: '2026-08-10T03:00:00.000Z' },
    { id: 'place-2', tripId: 'trip-1', name: '清水寺', arrivalAt: arrivedAt },
    arrivedAt,
  );
  assert.equal(result.leg.arrivalAt, arrivedAt);
  assert.equal(result.leg.toPlaceVisitId, 'place-2');
  assert.equal(result.place.arrivalAt, arrivedAt);
});

await test('明示選択した既存訪問場所は名前推測なしで安全に連携する', () => {
  const arrivedAt = '2026-08-10T04:00:00.000Z';
  const result = buildExplicitLinkedArrivalRecords(
    { id: 'leg-1', tripId: 'trip-1', fromName: '京都駅', toName: '目的地未定', departureAt: '2026-08-10T03:00:00.000Z' },
    { id: 'place-2', tripId: 'trip-1', name: '清水寺' },
    arrivedAt,
  );
  assert.equal(result.leg.toPlaceVisitId, 'place-2');
  assert.equal(result.leg.toName, '清水寺');
  assert.equal(result.place.arrivalAt, arrivedAt);
});

await test('現在行動UIは状態ごとに主操作を一つだけ提示する', () => {
  assert.match(currentTripActivitySource, /activity\.kind === 'idle'.*ここに到着/s);
  assert.match(currentTripActivitySource, /activity\.kind === 'staying'.*ここを出発/s);
  assert.match(currentTripActivitySource, /activity\.kind === 'moving'.*>到着</s);
  assert.doesNotMatch(tripDetailPage, /<QuickPlaceVisit|<QuickTransportLeg/);
});

await test('現在行動UIは完了済み履歴を再表示せず詳細編集を維持する', () => {
  assert.doesNotMatch(currentTripActivitySource, /recentTimedPlace|recentLeg|滞在終了|移動終了/);
  assert.match(currentTripActivitySource, /onEditPlace/);
  assert.match(currentTripActivitySource, /onEditTransport/);
  assert.match(tripDetailPage, /<PlaceVisitForm/);
  assert.match(tripDetailPage, /<TransportLegForm/);
});

await test('滞在終了と移動開始は2 Storeの同一Transactionで保存する', () => {
  assert.match(tripArrivalLinkDataSource, /departPlaceAndCreateTransportAtomically/);
  assert.match(tripArrivalLinkDataSource, /transaction\(\['placeVisits', 'tripTransportLegs'\], 'readwrite'\)/);
  assert.match(currentTripActivityServiceSource, /departPlaceAndCreateTransportAtomically/);
});

await test('現在行動UIは既存場所・新規場所・移動のみの到着を明示選択する', () => {
  assert.match(currentTripActivitySource, /移動だけ終了/);
  assert.match(currentTripActivitySource, /登録済みの場所へ到着/);
  assert.match(currentTripActivitySource, /新しい訪問場所を追加/);
  assert.match(currentTripActivitySource, /arriveTransportAndExistingPlaceNow/);
  assert.match(currentTripActivitySource, /createExplicitPlaceVisitAndArriveTransport/);
  assert.match(currentTripActivitySource, /arriveTripTransportLegNow/);
});

await test('現在行動の矛盾状態は警告と詳細編集だけを表示する', () => {
  assert.match(currentTripActivitySource, /activity\.kind === 'conflict'/);
  assert.match(currentTripActivitySource, /自動更新せず/);
  assert.match(currentTripActivitySource, /role="alert"/);
});

await test('現在行動UIはモバイル操作領域と既存Bottom Sheetを利用する', () => {
  assert.match(currentTripActivitySource, /<BottomSheet/);
  assert.match(stylesSource, /\.current-activity__choices label \{[\s\S]*min-height: var\(--tap-target-min\)/);
  assert.doesNotMatch(currentTripActivitySource, /position:\s*fixed/);
});

await test('スクラップブックは閲覧と編集を分け、写真と空状態を安全に表示する', () => {
  assert.match(scrapbookPage, /<PageHeader/);
  assert.match(scrapbookPage, /旅行詳細へ/);
  assert.match(scrapbookPage, /mode === 'view'/);
  assert.match(scrapbookPage, /<ScrapbookViewer/);
  assert.match(scrapbookPage, /<ScrapbookEditor/);
  assert.match(scrapbookPage, /<ScrapbookLoadingState/);
  assert.match(scrapbookEditorSource, /編集中/);
  assert.match(scrapbookEditorSource, /完成イメージ/);
  assert.match(scrapbookMediaImageSource, /scrapbook-media-placeholder--error/);
  assert.match(scrapbookMediaImageSource, /loading = 'lazy'/);
  assert.match(scrapbookMediaImageSource, /decoding="async"/);
  assert.match(scrapbookViewerSource, /<TripJournalVisual/);
  assert.match(scrapbookPageNavigatorSource, /scrapbook-page-navigator__item/);
  assert.doesNotMatch(scrapbookPageNavigatorSource, /<button[\s\S]*<button/);
});

await test('UI Phase4の共通フォームはラベル、必須、補足、項目エラーを関連付ける', () => {
  assert.match(formUiSource, /export function Field/);
  assert.match(formUiSource, /export function TextInput/);
  assert.match(formUiSource, /export function TextareaField/);
  assert.match(formUiSource, /export function SelectField/);
  assert.match(formUiSource, /export function CheckboxField/);
  assert.match(formUiSource, /export function FormSection/);
  assert.match(formUiSource, /export function FormActions/);
  assert.match(formUiSource, /htmlFor=\{htmlFor\}/);
  assert.match(formUiSource, /aria-required=\{required \|\| undefined\}/);
  assert.match(formUiSource, /aria-invalid=\{error \? true : undefined\}/);
  assert.match(formUiSource, /aria-describedby=\{describedBy/);
  assert.match(formUiSource, /role="alert"/);
  assert.match(formUiSource, /<label className="checkbox-field" htmlFor=\{inputId\}>/);
});

await test('旅行作成・編集は共通フォームと項目別エラー、保存中状態を使う', () => {
  for (const component of ['TextInput', 'TextareaField', 'SelectField', 'FormSection', 'FormActions', 'InlineError']) {
    assert.match(tripFormSource, new RegExp(`<${component}`));
  }
  assert.match(tripFormSource, /required/);
  assert.match(tripFormSource, /error=\{fieldErrors\.title\}/);
  assert.match(tripFormSource, /error=\{fieldErrors\.startDate\}/);
  assert.match(tripFormSource, /error=\{fieldErrors\.endDate\}/);
  assert.match(tripFormSource, /if \(submitting\) return/);
  assert.match(tripFormSource, /loading=\{submitting\}/);
  assert.match(tripFormSource, /cancelTo/);
  assert.match(tripEditPageSource, /<PageHeader/);
  assert.match(tripEditPageSource, /trip-edit-danger/);
  assert.match(tripEditPageSource, /<ConfirmDialog/);
  assert.doesNotMatch(tripEditPageSource, /window\.confirm/);
  assert.match(tripEditPageSource, /旅行が見つかりません/);
});

await test('ホームは旅行中、次の旅行、最近の旅行の順で優先表示する', () => {
  assert.match(homeLogicSource, /status === 'ongoing'/);
  assert.match(homeLogicSource, /status === 'upcoming'/);
  assert.match(homeLogicSource, /status === 'completed'/);
  assert.match(homeLogicSource, /a\.trip\.startDate\.localeCompare\(b\.trip\.startDate\)/);
  assert.match(homeServiceSource, /featuredTrip: selectFeaturedTrip\(trips\)/);
  assert.match(homePageSource, /<TripHero/);
  assert.match(homePageSource, /次の旅が、/);
  assert.match(homePageSource, /to="\/trips\/new"/);
  assert.match(homePageSource, /to="\/travel-gacha"/);
  assert.match(japanMapPreviewSource, /to="\/japan-map"/);
  assert.match(homePageSource, /to="\/time-machine"/);
  assert.match(homePageSource, /<HomeLoadingState/);
  assert.match(homePageSource, /<ErrorState error=\{home\.error\}/);
});

await test('ホームの写真は既存スクラップブックService経由で読み込む', () => {
  assert.match(tripMediaHookSource, /getScrapbookByTripId/);
  assert.match(tripMediaHookSource, /createMediaObjectUrl\(asset, 'thumbnail'\)/);
  assert.match(tripMediaHookSource, /resolveScrapbookCoverPhotoId/);
  assert.match(scrapbookCoverLogicSource, /coverAssetId/);
  assert.match(tripMediaHookSource, /URL\.revokeObjectURL/);
  assert.doesNotMatch(homePageSource, /repositories\.|localStorage|indexedDB/);
});

await test('旅行写真は遅延読込、失敗、未登録の各状態を持つ', () => {
  assert.match(tripMediaSource, /loading=\{eager \? 'eager' : 'lazy'\}/);
  assert.match(tripMediaSource, /decoding="async"/);
  assert.match(tripMediaSource, /onError=\{\(\) => setFailed\(true\)\}/);
  assert.match(tripMediaSource, /trip-media__fallback/);
  assert.match(tripMediaSource, /<Skeleton variant="block"/);
});

await test('ホームは写真、最近の旅行、地図、機能、統計の順に構成する', () => {
  assert.match(homePageSource, /<TripPreviewCard/);
  assert.match(homePageSource, /<JapanMapPreview/);
  assert.match(homePageSource, /<FeatureShortcut/);
  assert.match(homePageSource, /タイムマシン/);
  assert.match(homePageSource, /旅ガチ/);
  assert.match(homePageSource, /城コレクション/);
  assert.match(homePageSource, /スクラップブック/);
  assert.match(homePageSource, /data\.tripCount/);
  assert.match(homePageSource, /data\.placeVisitCount/);
  assert.match(homePageSource, /data\.collectionAchievementRate/);
  assert.match(tripHeroSource, /aria-labelledby="home-hero-title"/);
  assert.match(tripPreviewCardSource, /aria-label=/);
  assert.match(featureShortcutSource, /aria-label=/);
});

await test('ホームの地図プレビューは表示専用で、既存の地図読込を再利用する', () => {
  assert.match(japanMapPreviewSource, /interactive=\{false\}/);
  assert.match(japanMapPreviewSource, /summary\.visitRate\.toFixed\(1\)/);
  assert.match(japanMapPreviewSource, /地図を開く/);
  assert.match(mapComponent, /interactive = true/);
  assert.match(mapComponent, /import\.meta\.env\.BASE_URL\}maps\/japan-prefectures\.geojson/);
  assert.match(mapComponent, /tabIndex=\{interactive \? 0 : undefined\}/);
});

await test('地図画面は進捗、テキスト凡例、選択情報を共通UIで表示する', () => {
  assert.match(japanConquestPageSource, /<PageHeader/);
  assert.match(japanConquestPageSource, /<ProgressBar/);
  assert.match(japanConquestPageSource, /max=\{47\}/);
  assert.match(japanConquestPageSource, /function MapLegend/);
  assert.match(japanConquestPageSource, /選択中/);
  assert.match(japanConquestPageSource, /aria-pressed=\{selectedCode === view\.master\.code\}/);
  assert.match(japanConquestPageSource, /<PrefectureDetailPanel/);
  assert.match(prefectureDetailPanelSource, /地図または一覧から都道府県を選択してください/);
  assert.match(prefectureDetailPanelSource, /<Button variant="primary" type="submit" loading=\{submitting\}>/);
  assert.match(mapComponent, /aria-pressed=\{interactive \? selectedCode === code : undefined\}/);
  assert.match(mapComponent, /<InlineError title="地図を表示できません"/);
  assert.match(mapComponent, /<Skeleton variant="block"/);
});

await test('共通ProgressBarは数値とアクセシビリティ属性を持つ', () => {
  assert.match(progressBarSource, /role="progressbar"/);
  assert.match(progressBarSource, /aria-valuemin=\{0\}/);
  assert.match(progressBarSource, /aria-valuemax=\{safeMax\}/);
  assert.match(progressBarSource, /aria-valuenow=\{safeValue\}/);
  assert.match(progressBarSource, /aria-valuetext=\{displayValue\}/);
});

await test('コレクション入口は全体と個別の進捗、城導線、空状態を表示する', () => {
  assert.match(collectionPage, /<PageHeader/);
  assert.match(collectionPage, /全体の達成率/);
  assert.match(collectionPage, /<ProgressBar/);
  assert.match(collectionPage, /to="\/castles"/);
  assert.match(collectionPage, /訪問済み/);
  assert.match(collectionPage, /未訪問/);
  assert.match(collectionPage, /自分のコレクションはまだありません/);
  assert.match(collectionPage, /<LoadingState variant="skeleton"/);
  assert.match(collectionPage, /<ErrorState error=\{error\}/);
});

await test('UI Phase5のBottom Sheetは操作とアクセシビリティを共通化する', () => {
  assert.match(bottomSheetSource, /role="dialog"/);
  assert.match(bottomSheetSource, /aria-modal="true"/);
  assert.match(bottomSheetSource, /event\.target === event\.currentTarget/);
  assert.match(bottomSheetSource, /dismissible/);
  assert.match(overlaySource, /event\.key === 'Escape'/);
  assert.match(overlaySource, /document\.body\.style\.overflow = 'hidden'/);
  assert.match(overlaySource, /previousFocus[\s\S]*focus\(\)/);
});

await test('UI Phase5のToastは複数通知、自動消去、重複防止に対応する', () => {
  assert.match(toastSource, /export function ToastProvider/);
  assert.match(toastContextSource, /export function useToast/);
  assert.match(toastSource, /window\.setTimeout/);
  assert.match(toastSource, /activeKeys\.current\.has/);
  assert.match(toastSource, /aria-live="polite"/);
  assert.match(toastSource, /toast--\$\{toast\.variant\}/);
});

await test('UI Phase5のConfirm Dialogは安全な初期フォーカスと処理中状態を持つ', () => {
  assert.match(confirmDialogSource, /role="alertdialog"/);
  assert.match(confirmDialogSource, /aria-modal="true"/);
  assert.match(confirmDialogSource, /initialFocusRef: cancelRef/);
  assert.match(confirmDialogSource, /processing/);
  assert.match(confirmDialogSource, /confirmLabel/);
});

await test('タイムマシンは検索条件とイベント詳細をBottom Sheetで整理する', () => {
  assert.match(timeMachinePage, /title="検索条件"/);
  assert.match(timeMachinePage, /title="思い出の詳細"/);
  assert.match(timeMachinePage, /検索条件を適用しました/);
  assert.match(timeMachinePage, /補完記録を保存しました/);
  assert.match(timeMachinePage, /CONFIDENCE_LABELS/);
});

await test('旅ガチャは条件、抽選、結果を段階表示しToastで通知する', () => {
  assert.match(travelGachaPage, /現在の条件/);
  assert.match(travelGachaPage, /title="旅ガチャの条件"/);
  assert.match(travelGachaPage, /loading=\{busy\}/);
  assert.match(travelGachaPage, /旅先を抽選しました/);
  assert.match(travelGachaPage, /この旅を採用しました/);
  assert.match(travelGachaPage, /tripDurationInput/);
  assert.match(travelGachaPage, /if \(value !== ''\)/);
  assert.match(travelGachaPage, /tripDurationDays: 1/);
});

await test('Bottom Sheet内の入力で初期フォーカスを繰り返さない', () => {
  assert.match(overlaySource, /onCloseRef\.current = onClose/);
  assert.match(overlaySource, /dismissibleRef\.current = dismissible/);
  assert.match(overlaySource, /\}, \[open\]\);/);
});

await test('日本地図は鹿児島南方の離島を本土投影範囲から除外する', () => {
  assert.match(mapComponent, /MAINLAND_MIN_LAT = 30\.85/);
  assert.match(mapComponent, /lat >= MAINLAND_MIN_LAT/);
});

await test('城コレクションは進捗、検索、フィルター、詳細を共通UIで表示する', () => {
  assert.match(castlePage, /<ProgressBar/);
  assert.match(castlePage, /<SegmentedControl/);
  assert.match(castlePage, /title="城を絞り込む"/);
  assert.match(castlePage, /城名・所在地を検索/);
  assert.match(castlePage, /の記録を保存しました/);
});

await test('旅行の主要削除操作は共通Confirm Dialogを使用する', () => {
  assert.match(tripDetailPage, /<ConfirmDialog/);
  assert.doesNotMatch(tripDetailPage, /window\.confirm/);
  assert.match(tripDetailPage, /processing=\{deleting\}/);
});

await test('RPGマスターに実績、称号、クエストが存在する', () => {
  assert.ok(achievementMaster.length >= 15);
  assert.ok(titleMaster.length >= 10);
  assert.ok(questMaster.length >= 10);
});

await test('コレクション内訳を表示するServiceとUIがある', () => {
  assert.match(collectionService, /listCollectionDetails/);
  assert.match(collectionPage, /collection-detail-list/);
});

await test('コレクションと項目を追加、編集、削除できるServiceとUIがある', () => {
  assert.match(collectionService, /createCollection/);
  assert.match(collectionService, /updateCollection/);
  assert.match(collectionService, /deleteCollection/);
  assert.match(collectionService, /createCollectionItem/);
  assert.match(collectionService, /updateCollectionItem/);
  assert.match(collectionService, /deleteCollectionItem/);
  assert.match(collectionPage, /項目を追加/);
  assert.match(collectionPage, /訪問済みにする/);
});

await test('欲しいものメモを追加、編集、削除できるServiceとUIがある', () => {
  assert.match(wishlistService, /createWishlistItem/);
  assert.match(wishlistService, /updateWishlistItem/);
  assert.match(wishlistService, /deleteWishlistItem/);
  assert.match(wishlistService, /validateWishlistItemInput/);
  assert.match(wishlistService, /repositories\.wishlist\.save/);
  assert.match(wishlistService, /repositories\.wishlist\.softDelete/);
  assert.match(wishlistPage, /WishlistItemForm/);
  assert.match(wishlistPage, /編集/);
  assert.match(wishlistPage, /削除/);
});

await test('欲しいもの画面はRepositoryや端末保存を直接操作しない', () => {
  assert.doesNotMatch(wishlistPage, /repositories\.|localStorage|indexedDB/);
});

await test('サンプル旅行データはRPG経験値の初回集計から除外される', () => {
  assert.match(rpgProgressService, /SAMPLE_TRIP_IDS/);
  assert.match(rpgProgressService, /filter\(\(trip\) => !SAMPLE_TRIP_IDS\.includes\(trip\.id\)\)/);
});

await test('サンプル由来だけのRPGデータはクリーンアップされる', () => {
  assert.match(rpgProgressService, /cleanupSampleOnlyRpgProgress/);
  assert.match(rpgProgressService, /clearStore\('rpgExperienceEntries'\)/);
});
