import { useRef, useState } from 'react';
import { buildBackupPayload, restoreBackupPayload } from '../features/backup/backupService';
import { rerunInitialRpgAggregation, resetRpgDataOnly } from '../features/rpg/rpgMaintenanceService';
import { getRpgSettings, updateRpgSettings } from '../features/rpg/rpgSettingsService';
import { useAsyncData } from '../shared/hooks/useAsyncData';

export function SettingsPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [reloadKey, setReloadKey] = useState(0);
  const { data: rpgSettings } = useAsyncData(getRpgSettings, [reloadKey]);

  async function handleExport() {
    setMessage('');
    setError('');
    try {
      const payload = await buildBackupPayload();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `travel-log-backup-${payload.exportedAt.slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setMessage('JSONバックアップを書き出しました。');
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : '書き出しに失敗しました。');
    }
  }

  async function handleImport(file?: File) {
    if (!file) return;
    if (!window.confirm('現在の端末内データをバックアップの内容で置き換えますか？')) return;
    setMessage('');
    setError('');
    try {
      const payload = JSON.parse(await file.text()) as unknown;
      await restoreBackupPayload(payload);
      setMessage('JSONバックアップを読み込みました。画面を再読み込みすると反映されます。');
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : '読み込みに失敗しました。');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  return (
    <>
      <section className="page-heading">
        <h1>設定</h1>
        <p>インポート、エクスポート、同期、ログイン状態の管理をここに追加していきます。</p>
      </section>

      <div className="grid">
        {message && <div className="status-banner">{message}</div>}
        {error && <div className="form-errors">{error}</div>}

        <section className="card">
          <h2>保存先</h2>
          <p className="muted">現在は端末内のIndexedDBに保存します。</p>
        </section>

        <section className="card">
          <h2>JSONバックアップ</h2>
          <p className="muted">旅行記録、訪問場所、コレクション、日本制覇マップの訪問情報を書き出し・復元します。</p>
          <div className="form-actions">
            <button className="button button--primary" type="button" onClick={() => void handleExport()}>
              書き出し
            </button>
            <button className="button" type="button" onClick={() => fileInputRef.current?.click()}>
              読み込み
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            hidden
            onChange={(event) => void handleImport(event.target.files?.[0])}
          />
        </section>

        <section className="card">
          <h2>Cloudflare同期</h2>
          <p className="muted">
            Workers + D1の同期Repositoryを後続フェーズで追加できる構成です。JSONバックアップには城コレクションの
            `castleVisitSummaries` と `castleVisitEvents` も含まれます。
          </p>
          <p className="muted">
            実通信にはCloudflare Worker URL、認証方式、D1/KVスキーマが必要です。未設定のため現在は端末内保存です。
          </p>
        </section>

        {rpgSettings && (
          <section className="card">
            <h2>旅行RPG設定</h2>
            <div className="grid">
              <Toggle
                label="旅行RPG機能"
                checked={rpgSettings.rpgEnabled}
                onChange={async (checked) => {
                  await updateRpgSettings({ rpgEnabled: checked });
                  setReloadKey((value) => value + 1);
                }}
              />
              <Toggle
                label="レベルアップ演出"
                checked={rpgSettings.levelUpAnimationEnabled}
                onChange={async (checked) => {
                  await updateRpgSettings({ levelUpAnimationEnabled: checked });
                  setReloadKey((value) => value + 1);
                }}
              />
              <Toggle
                label="実績解除通知"
                checked={rpgSettings.achievementNotificationsEnabled}
                onChange={async (checked) => {
                  await updateRpgSettings({ achievementNotificationsEnabled: checked });
                  setReloadKey((value) => value + 1);
                }}
              />
              <Toggle
                label="ユーザー作成クエストEXPをレベルへ含める"
                checked={rpgSettings.includeCustomQuestExpInLevel}
                onChange={async (checked) => {
                  await updateRpgSettings({ includeCustomQuestExpInLevel: checked });
                  setReloadKey((value) => value + 1);
                }}
              />
              <p className="muted">
                初回集計: {rpgSettings.initialAggregationCompletedAt ? rpgSettings.initialAggregationCompletedAt.slice(0, 10) : '未実行'}
              </p>
              <div className="form-actions">
                <button
                  className="button"
                  type="button"
                  onClick={async () => {
                    await rerunInitialRpgAggregation();
                    setMessage('RPG進捗を再集計しました。');
                    setReloadKey((value) => value + 1);
                  }}
                >
                  RPG進捗を再集計
                </button>
                <button
                  className="button button--danger"
                  type="button"
                  onClick={async () => {
                    if (!window.confirm('旅行記録などは残し、RPGデータのみリセットしますか？')) return;
                    await resetRpgDataOnly();
                    setMessage('RPGデータのみリセットしました。');
                    setReloadKey((value) => value + 1);
                  }}
                >
                  RPGデータのみリセット
                </button>
              </div>
            </div>
          </section>
        )}

        <section className="card">
          <h2>PWA</h2>
          <p className="muted">ホーム画面に追加して、インストール済みアプリのように起動できます。</p>
        </section>
      </div>
    </>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => Promise<void>;
}) {
  return (
    <label className="checkbox-field">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => void onChange(event.target.checked)}
      />
      {label}
    </label>
  );
}
