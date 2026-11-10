import RouteTile from './RouteTile.jsx';

export default function Recommendations({ routes, loading, favorites, onToggleFavorite, onShow }) {
  return (
    <section className={`panel recommendations${loading ? ' loading' : ''}`}>
      <h2 className="recommendations__title">Рекомендации</h2>

      {!loading && routes.length === 0 && (
        <p className="meta">Ничего не нашлось. Измените фильтры.</p>
      )}

      <div className="recommend-grid">
        {routes.map((r) => (
          <RouteTile
            key={r.id}
            route={r}
            isFav={favorites.includes(r.id)}
            onToggleFavorite={() => onToggleFavorite(r.id)}
            onShow={() => onShow(r.id)}
          />
        ))}
      </div>
    </section>
  );
}
