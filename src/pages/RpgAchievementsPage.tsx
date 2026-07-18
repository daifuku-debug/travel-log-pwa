import { listAchievementViews } from '../features/rpg/achievementService';
import { ensureRpgProgressInitialized } from '../features/rpg/rpgProgressService';
import { ErrorState, LoadingState } from '../shared/components/PageState';
import { useAsyncData } from '../shared/hooks/useAsyncData';

export function RpgAchievementsPage() {
  const { data, error, loading } = useAsyncData(async () => {
    await ensureRpgProgressInitialized();
    return listAchievementViews();
  }, []);
  const categories = [...new Set(data?.map((view) => view.master.category) ?? [])];

  return (
    <>
      <section className="page-heading">
        <h1>実績</h1>
        <p>旅行の積み重ねで解除される達成項目です。</p>
      </section>
      {loading && <LoadingState />}
      {error && <ErrorState error={error} />}
      {data && (
        <div className="grid">
          {categories.map((category) => (
            <section className="card" key={category}>
              <h2>{category}</h2>
              <div className="list">
                {data.filter((view) => view.master.category === category).map((view) => (
                  <div className="list-item" key={view.master.id}>
                    <div>
                      <p className="list-item__title">{view.displayName}</p>
                      <div className="list-item__meta">{view.displayDescription}</div>
                      <div className="list-item__meta">{view.progress.currentValue} / {view.progress.targetValue}</div>
                    </div>
                    <span className={`status-badge achievement-${view.progress.status}`}>
                      {view.progress.status === 'unlocked' ? '解除済み' : view.progress.status === 'in_progress' ? '進行中' : '未解除'}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
