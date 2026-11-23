import { useEffect, useRef, useState } from 'react';
import { createMap, drawRoute, addBike, fitToPoints } from '../map.ymaps21.js';
import { getBikes } from '../api.js';

export default function MapView({ route, notice, onDismissNotice, onBack, onStart, canRent, writing, fleetRevision, children }) {
  const container = useRef(null);
  const [map, setMap] = useState(null);
  const [mapError, setMapError] = useState(false);
  const [bikes, setBikes] = useState([]);
  const [fleetError, setFleetError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [selectedId, setSelectedId] = useState(null);
  const selected = bikes.find(bike => bike.id === selectedId);
  const card = useRef(null);

  useEffect(() => {
    let disposed = false;
    let instance;
    const timeout = setTimeout(() => setMapError(true), 12000);
    createMap(container.current).then(result => {
      if (disposed) {
        result.destroy();
        return;
      }
      instance = result;
      setMapError(false);
      setMap(result);
    }).catch(() => { if (!disposed) setMapError(true); })
      .finally(() => clearTimeout(timeout));
    return () => {
      disposed = true;
      clearTimeout(timeout);
      instance?.destroy();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setFleetError(false);
    getBikes().then(list => {
      if (!cancelled) setBikes(list);
    }).catch(() => {
      if (!cancelled) {
        setBikes([]);
        setFleetError(true);
      }
    });
    return () => { cancelled = true; };
  }, [fleetRevision, retry]);

  useEffect(() => {
    if (!map) return;
    const remove = drawRoute(map, route);
    fitToPoints(map, route.geometry.coordinates);
    return remove;
  }, [map, route]);

  useEffect(() => {
    if (!map) return;
    const removers = bikes.map(bike => addBike(map, bike, setSelectedId));
    return () => removers.forEach(remove => remove());
  }, [map, bikes]);

  useEffect(() => {
    if (selectedId && window.matchMedia('(max-width: 900px)').matches) {
      card.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedId]);

  return (
    <div className="map-view route-layout">
      <div className="map-view__head toolbar">
        <button type="button" onClick={onBack}>← К списку</button>
        <h2>{route.title}</h2>
        {notice && <div role="status">{notice} <button onClick={onDismissNotice} aria-label="Закрыть">×</button></div>}
      </div>
      <section className="route-panel route-description">
        <p className="meta">{route.categories.join(' · ')}</p>
        <strong>{route.distanceKm?.toLocaleString('ru-RU')} км · {route.durationMin} мин</strong>
        <p>{route.description}</p>
        {route.landmarks?.length > 0 && <>
          <h3>По пути</h3>
          <ol>{route.landmarks.map(place => <li key={place}>{place}</li>)}</ol>
        </>}
      </section>
      <div className="map-view__map">
        <div ref={container} className="map-container" />
        {mapError && <div className="map-failure"><p>Не удалось загрузить карту.</p>
          <button onClick={() => window.location.reload()}>Повторить загрузку карты</button></div>}
        {map && bikes.length > 0 && <button className="fleet-overview"
          onClick={() => fitToPoints(map, bikes.map(b => b.coords))}>Показать все велосипеды</button>}
      </div>
      <section ref={card} className="route-rental">
        {children}
        {fleetError && <p role="alert">Не удалось загрузить велосипеды. <button onClick={() => setRetry(n => n + 1)}>Повторить</button></p>}
        {canRent && <div className="panel rent-panel">
          {mapError && <label>Выберите велосипед
            <select className="select" value={selectedId || ''} onChange={e => setSelectedId(e.target.value)}>
              <option value="">Выберите из списка</option>
              {bikes.map(b => <option key={b.id} value={b.id}>{b.label} · {b.status === 'available' ? 'свободен' : 'занят'}</option>)}
            </select>
          </label>}
          {selected ? <>
            <h3>{selected.label}</h3>
            <p role="status">{selected.status === 'available' ? 'Свободен' : 'Занят'}</p>
            <button type="button" className="primary wide" disabled={writing || selected.status !== 'available'}
              onClick={() => onStart(selected.id)}>Арендовать</button>
          </> : !mapError && <p>Нажмите на велосипед на карте, чтобы посмотреть его и начать аренду.</p>}
        </div>}
      </section>
    </div>
  );
}
