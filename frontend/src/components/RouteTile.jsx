export default function RouteTile({ route, isFav, onToggleFavorite, onShow }) {
  return (
    <article className="route-tile" onClick={onShow}>
      <div className="route-tile__photo">
        {route.photo ? (
          <img src={route.photo} alt={route.title} />
        ) : (
          <span className="photo-placeholder">📷 Нет фото</span>
        )}
      </div>

      <div className="route-tile__body">
        <h3 className="route-tile__title">{route.title}</h3>
        <p className="meta">~{route.durationMin} мин</p>
        <div className="route-tile__footer">
          <span className="rating">★ {route.rating ?? '—'}</span>
          <button
            type="button"
            className={`fav-btn${isFav ? ' active' : ''}`}
            onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
            aria-label="В избранное"
          >
            <svg className="heart" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          </button>
        </div>
      </div>
    </article>
  );
}
