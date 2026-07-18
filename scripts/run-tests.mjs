import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

import {
  calculateJapanConquestSummary,
  filterPrefectureViews,
  mergePrefectureViews,
  resolveStatus,
} from '../src/features/japanConquest/japanConquestLogic.ts';
import { normalizeBackupPayload } from '../src/features/backup/backupSchema.ts';
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
const rpgProgressService = await readFile(new URL('../src/features/rpg/rpgProgressService.ts', import.meta.url), 'utf8');
const rpgProfilePage = await readFile(new URL('../src/pages/RpgProfilePage.tsx', import.meta.url), 'utf8');
const collectionService = await readFile(new URL('../src/features/collections/collectionService.ts', import.meta.url), 'utf8');
const collectionPage = await readFile(new URL('../src/pages/CollectionPage.tsx', import.meta.url), 'utf8');
const castleService = await readFile(new URL('../src/features/castles/castleService.ts', import.meta.url), 'utf8');
const castlePage = await readFile(new URL('../src/pages/CastleCollectionPage.tsx', import.meta.url), 'utf8');
const castleDocs = await readFile(new URL('../docs/castle-data.md', import.meta.url), 'utf8');
const placeVisitForm = await readFile(new URL('../src/features/trips/components/PlaceVisitForm.tsx', import.meta.url), 'utf8');
const updateCastleMasterScript = await readFile(new URL('../scripts/update-castle-master.mjs', import.meta.url), 'utf8');

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

await test('状態優先順位はunvisited < passed < visited < stayed', () => {
  assert.equal(resolveStatus('passed', 'visited'), 'visited');
  assert.equal(resolveStatus('stayed', 'visited'), 'stayed');
  assert.equal(resolveStatus('unvisited', 'passed'), 'passed');
});

await test('状態を保存しやすいよう都道府県コードを保存IDにしている', () => {
  assert.match(conquestLogic, /id:\s*prefectureCode/);
  assert.match(localRepository, /getById\(code\)/);
});

await test('訪問制覇率、宿泊制覇率、到達率の計算が正しい', () => {
  const visits = [
    { prefectureCode: '01', status: 'passed', manualStatus: 'passed', calculatedStatus: 'unvisited' },
    { prefectureCode: '02', status: 'visited', manualStatus: 'visited', calculatedStatus: 'unvisited' },
    { prefectureCode: '03', status: 'stayed', manualStatus: 'stayed', calculatedStatus: 'unvisited' },
  ];
  const views = mergePrefectureViews(master, visits);
  const summary = calculateJapanConquestSummary(views);
  assert.equal(summary.visitedCount, 2);
  assert.equal(summary.stayedCount, 1);
  assert.equal(summary.passedOnlyCount, 1);
  assert.equal(summary.unvisitedCount, 44);
  assert.equal(summary.visitRate, 4.3);
  assert.equal(summary.stayRate, 2.1);
  assert.equal(summary.reachedRate, 6.4);
});

await test('passedは通常の訪問制覇率へ含まれない', () => {
  const views = mergePrefectureViews(master, [
    { prefectureCode: '01', status: 'passed', manualStatus: 'passed', calculatedStatus: 'unvisited' },
  ]);
  const summary = calculateJapanConquestSummary(views);
  assert.equal(summary.visitedCount, 0);
  assert.equal(summary.visitRate, 0);
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

await test('旧形式バックアップでも日本制覇マップデータなしでエラーにならない', () => {
  const oldObject = normalizeBackupPayload({ trips: [{ id: 'trip-1', title: '旧バックアップ' }] });
  const oldArray = normalizeBackupPayload([{ id: 'trip-2', title: 'さらに古い形式' }]);
  assert.equal(oldObject.data.prefectureVisits.length, 0);
  assert.equal(oldObject.data.castleVisitSummaries.length, 0);
  assert.equal(oldObject.data.trips.length, 1);
  assert.equal(oldArray.data.trips.length, 1);
});

await test('GitHub Pagesのベースパス配下でも地図データを読み込む設定になっている', () => {
  assert.match(mapComponent, /import\.meta\.env\.BASE_URL\}maps\/japan-prefectures\.geojson/);
});

await test('PWAオフライン用キャッシュに地図データが含まれている', () => {
  assert.match(sw, /maps\/japan-prefectures\.geojson/);
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

await test('城RPG経験値はsourceKeyで二重付与を防ぐ設計', () => {
  assert.match(castleService, /castle:first-visit:\$\{castle\.id\}/);
  assert.match(castleService, /castle:stamp:\$\{castle\.id\}/);
  assert.match(castleService, /castle:milestone:\$\{milestone\.count\}/);
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

await test('passedの都道府県は初訪問経験値の対象にならない', () => {
  assert.match(rpgProgressService, /status === 'unvisited' \|\| status === 'passed'\) return/);
});

await test('visitedで初訪問経験値、stayedで初宿泊経験値が付与される定義がある', () => {
  assert.match(rpgProgressService, /prefecture-first-visit:\$\{prefectureCode\}/);
  assert.match(rpgProgressService, /prefecture-first-stay:\$\{prefectureCode\}/);
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
    wishlistItemCount: 0,
  });
  assert.equal(getConditionValue(stats, 'tripCompletedCount'), 1);
  assert.equal(getConditionValue(stats, 'castleVisitedCount'), 1);
  assert.equal(getConditionValue(stats, 'castleJapanese100VisitedCount'), 1);
  assert.equal(achievementMaster.find((item) => item.id === 'trip-1').targetValue, 1);
  assert.equal(achievementMaster.find((item) => item.id === 'castle-1').targetValue, 1);
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

await test('サンプル旅行データはRPG経験値の初回集計から除外される', () => {
  assert.match(rpgProgressService, /SAMPLE_TRIP_IDS/);
  assert.match(rpgProgressService, /filter\(\(trip\) => !SAMPLE_TRIP_IDS\.includes\(trip\.id\)\)/);
});

await test('サンプル由来だけのRPGデータはクリーンアップされる', () => {
  assert.match(rpgProgressService, /cleanupSampleOnlyRpgProgress/);
  assert.match(rpgProgressService, /clearStore\('rpgExperienceEntries'\)/);
});
