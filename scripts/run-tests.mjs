import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

import {
  calculateJapanConquestSummary,
  filterPrefectureViews,
  mergePrefectureViews,
  resolveStatus,
} from '../src/features/japanConquest/japanConquestLogic.ts';
import { normalizeBackupPayload } from '../src/features/backup/backupSchema.ts';
import {
  collectScrapbookMediaAssetIds,
  mergeGeneratedScrapbookFields,
} from '../src/features/scrapbooks/scrapbookRevision.ts';
import { calculateLevelProgress, expRequiredForNextLevel } from '../src/features/rpg/rpgLevel.ts';
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
const updateCastleMasterScript = await readFile(new URL('../scripts/update-castle-master.mjs', import.meta.url), 'utf8');
const scrapbookModel = await readFile(new URL('../src/domain/models/scrapbook.ts', import.meta.url), 'utf8');
const scrapbookService = await readFile(new URL('../src/features/scrapbooks/scrapbookService.ts', import.meta.url), 'utf8');
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

await test('v8スクラップブックを既存情報を保ったままv9へ移行する', () => {
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

  assert.equal(normalized.schemaVersion, 9);
  assert.equal(normalized.data.scrapbooks[0].title, '既存の旅');
  assert.equal(normalized.data.scrapbooks[0].subtitle, '残したい説明');
  assert.equal(normalized.data.scrapbooks[0].origin, 'generated');
  assert.equal(normalized.data.scrapbooks[0].sourceRevision, 1);
  assert.deepEqual(normalized.data.scrapbooks[0].userEditedFields, []);
  assert.equal(normalized.data.scrapbookPages[0].origin, 'generated');
  assert.deepEqual(normalized.data.scrapbookPages[0].userEditedFields, []);
  assert.equal(normalized.data.scrapbookBlocks[0].text, '消してはいけない本文');
  assert.equal(normalized.data.scrapbookBlocks[0].origin, 'generated');
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
        coverSettings: { photoId: 'asset-cover', titlePosition: 'bottom', layout: 'magazine' },
        highlightPhotoIds: ['asset-highlight-1', 'asset-highlight-2'],
      }],
    },
  });
  const scrapbook = normalized.data.scrapbooks[0];
  assert.equal(scrapbook.coverSettings?.photoId, 'asset-cover');
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
  assert.equal(normalized.schemaVersion, 9);
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
  assert.equal(normalized.schemaVersion, 9);
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
  assert.equal(normalized.schemaVersion, 9);
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
  assert.match(scrapbookService, /const sourceKey = `day:\$\{trip\.id\}:\$\{date\}`/);
  assert.match(scrapbookService, /sourceKey: `place:\$\{place\.id\}`/);
});

await test('スクラップブック画面は閲覧モードと編集モードを分ける', () => {
  assert.match(scrapbookPage, /mode, setMode/);
  assert.match(scrapbookPage, /mode === 'edit'/);
  assert.match(scrapbookPage, /mode === 'view'/);
});

await test('スクラップブックは上下ボタンでページとブロックを並び替えできる', () => {
  assert.match(scrapbookService, /moveScrapbookPage/);
  assert.match(scrapbookService, /moveScrapbookBlock/);
  assert.match(scrapbookPage, />上<\/button>/);
  assert.match(scrapbookPage, />下<\/button>/);
});

await test('スクラップブックの画像本体はJSONバックアップに含めない設計', () => {
  assert.match(scrapbookPage, /JSONバックアップには画像本体を含めず/);
  assert.match(localDbSource, /mediaAssetBlobs/);
  assert.match(localScrapbookRepository, /LocalMediaAssetBlobRepository/);
  assert.doesNotMatch(scrapbookModel, /base64/i);
});

await test('スクラップブックは写真と写真グリッドを端末内Blobから表示できる', () => {
  assert.match(scrapbookService, /addPhotoBlockFromFile/);
  assert.match(scrapbookService, /addPhotoGridBlockFromFiles/);
  assert.match(scrapbookService, /createThumbnailBlob/);
  assert.match(scrapbookService, /createMediaObjectUrl/);
  assert.match(scrapbookPage, /<option value="photo">写真<\/option>/);
  assert.match(scrapbookPage, /<option value="photo_grid">写真グリッド<\/option>/);
  assert.match(scrapbookPage, /<MediaImage/);
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
  assert.match(scrapbookPage, /addPhotoBlockFromFile\(page\.id, tripId, files\[0\], input\.note, input\.text, input\.title\)/);
  assert.match(scrapbookPage, /block\.body && <p>\{block\.body\}<\/p>/);
  assert.match(scrapbookPage, /BlockTextContent/);
  assert.match(scrapbookPage, /text: block\.body \?\? ''/);
});

await test('スクラップブックの新規ブロック追加は種類選択なしで文章と写真を登録できる', () => {
  assert.match(scrapbookPage, /files\.length === 1/);
  assert.match(scrapbookPage, /files\.length > 1/);
  assert.match(scrapbookPage, /addScrapbookBlock\(page\.id, \{ \.\.\.input, type: 'text' \}\)/);
  assert.match(scrapbookPage, /<span>写真<\/span>/);
  assert.doesNotMatch(scrapbookPage, /<h3>ブロック追加<\/h3>[\s\S]*<span>種類<\/span>[\s\S]*ブロック追加/);
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

await test('スクラップブックは閲覧と編集を分け、写真と空状態を安全に表示する', () => {
  assert.match(scrapbookPage, /<PageHeader/);
  assert.match(scrapbookPage, /旅行詳細へ/);
  assert.match(scrapbookPage, /編集中/);
  assert.match(scrapbookPage, /閲覧中/);
  assert.match(scrapbookPage, /<ScrapbookLoadingState/);
  assert.match(scrapbookPage, /このページはまだ空です/);
  assert.match(scrapbookPage, /scrapbook-media-placeholder--error/);
  assert.match(scrapbookPage, /loading="lazy"/);
  assert.match(scrapbookPage, /decoding="async"/);
  assert.match(scrapbookCoverSource, /<Card className="scrapbook-cover"/);
  assert.match(scrapbookPageNavigationSource, /scrapbook-page-row__select/);
  assert.doesNotMatch(scrapbookPageNavigationSource, /<button[\s\S]*<button/);
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
  assert.match(tripMediaHookSource, /coverAssetId/);
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
  assert.match(overlaySource, /previousFocus\?\.focus\(\)/);
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
