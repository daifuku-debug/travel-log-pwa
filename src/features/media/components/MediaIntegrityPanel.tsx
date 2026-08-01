import { useMemo, useState } from 'react';
import type {
  MediaIntegrityIssue,
  MediaIntegrityIssueType,
  MediaIntegrityReport,
} from '../../../domain/media/mediaIntegrity';
import { Button } from '../../../shared/ui/Button';
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog';
import { InlineError } from '../../../shared/ui/InlineError';
import { useToast } from '../../../shared/ui/ToastContext';
import { scanMediaAssetIntegrity } from '../mediaIntegrityService';
import {
  getMediaIntegrityRepairAction,
  isDestructiveMediaIntegrityRepair,
  repairMediaIntegrityIssues,
} from '../mediaIntegrityRepairService';

const ISSUE_LABELS: Record<MediaIntegrityIssueType, string> = {
  'orphan-blob': '所有情報のない画像データ',
  'invalid-blob-id': '形式が正しくない画像データ',
  'missing-original': '元画像が見つからない写真',
  'missing-thumbnail': 'プレビュー画像が見つからない写真',
  'cleanup-pending': '削除後に残っている画像データ',
  'invalid-blob-reference': '画像の参照先が一致しない写真',
  'invalid-content-hash': '重複確認情報が正しくない写真',
  'invalid-cover-owner': '表紙素材の所有先が正しくない写真',
  'dangling-reference': '存在しない写真への参照',
  'stale-reference-source': '削除済み記録に残る写真参照',
};

const REPAIR_LABELS = {
  'regenerate-thumbnail': 'プレビューを再生成',
  'delete-cleanup-blobs': '残存データを清掃',
  'delete-orphan-blob': '画像データを削除',
  'normalize-blob-reference': '参照先を修正',
} as const;

interface PendingConfirmation {
  issues: MediaIntegrityIssue[];
  title: string;
  description: string;
  confirmLabel: string;
}

