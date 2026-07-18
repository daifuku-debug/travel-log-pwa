# 日本制覇マップの地図データ

このアプリでは、日本制覇マップの都道府県境界データとして以下の静的GeoJSONを同梱しています。

- ファイル: `public/maps/japan-prefectures.geojson`
- データ: geoBoundaries Japan ADM1 simplified GeoJSON
- boundaryID: `JPN-ADM1-47310658`
- boundaryYearRepresented: `2017`
- admUnitCount: `47`
- 取得元API: `https://www.geoboundaries.org/api/current/gbOpen/JPN/ADM1/`
- GeoJSON取得URL: `https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/JPN/ADM1/geoBoundaries-JPN-ADM1_simplified.geojson`
- boundarySource: `OpenStreetMap, Wambacher`
- boundaryLicense: `Open Data Commons Open Database License 1.0`
- licenseSource: `www.openstreetmap.org/copyright`

アプリ内の都道府県マスターはJIS X 0401の01〜47コードを使用し、GeoJSON側の `shapeISO` (`JP-01`〜`JP-47`) から都道府県コードへ紐付けています。

地図データとユーザーの訪問情報は分離して管理します。地図データおよび都道府県マスターには訪問状態を書き込まず、訪問状態はIndexedDBの `prefectureVisits` storeに保存します。
