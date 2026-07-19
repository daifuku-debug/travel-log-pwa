import type { Scrapbook } from '../../../domain/models/scrapbook';
import { Badge, Card } from '../../../shared/ui';

export function ScrapbookCover({
  scrapbook,
  subtitle,
  dateRange,
}: {
  scrapbook: Scrapbook;
  subtitle: string;
  dateRange: string;
}) {
  const statusLabel = scrapbook.status === 'completed' ? '完成' : scrapbook.status === 'archived' ? 'アーカイブ' : '下書き';
  const statusVariant = scrapbook.status === 'completed' ? 'success' : scrapbook.status === 'archived' ? 'neutral' : 'warning';
  return (
    <Card className="scrapbook-cover">
      <div>
        <div className="list-item__meta">旅行スクラップブック</div>
        <h2>{scrapbook.title}</h2>
        <p>{subtitle}</p>
        <p className="muted">{dateRange}</p>
      </div>
      <Badge variant={statusVariant}>{statusLabel}</Badge>
    </Card>
  );
}