export function MediaIntegrityPanel() {
  const { showToast } = useToast();
  const [report, setReport] = useState<MediaIntegrityReport>();
  const [scanning, setScanning] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [confirmation, setConfirmation] = useState<PendingConfirmation>();
  const issueGroups = useMemo(() => groupIssues(report?.issues ?? []), [report]);
  const safeBatch = useMemo(() => report
    ? report.issues.filter((issue) => isRepairableNow(report, issue)
      && !isDestructiveMediaIntegrityRepair(issue))
    : [], [report]);

  async function runScan() {
    setScanning(true);
    setError('');
    setStatus('');
    try {
      const nextReport = await scanMediaAssetIntegrity();
      setReport(nextReport);
      setStatus(nextReport.issues.length === 0
        ? '写真データに問題は見つかりませんでした。'
        : '診断が完了しました。内容を確認してください。');
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : '写真データを診断できませんでした。');
    } finally {
      setScanning(false);
    }
  }

  async function runRepair(issues: MediaIntegrityIssue[]) {
    if (!issues.length) return;
    setRepairing(true);
    setError('');
    setStatus('');
    try {
      const repair = await repairMediaIntegrityIssues(issues);
      if (repair.report) setReport(repair.report);
      const succeeded = repair.results.filter((result) => result.status === 'success').length;
      const failed = repair.results.filter((result) => result.status === 'failed').length;
      const skipped = repair.results.filter((result) => result.status === 'skipped').length;
      if (repair.rescanStatus === 'failed') {
        setError('修復後の再診断に失敗しました。もう一度診断を実行してください。');
      } else if (failed > 0) {
        setError(`${failed}件を修復できませんでした。診断結果を残しているため、再試行できます。`);
      } else {
        const nextStatus = succeeded > 0
          ? `${succeeded}件を修復し、写真データを再診断しました。`
          : `状態が変わっていたため修復しませんでした${skipped ? `（${skipped}件）` : ''}。`;
        setStatus(nextStatus);
        showToast({ title: nextStatus, variant: succeeded > 0 ? 'success' : 'warning' });
      }
    } catch (repairError) {
      setError(repairError instanceof Error ? repairError.message : '写真データを修復できませんでした。');
    } finally {
      setRepairing(false);
      setConfirmation(undefined);
    }
  }

  function requestRepair(issue: MediaIntegrityIssue) {
    const action = getMediaIntegrityRepairAction(issue);
    if (!action || !report || !isRepairableNow(report, issue)) return;
    if (isDestructiveMediaIntegrityRepair(issue)) {
      setConfirmation({
        issues: [issue],
        title: action === 'delete-orphan-blob' ? '画像データを削除しますか？' : '残存データを清掃しますか？',
        description: '対象をもう一度確認し、現在も安全に処理できる場合だけ画像データを削除します。この操作は元に戻せません。',
        confirmLabel: action === 'delete-orphan-blob' ? '画像データを削除' : '残存データを清掃',
      });
      return;
    }
    void runRepair([issue]);
  }

  return (
    <section className="card media-integrity" aria-busy={scanning || repairing || undefined}>
      <div className="media-integrity__heading">
        <div>
          <h2>写真データ診断</h2>
          <p className="muted">端末内の写真と記録の整合性を確認します。診断だけではデータを変更しません。</p>
        </div>
        <Button variant="secondary" loading={scanning} disabled={repairing} onClick={() => void runScan()}>
          診断を実行
        </Button>
      </div>

      {error && <InlineError message={error} action={<Button onClick={() => void runScan()}>もう一度診断</Button>} />}
      {status && <p className="media-integrity__status" role="status" aria-live="polite">{status}</p>}

      {report && (
        <>
          <div className="media-integrity__summary" aria-label="診断結果の概要">
            <SummaryItem label="正常" value={report.summary.totalIssues === 0 ? '問題なし' : '診断済み'} tone="normal" />
            <SummaryItem label="注意" value={`${report.summary.warningCount}件`} tone="warning" />
            <SummaryItem label="要確認" value={`${report.summary.errorCount}件`} tone="error" />
          </div>

          {safeBatch.length > 1 && (
            <div className="media-integrity__batch">
              <p>画像を削除しない安全な修復候補が{safeBatch.length}件あります。</p>
              <Button variant="primary" loading={repairing} onClick={() => void runRepair(safeBatch)}>
                安全な項目をまとめて修復
              </Button>
            </div>
          )}

          {report.issues.length === 0 ? (
            <div className="media-integrity__empty">
              <strong>写真データは正常です</strong>
              <span>修復が必要な項目はありません。</span>
            </div>
          ) : (
            <div className="media-integrity__groups">
              {issueGroups.map(([type, issues]) => (
                <section className="media-integrity__group" key={type}>
                  <div className="media-integrity__group-heading">
                    <h3>{ISSUE_LABELS[type]}</h3>
                    <span>{issues.length}件</span>
                  </div>
                  <ul className="media-integrity__issues">
                    {issues.map((issue, index) => {
                      const action = getMediaIntegrityRepairAction(issue);
                      const repairable = isRepairableNow(report, issue);
                      return (
                        <li key={issueKey(issue, index)}>
                          <div className="media-integrity__issue-copy">
                            <strong>{issueTarget(issue)}</strong>
                            <span>{repairable ? '安全条件を再確認して修復できます' : '内容の確認または個別編集が必要です'}</span>
                          </div>
                          <span className={`media-integrity__badge media-integrity__badge--${repairable ? 'repairable' : 'review'}`}>
                            {repairable ? '修復可能' : '要確認'}
                          </span>
                          {action && repairable && (
                            <Button
                              size="sm"
                              variant={isDestructiveMediaIntegrityRepair(issue) ? 'danger' : 'secondary'}
                              disabled={repairing}
                              onClick={() => requestRepair(issue)}
                            >
                              {REPAIR_LABELS[action]}
                            </Button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={Boolean(confirmation)}
        title={confirmation?.title ?? ''}
        description={confirmation?.description ?? ''}
        confirmLabel={confirmation?.confirmLabel ?? '実行'}
        processing={repairing}
        onCancel={() => setConfirmation(undefined)}
        onConfirm={() => void runRepair(confirmation?.issues ?? [])}
      />
    </section>
  );
}

function SummaryItem({ label, value, tone }: { label: string; value: string; tone: 'normal' | 'warning' | 'error' }) {
  return (
    <div className={`media-integrity__summary-item media-integrity__summary-item--${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function groupIssues(issues: MediaIntegrityIssue[]): Array<[MediaIntegrityIssueType, MediaIntegrityIssue[]]> {
  const groups = new Map<MediaIntegrityIssueType, MediaIntegrityIssue[]>();
  for (const issue of issues) groups.set(issue.type, [...(groups.get(issue.type) ?? []), issue]);
  return [...groups.entries()];
}

function isRepairableNow(report: MediaIntegrityReport, issue: MediaIntegrityIssue): boolean {
  const action = getMediaIntegrityRepairAction(issue);
  if (!action) return false;
  if (action === 'regenerate-thumbnail') {
    return !report.issues.some((candidate) => candidate.type === 'missing-original' && candidate.assetId === issue.assetId);
  }
  if (action === 'normalize-blob-reference') {
    const missingType = issue.field === 'localReference' ? 'missing-original' : 'missing-thumbnail';
    return !report.issues.some((candidate) => candidate.type === missingType && candidate.assetId === issue.assetId);
  }
  return true;
}

function issueTarget(issue: MediaIntegrityIssue): string {
  if (issue.assetId) return `写真 ${issue.assetId}`;
  if (issue.blobId) return `画像データ ${issue.blobId}`;
  return '写真データ';
}

function issueKey(issue: MediaIntegrityIssue, index: number): string {
  return [issue.type, issue.assetId, issue.blobId, issue.scrapbookId, issue.pageId, issue.blockId, issue.field, issue.occurrenceIndex, index]
    .filter((value) => value !== undefined)
    .join(':');
}
