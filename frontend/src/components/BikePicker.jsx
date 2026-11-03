import { useState } from 'react';

export default function BikePicker({ bikes, route, loading, onBack, onRefresh, onStart }) {
  const [selected, setSelected] = useState(null);

  return (
    <section className="panel">
      <div className="toolbar">
        <button type="button" onClick={onBack}>← Закрыть</button>
        <h2>Выберите велосипед</h2>
      </div>

      {route && <p>Маршрут: <strong>{route.title}</strong></p>}

      <ul className="bike-list">
        {bikes.map((b) => {
          const busy = b.status !== 'available';
          return (
            <li key={b.id}>
              <label className={busy ? 'disabled' : ''}>
                <input
                  type="radio"
                  name="bike"
                  disabled={busy}
                  checked={selected === b.id}
                  onChange={() => setSelected(b.id)}
                />
                {b.label} {busy ? '— занят' : '— свободен'}
              </label>
            </li>
          );
        })}
      </ul>

      <div className="actions">
        <button type="button" className="primary" disabled={loading || !selected} onClick={() => onStart(selected)}>
          {loading ? 'Начинаем…' : 'Начать аренду'}
        </button>
        <button type="button" onClick={onRefresh} disabled={loading}>
          Обновить список
        </button>
      </div>
    </section>
  );
}
