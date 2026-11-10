import { useState } from 'react';

const TRIP_OPTIONS = [
  { value: 'любой', label: 'Любой' },
  { value: 'туристический', label: 'Туристический' },
  { value: 'активный', label: 'Активный' },
  { value: 'спокойный', label: 'Спокойный' },
];
const DURATIONS = [15, 30, 60];
const TAGS = ['набережная', 'парк', 'центр', 'озеро'];

export default function PreferenceForm({ filters, onFiltersChange }) {
  const [tagsOpen, setTagsOpen] = useState(false);

  function setTripType(v) {
    onFiltersChange({ ...filters, tripType: v });
  }
  function setMaxDuration(v) {
    onFiltersChange({ ...filters, maxDuration: Number(v) });
  }
  function toggleTag(t) {
    const tags = filters.tags.includes(t)
      ? filters.tags.filter((x) => x !== t)
      : [...filters.tags, t];
    onFiltersChange({ ...filters, tags });
  }

  return (
    <section className="panel filters">
      <h2>Подберите маршрут</h2>

      <fieldset>
        <legend>Характер поездки</legend>
        <div className="chips">
          {TRIP_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              className={`chip${filters.tripType === o.value ? ' active' : ''}`}
              onClick={() => setTripType(o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>Время</legend>
        <select
          className="select"
          value={filters.maxDuration}
          onChange={(e) => setMaxDuration(e.target.value)}
        >
          {DURATIONS.map((d) => (
            <option key={d} value={d}>до {d} минут</option>
          ))}
        </select>
      </fieldset>

      <fieldset>
        <legend>Теги</legend>
        <div className="multi-select">
          <button type="button" className="multi-select__trigger" onClick={() => setTagsOpen((v) => !v)}>
            <span className="multi-select__value">
              {filters.tags.length ? filters.tags.join(', ') : 'Выберите теги'}
            </span>
            <span className="caret">▾</span>
          </button>
          {tagsOpen && (
            <div className="multi-select__menu">
              {TAGS.map((t) => (
                <label key={t} className="multi-select__option">
                  <input
                    type="checkbox"
                    checked={filters.tags.includes(t)}
                    onChange={() => toggleTag(t)}
                  />
                  {t}
                </label>
              ))}
            </div>
          )}
        </div>
      </fieldset>
    </section>
  );
}
