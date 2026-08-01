import { useEffect, useRef, useState } from 'react';
import {
  buildFullBackupPackage,
  estimateFullBackup,
  type FullBackupBuildResult,
  type FullBackupEstimate,
  type FullBackupProgress,
} from './fullBackupService.ts';

const STAGE_LABELS: Record<FullBackupProgress['stage'], string> = {
  snapshot: '端末内データをまとめています',
  hashing: '写真を確認しています',
  packaging: 'ZIPへ写真を収めています',
  validating: 'バックアップを自己検証しています',
  ready: '完全バックアップの準備ができました',
};

export function FullBackupPanel() {
  const [estimate, setEstimate] = useState<FullBackupEstimate>();
  const [progress, setProgress] = useState<FullBackupProgress>();
  const [result, setResult] = useState<FullBackupBuildResult>();
  const [error, setError] = useState('');
  const controllerRef = useRef<AbortController | undefined>(undefined);
  const building = Boolean(controllerRef.current);

  useEffect(() => {
    let active = true;
    void estimateFullBackup().then((value) => {
      if (active) setEstimate(value);
    }).catch(() => undefined);
    return () => {
      active = false;
      controllerRef.current?.abort();
    };
  }, []);

  async function handleBuild() {
    if (controllerRef.current) return;
    const controller = new AbortController();
    controllerRef.current = controller;
    setResult(undefined);
    setError('');
    setProgress({ stage: 'snapshot', completed: 0, total: 1 });
    try {
      const nextResult = await buildFullBackupPackage({
        signal: controller.signal,
        onProgress: setProgress,
      });
      if (!controller.signal.aborted) setResult(nextResult);
    } catch (buildError) {
      if (!(buildError instanceof DOMException && buildError.name === 'AbortError')) {
        setError(buildError instanceof Error ? buildError.message : '完全バックアップを作成できませんでした。');
      }
    } finally {
      if (controllerRef.current === controller) controllerRef.current = undefined;
      if (controller.signal.aborted) setProgress(undefined);
    }
  }

  function handleCancel() {
    controllerRef.current?.abort();
  }

  function handleDownload() {
    if (!result?.validation.success) return;
    const url = URL.createObjectURL(result.blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `travel-backup-full-${result.manifest.createdAt.slice(0, 10)}.zip`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  const progressValue = progress?.total ? progress.completed / progress.total : 0;
  const missingCount = result?.manifest.summary.missingCount ?? 0;

  return (
    <section className="card full-backup" aria-busy={building || undefined}>
      <div className="full-backup__heading">
        <div>
          <p className="eyebrow">完全Backup</p>
          <h2>写真を含むバックアップ</h2>
        </div>
        {estimate && (
          <span className="full-backup__estimate">
            写真 {estimate.mediaAssetCount}件・約{formatBytes(estimate.availableByteSize)}
          </span>
        )}
      </div>
      <p className="muted">旅行記録と端末内の写真を、別端末での復元に備えたZIPへまとめます。ファイルは大きくなる場合があります。</p>
      <p className="full-backup__privacy">この初期版は暗号化されません。個人の写真を含むため、他人と共有しないでください。</p>

      {progress && (
        <div className="full-backup__progress" aria-live="polite">
          <div>
            <strong>{STAGE_LABELS[progress.stage]}</strong>
            {progress.total > 1 && <span>{progress.completed} / {progress.total}</span>}
          </div>
          <progress max={1} value={progressValue} aria-label={STAGE_LABELS[progress.stage]} />
        </div>
      )}

      {missingCount > 0 && (
        <div className="full-backup__warning" role="status">
          写真の一部（{missingCount}ファイル）が含まれていません。記録は残し、欠損内容をZIP内のmanifestへ記録しました。
        </div>
      )}
      {error && <div className="form-errors" role="alert">{error}</div>}

      <div className="form-actions">
        {!result && (
          <button className="button button--primary" type="button" disabled={building} onClick={() => void handleBuild()}>
            {error ? 'もう一度作成' : '完全Backupを作成'}
          </button>
        )}
        {building && (
          <button className="button" type="button" onClick={handleCancel}>
            キャンセル
          </button>
        )}
        {result && (
          <>
            <button className="button button--primary" type="button" onClick={handleDownload}>
              ZIPをダウンロード
            </button>
            <button className="button" type="button" onClick={() => { setResult(undefined); setProgress(undefined); }}>
              作り直す
            </button>
          </>
        )}
      </div>
    </section>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
