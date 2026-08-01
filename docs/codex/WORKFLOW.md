# Workflow

Codexがこのリポジトリで作業するときの固定ルールです。[Project Context](PROJECT_CONTEXT.md)、[Architecture](ARCHITECTURE.md)、[Product Rules](PRODUCT_RULES.md)と、対象機能の仕様を併読してください。

## 作業開始

- 最初に`docs/codex/`内の関連文書を読みます。
- ユーザーの今回指示を最優先します。
- 文書と実コードが矛盾する場合は実コードを優先し、完了報告の「判断」へ差異を1行だけ記載します。
- 不明点が実装を阻害する場合だけ質問します。軽微な判断は既存設計、命名、責務分離へ合わせて進めます。
- 作業前にGit statusを確認し、既存の未コミット変更を勝手に戻しません。

## 変更方針

- 目的を満たす最小変更にします。
- 既存構造を優先し、重複実装を避けます。
- UIへDomainロジックやIndexedDB処理を置きません。
- Repository／Service境界を維持します。
- 新規依存は明示指示がない限り追加しません。
- IndexedDB Version、Backup Version、Store、Indexは明示指示がない限り変更しません。
- 旧データ、旧Backup、旧フィールドの後方互換を維持します。
- 実行していない検証を成功と報告しません。

## 通常検証

コード変更時は次を実行します。

```text
pnpm typecheck
pnpm test
pnpm build
git diff --check
```

UI変更時は追加で393px、430px、768px、1024pxを確認し、横overflow、Safe Area、固定Footer／Save Barとの干渉、ブラウザwarning／errorを確認します。実機Picker、Cameraなど環境上確認できない項目は未検証と明記します。

文書だけの変更では、Markdownリンク、Version・仕様の整合性、`git diff --check`を確認します。コードや設定を変更していなければTypeCheck、テスト、Buildは原則不要です。

## Git

- 実装または文書更新の完了後に、今回の変更だけをcommitします。
- pushは禁止です。ユーザーからその作業について明示指示がある場合だけpushします。
- 無関係な既存変更をcommitへ混ぜません。

## 禁止

- 指示されていない大規模リファクタリング
- 無関係な修正や未確認ファイルの削除
- 依存パッケージの無断追加
- テストを通すための仕様変更
- Errorの握りつぶしや失敗を空結果として扱うこと
- 破壊的Migration、無断のStore／Index変更
- 未確認事項を確認済みと報告すること

## 最終報告

ユーザーが明示的に別形式を指定しない限り、最終報告は次の**5行だけ**にします。箇条書き、変更ファイル一覧、仕様の再掲、スクリーンショットパスの列挙、長い背景説明は追加しません。

```text
完了：<実装・作業内容を1行で要約>
判断：<重要な設計判断、または「特記事項なし」>
検証：<TypeCheck／テスト件数／Build／diff checkの結果>
Commit：<短縮Hashとcommit message>
次：<残課題または次Phase>
```

- 各行は可能な限り1文、全体は最大5行です。
- UI確認と未検証事項は「検証」へ短くまとめます。
- commitしていない調査では`Commit：なし`とします。
- 失敗や未検証がある場合は、成功したように要約しません。
