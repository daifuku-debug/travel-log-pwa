import { useRef, useState } from 'react';
import { buildBackupPayload, restoreBackupPayload } from '../features/backup/backupService';

export function SettingsPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string>('');
  const [error, setError] = useState<string>('');

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
          <p className="muted">Workers + D1の同期Repositoryを後続フェーズで追加できる構成です。</p>
        </section>

        <section className="card">
          <h2>PWA</h2>
          <p className="muted">ホーム画面に追加して、インストール済みアプリのように起動できます。</p>
        </section>
      </div>
    </>
  );
}
