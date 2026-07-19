import { Link } from 'react-router-dom';
import type { JapanConquestSummary, PrefectureView } from '../japanConquestLogic';
import { JapanGeoMap } from './JapanGeoMap';

export function JapanMapPreview({
  views,
  summary,
}: {
  views: PrefectureView[];
  summary: JapanConquestSummary;
}) {
  return (
    <section className="home-map-preview" aria-labelledby="home-map-title">
      <div className="home-section-heading home-map-preview__heading">
        <div>
          <span className="home-section-heading__eyebrow">旅の広がり</span>
          <h2 id="home-map-title">日本制覇マップ</h2>
        </div>
      </div>
      <div className="home-map-preview__canvas">
        <JapanGeoMap views={views} interactive={false} ariaLabel="都道府県の訪問状況プレビュー" />
        <div className="home-map-preview__rate"><strong>{summary.visitRate.toFixed(1)}%</strong><span>訪問制覇率</span></div>
        <div className="home-map-preview__legend" aria-label="地図プレビューの凡例">
          <span><i className="status-visited" aria-hidden="true" />訪問済み</span>
          <span><i className="status-passed" aria-hidden="true" />通過・到達</span>
          <span><i className="status-unvisited" aria-hidden="true" />未訪問</span>
        </div>
        <Link className="button button--primary" to="/japan-map">地図を開く <span aria-hidden="true">→</span></Link>
      </div>
    </section>
  );
}
