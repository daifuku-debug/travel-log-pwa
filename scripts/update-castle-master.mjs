import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const SOURCES = [
  {
    series: 'japanese_100_castles',
    prefix: 'j100',
    url: 'https://jokaku.jp/business/great-castles/',
    numberOffset: 0,
  },
  {
    series: 'continued_japanese_100_castles',
    prefix: 'zoku',
    url: 'https://jokaku.jp/business/great-castles-sequel/',
    numberOffset: 100,
  },
];

const CASTLE_MASTER_PATH = resolve('src/domain/castles/castleMaster.json');
const PREFECTURE_MASTER_PATH = resolve('src/domain/prefectures/prefectureMaster.json');

const sourceCheckedAt = new Date().toISOString().slice(0, 10);
const prefectures = JSON.parse(await readFile(PREFECTURE_MASTER_PATH, 'utf8'));
const prefectureByName = new Map(prefectures.map((prefecture) => [prefecture.nameJa, prefecture]));
const prefectureNames = Array.from(prefectureByName.keys()).sort((a, b) => b.length - a.length);
const currentMaster = JSON.parse(await readFile(CASTLE_MASTER_PATH, 'utf8'));
const currentById = new Map(currentMaster.castles.map((castle) => [castle.id, castle]));

const castles = [];
for (const source of SOURCES) {
  const html = await fetchText(source.url);
  for (const row of parseRows(html)) {
    const sourceNumber = Number(row[0]?.text);
    if (!Number.isInteger(sourceNumber)) continue;
    const officialNumber = sourceNumber - source.numberOffset;
    const nameJa = row[1]?.text ?? '';
    const location = row[2]?.text ?? '';
    const referenceUrl = row[1]?.href ?? '';
    const prefectureName = findPrefectureName(location);
    const prefecture = prefectureByName.get(prefectureName);
    if (!prefecture) throw new Error(`都道府県が見つかりません: ${location}`);
    const id = `castle-${source.prefix}-${String(officialNumber).padStart(3, '0')}`;
    const current = currentById.get(id);
    castles.push({
      id,
      officialNumber,
      sourceNumber,
      nameJa,
      nameKana: current?.nameKana ?? '',
      nameEn: current?.nameEn ?? '',
      series: source.series,
      prefectureCode: prefecture.code,
      prefectureName,
      municipality: location.slice(prefectureName.length),
      region: prefecture.region,
      latitude: current?.latitude ?? null,
      longitude: current?.longitude ?? null,
      locationNote: location,
      officialReferenceUrl: referenceUrl,
      managingOrganizationUrl: referenceUrl,
      verificationStatus: current?.verificationStatus ?? 'official_list_verified_coordinates_unverified',
      dataSource: '公益財団法人日本城郭協会 日本100名城・続日本100名城一覧',
      sourceCheckedAt,
      sortOrder: sourceNumber,
      createdAt: current?.createdAt ?? `${sourceCheckedAt}T00:00:00.000Z`,
      updatedAt: `${sourceCheckedAt}T00:00:00.000Z`,
    });
  }
}

if (castles.length !== 200) throw new Error(`城マスターは200件である必要があります: ${castles.length}`);

await writeFile(
  CASTLE_MASTER_PATH,
  `${JSON.stringify({
    masterDataVersion: `${sourceCheckedAt}.jokaku-basic-v1`,
    sourceCheckedAt,
    castles,
  }, null, 2)}\n`,
);

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} の取得に失敗しました: ${response.status}`);
  return response.text();
}

function findPrefectureName(location) {
  const name = prefectureNames.find((prefectureName) => location.startsWith(prefectureName));
  if (!name) throw new Error(`都道府県を判定できません: ${location}`);
  return name;
}

function parseRows(html) {
  const tableMatch = html.match(/<table[\s\S]*?<\/table>/i);
  if (!tableMatch) return [];
  return Array.from(tableMatch[0].matchAll(/<tr[\s\S]*?<\/tr>/gi))
    .map((match) => Array.from(match[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)).map((cellMatch) => {
      const raw = cellMatch[1];
      const href = raw.match(/<a[^>]+href=["']([^"']+)["']/i)?.[1];
      return {
        text: raw.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim(),
        href,
      };
    }))
    .filter((row) => Number.isInteger(Number(row[0]?.text)));
}
