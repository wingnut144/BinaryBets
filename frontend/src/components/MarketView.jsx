import MarketsView from './MarketsView';

function MarketView({ token, user, refreshUser }) {
  return <MarketsView token={token} user={user} refreshUser={refreshUser} />;
}

export default MarketView;
