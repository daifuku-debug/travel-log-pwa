# T1-T5.5 Through UX Audit

2026-08-11時点のGitHub Pages版を使い、旅行1日の到着、滞在、出発、移動、次の到着、旅先クイック記録、詳細編集、日付またぎ、再読み込みを連続操作した結果です。実装判断では[Product Rules](PRODUCT_RULES.md)と[Current Status](CURRENT_STATUS.md)を参照してください。

## Scope

- 対象: 旅行記録MVP T1-T5.5
- 表示幅: 393px、430px、768px、1024px
- 状態: `idle`、`staying`、`moving`
- 確認環境: Codex内蔵ブラウザ、GitHub Pages版
- 未確認: 実機のノッチ、ホームインジケータ、通信・IndexedDB書き込みを実際に失敗させた復旧操作

## Scenario Result

- `idle`から「ここに到着」で訪問を開始し、食事とメモを現在時刻で追加できた。
- 「ここを出発」で同じ時刻の出発と移動開始を記録し、移動中に買い物と出費を追加できた。
- 移動到着時は入力済みの到着地名が新しい訪問場所名へ引き継がれ、同じ内容の再入力は不要だった。
- 日付をまたぐ訪問と移動はTimelineで日付が分かれて表示され、`00:00`の不自然な補完はなかった。
- キャンセル後は現在状態とDraftが意図せず更新されなかった。
- 完了済みの訪問・移動は「いま」から外れ、履歴はTimelineへ残った。
- 4幅で横overflowはなく、主要CTAは44px、Bottom Navigationとの重なりとブラウザconsole errorは確認されなかった。

## P0

### P0-1 Nested route reload returns GitHub Pages 404 - Resolved 2026-08-12

- 発生箇所: GitHub Pages上の旅行詳細など、ルート以外のURL。
- 再現手順: 旅行詳細`/travel-log-pwa/trips/<tripId>`を開き、ブラウザを再読み込みする。
- なぜ問題か: GitHub Pagesがアプリの`index.html`を返さず404になるため、旅行中の再読み込みや復帰で操作不能になる。保存済みデータは残るが、ユーザーはルートへ戻って旅行を開き直す必要がある。
- 推奨修正: `createBrowserRouter`と`basename`を維持するなら、GitHub Pages用のSPA fallbackを配信工程へ追加し、直リンクと再読み込みを自動テストする。PWAのscopeと`/travel-log-pwa/`のbaseを同時に確認する。
- 既存仕様を壊す可能性: 中。Router、GitHub Pages配信、Service Workerの組み合わせを確認する必要がある。
- 解決内容: GitHub Pagesの`404.html`から既知Routeだけをbaseへ転送し、React起動前に元のpathname、query、hashを`replaceState`で復元する。Route判定はService Workerと共有し、asset、`api`、`cdn-cgi`はSPA fallback対象外とした。
- 解決確認: 本番相当の静的配信でroot、旅行一覧、旅行詳細、タイムマシンの直接アクセスと再読み込み、query/hash、Back/Forwardを確認した。Service Worker実行は内蔵ブラウザの制約により構成・Build成果物までの確認。

## P1

### P1-1 Completed or past trips still expose live "Now" recording

- 発生箇所: 旅行詳細の「いま」。
- 再現手順: 完了済みかつ旅行日が過去の旅行を開き、「ここに到着」から現在時刻の訪問・移動を記録する。
- なぜ問題か: 旅行期間外の現在時刻が過去旅行へ入り、Timelineと旅の状態が実態と食い違う。見出しの「いま」も誤解を招く。
- 推奨修正: 進行中と判断できる旅行だけライブ操作を有効にし、過去・完了済み旅行では履歴編集を主にする。例外的に再開する場合は明示確認を挟む。
- 既存仕様を壊す可能性: 中。旅行の進行中判定とタイムゾーンの既存仕様を先に確定する必要がある。

### P1-2 "Edit details" opens an editor outside the visible area

