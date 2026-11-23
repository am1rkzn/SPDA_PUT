import { useState } from 'react';

export default function BikePicker({ bikes, route, loading, onBack, onRefresh, onStart }) {
  const [selected, setSelected] = useState(null);
  const free = bikes.filter((b) => b.status === 'available').length;

  return (
    <section className="panel rent-panel">
      <div className="rent-panel__head">
        <h2>Выберите велосипед</h2>
        <button type="button" className="link-btn" onClick={onBack}>Закрыть</button>
      </div>

      {route && <p className="meta rent-panel__route">Маршрут: {route.title}</p>}

      <ul className="bike-list">
        {bikes.map((b) => {
          const busy = b.status !== 'available';
          return (
            <li key={b.id} className={busy ? 'busy' : ''}>
              <label>
                <input
                  type="radio"
                  name="bike"
                  disabled={busy}
                  checked={selected === b.id}
                  onChange={() => setSelected(b.id)}
                />
                <span className="bike-list__label">{b.label}</span>
                <span className={`bike-list__status${busy ? ' busy' : ''}`}>
                  {busy ? 'занят' : 'свободен'}
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      <p className="meta">{free > 0 ? `Свободно: ${free} из ${bikes.length}` : 'Свободных велосипедов нет'}</p>

      <div className="actions">
        <button
          type="button"
          className="primary wide"
          disabled={loading || !selected}
          onClick={() => onStart(selected)}
        >
          {loading ? 'Начинаем…' : 'Начать аренду'}
        </button>
        <button type="button" className="wide" onClick={onRefresh} disabled={loading}>
          Обновить список
        </button>
      </div>
    </section>
  );
}
