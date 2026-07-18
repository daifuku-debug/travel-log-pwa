import { Link } from 'react-router-dom';
import { getRpgProfile } from '../features/rpg/rpgProfileService';
import { ErrorState, LoadingState } from '../shared/components/PageState';
import { useAsyncData } from '../shared/hooks/useAsyncData';

export function RpgProfilePage() {
  const { data, error, loading } = useAsyncData(getRpgProfile, []);

  return (
    <>
      <section className="page-heading">
        <h1>冒険者プロフィール</h1>
        <p>旅行記録、日本制覇マップ、コレクションの積み重ねをRPGの進捗として振り返ります。</p>
      </section>

      {loading && <LoadingState />}
      {error && <ErrorState error={error} />}

      {data && (
        <div className="grid">
          <section className="card rpg-hero">
            <div>
              <div className="muted">Lv.{data.level.currentLevel}</div>
              <h2>{data.mainTitleName}</h2>
              <p className="muted">次のレベルまで {data.level.expToNextLevel} EXP</p>
            </div>
            <div className="rpg-exp-bar" aria-label="EXP進捗">
              <span style={{ width: `${Math.min(100, (data.level.currentExp / Math.max(1, data.level.currentExp + data.level.expToNextLevel)) * 100)}%` }} />
            </div>
          </section>

          <div className="grid grid--two summary-grid">
            <Summary label="完了旅行" value={data.stats.tripCompletedCount} />
            <Summary label="訪問都道府県" value={data.stats.prefectureVisitedCount} />
            <Summary label="宿泊都道府県" value={data.stats.prefectureStayedCount} />
            <Summary label="達成コレクション" value={data.stats.collectionCompletedCount} />
            <Summary label="解除実績" value={data.unlockedAchievementCount} />
            <Summary label="所有称号" value={data.ownedTitleCount} />
          </div>

          <section className="card">
            <div className="section-head">
              <h2>メニュー</h2>
            </div>
            <div className="rpg-menu">
              <Link className="button" to="/rpg/achievements">実績一覧</Link>
              <Link className="button" to="/rpg/titles">称号一覧</Link>
              <Link className="button" to="/rpg/quests">クエスト一覧</Link>
              <Link className="button" to="/rpg/experience">経験値履歴</Link>
            </div>
          </section>

          <section className="card">
            <h2>進行中のクエスト</h2>
            <div className="list">
              {data.inProgressQuests.length === 0 ? (
                <p className="muted">進行中のクエストはありません。</p>
              ) : data.inProgressQuests.map((quest) => (
                <div className="list-item" key={quest.id}>
                  <div>
                    <p className="list-item__title">{quest.title}</p>
                    <div className="list-item__meta">{quest.currentValue} / {quest.targetValue}・{quest.rewardExp} EXP</div>
                  </div>
                  <span className="status-badge">{quest.type}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="card">
            <h2>最近獲得した経験値</h2>
            <div className="list">
              {data.recentExperience.length === 0 ? (
                <p className="muted">まだ経験値履歴はありません。</p>
              ) : data.recentExperience.map((entry) => (
                <div className="list-item" key={entry.id}>
                  <div>
                    <p className="list-item__title">{entry.reason}</p>
                    <div className="list-item__meta">{entry.earnedAt.slice(0, 10)}</div>
                  </div>
                  <strong>+{entry.amount} EXP</strong>
                </div>
              ))}
            </div>
          </section>

          <section className="card">
            <h2>次に解除できそうな実績</h2>
            <div className="list">
              {data.nextAchievements.map((view) => (
                <div className="list-item" key={view.master.id}>
                  <div>
                    <p className="list-item__title">{view.displayName}</p>
                    <div className="list-item__meta">{view.progress.currentValue} / {view.progress.targetValue}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <div className="card">
      <h2>{label}</h2>
      <div className="stat-value">{value}</div>
    </div>
  );
}