- 発生箇所: 「いま」の滞在中・移動中カードにある「詳細を編集」。
- 再現手順: 旅行詳細の上部で「詳細を編集」を押す。編集フォームはページ下部で開くが、表示位置が移動しない場合がある。
- なぜ問題か: 押しても何も起きなかったように見え、時刻修正や詳細編集へ到達しにくい。実装ではstate更新直後の単一`requestAnimationFrame`で`scrollIntoView`しており、Editorの描画確定前に実行され得る。
- 推奨修正: Editorの描画完了を依存にしたEffectでスクロールと見出しFocusを行い、`prefers-reduced-motion`を尊重する。訪問・移動の両Editorを同じ方式にする。
- 既存仕様を壊す可能性: 低。UI操作だけの変更で対応可能。

### P1-3 A stay cannot end without starting a transport leg

- 発生箇所: 滞在中の「ここを出発」Sheet。
- 再現手順: 旅の最終地点で「ここを出発」を押す。
- なぜ問題か: 現在の操作は必ず`startTransportFromPlace`を呼び、滞在終了と移動開始を一体で保存する。宿泊先到着後や旅の終了時にも不要な移動区間を作るか、滞在中のまま残すことになる。
- 推奨修正: 「滞在だけ終了」と「次の移動を開始」を明示的に分ける。既存の訪問出発処理を再利用し、自動で移動を作らない。
- 既存仕様を壊す可能性: 中。現在状態の遷移とCTA優先度を再確認する必要がある。

## P2

### P2-1 Detailed form save errors are separated from the form

- 発生箇所: 旅行詳細下部の訪問・移動詳細Editor。
- 再現手順: 詳細Editorの保存処理が失敗した状態を想定する。
- なぜ問題か: `runAction`がErrorを捕捉し、ページ上部の`actionError`へ表示するため、長いページ下部にいるユーザーから見えない。フォーム側へ失敗が返らず、復帰方法が分かりにくい。
- 推奨修正: Editor内でErrorを表示できる結果または再throw方針へ統一し、入力を維持したまま再試行できるようにする。
- 既存仕様を壊す可能性: 中。既存削除など`runAction`利用箇所を分離して扱う必要がある。

### P2-2 Moving-state primary CTA does not state that it records the current time

- 発生箇所: 「いま」の移動中カード。
- 再現手順: 移動中状態を見る。
- なぜ問題か: CTAが「到着」だけで、押すと現在時刻を候補にすることが伝わりにくい。別の詳細移動UIには「今到着」があり、文言が一致していない。
- 推奨修正: 「今到着」に統一し、確認Sheetで時刻と連携先を最終確認する現在の流れを維持する。
- 既存仕様を壊す可能性: 低。文言変更のみ。

### P2-3 Purchase and general expense can describe the same payment twice

- 発生箇所: 旅先クイック記録の「買い物」と「出費」。
- 再現手順: 買い物へ金額を入力し、同じ支払いを出費としても記録する。
- なぜ問題か: 現在のヘルプはあるが、記録種別選択時には二重計上の扱いが判断しづらい。将来の費用集計で数字が重複する可能性がある。
- 推奨修正: 種類選択時の短い説明を明確にし、費用集計を実装するPhaseで重複ルールを固定する。常設説明を増やしすぎない。
- 既存仕様を壊す可能性: 低から中。現時点は文言整理に留め、モデル統合は行わない。

## P3

独立して優先対応すべき見た目上の問題は確認されませんでした。英語Eyebrowなどは既存の雑誌表現と整合しており、旅行中の操作を妨げていません。

## Next Top 5

1. [Resolved] GitHub Pagesのnested route reloadをSPA fallbackで復旧する。
2. 完了済み・過去旅行の「いま」操作を安全に制限する。
3. 「滞在だけ終了」を追加し、不要な移動区間を作らない。
4. 詳細編集への確実なスクロール・Focus移動を実装する。
5. 詳細Editorの保存失敗を入力位置で表示し、再試行可能にする。

## Verification Notes

- 実操作で確認: 到着、食事、メモ、出発、移動開始、買い物、出費、移動到着、次の滞在、キャンセル、日付またぎ、再読み込み、Timeline。
- 静的確認で補完: 完了済み旅行の制限欠如、滞在終了と移動開始の結合、詳細Editorのスクロール時機、保存Errorの表示位置。
- Safe Areaはブラウザ表示とCSS上の確認であり、実機のノッチ・ホームインジケータは未検証。
