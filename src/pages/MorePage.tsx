import { Badge, Card, NavigationListItem, PageHeader } from '../shared/ui';

export function MorePage() {
  return (
    <>
      <PageHeader title="その他" description="旅を振り返る機能や、アプリの設定をまとめています。" />
      <div className="more-groups">
        <Card title="旅を振り返る" description="過去の記録を別の角度から見返します。">
          <div className="navigation-list">
            <NavigationListItem to="/time-machine" title="タイムマシン" description="あの日どこにいたかを探す" icon="時" />
          </div>
        </Card>
        <Card title="次の旅を探す" description="次のお出かけのきっかけを作ります。">
          <div className="navigation-list">
            <NavigationListItem to="/travel-gacha" title="旅ガチャ" description="条件から旅先候補を抽選する" icon="旅" />
            <NavigationListItem to="/wishlist" title="欲しいもの" description="旅先で気になったものを管理する" icon="買" />
          </div>
        </Card>
        <Card title="コレクション・達成" description="旅の積み重ねと成長を確認します。">
          <div className="navigation-list">
            <NavigationListItem to="/castles" title="城コレクション" description="日本100名城・続日本100名城" icon="城" />
            <NavigationListItem to="/rpg" title="RPGプロフィール" description="レベルと旅の成長を確認する" icon="勇" badge={<Badge variant="info">RPG</Badge>} />
            <NavigationListItem to="/rpg/achievements" title="実績" description="解除した旅の実績を見る" />
            <NavigationListItem to="/rpg/titles" title="称号" description="獲得した称号を見る" />
            <NavigationListItem to="/rpg/quests" title="クエスト" description="進行中の目標を見る" />
            <NavigationListItem to="/rpg/experience" title="経験値履歴" description="経験値の獲得履歴を見る" />
          </div>
        </Card>
        <Card title="アプリ">
          <div className="navigation-list">
            <NavigationListItem to="/settings" title="設定" description="バックアップとアプリ設定" icon="設" />
          </div>
        </Card>
      </div>
    </>
  );
}
