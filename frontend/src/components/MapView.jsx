import { useEffect, useRef, useState } from 'react';
import { createMap, drawRoute, addMarker, fitToPoints } from '../map.ymaps21.js';
import * as api from '../api.js';

function dispose(map) {
  try { map?.remove?.(); } catch {}
  try { map?.destroy?.(); } catch {}
}

export default function MapView({ route, notice, onDismissNotice, onBack, onRent, showRent }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(null);
  const [drawError, setDrawError] = useState(null);
  const [bikes, setBikes] = useState([]);

  // 1) Создаём карту.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let cancelled = false;
    Promise.resolve(createMap(el))
      .then((m) => {
        if (cancelled) {
          dispose(m);
          return;
        }
        mapRef.current = m;
        setMapReady(true);
      })
      .catch((e) => setMapError(e?.message || 'Не удалось загрузить карту.'));
    return () => {
      cancelled = true;
      dispose(mapRef.current);
      mapRef.current = null;
      markersRef.current = [];
      setMapReady(false);
    };
  }, []);

  // 2) Подгружаем велосипеды (для маркеров на карте).
  useEffect(() => {
    let cancelled = false;
    api.getBikes()
      .then((list) => { if (!cancelled) setBikes(list); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  function clearMarkers() {
    markersRef.current.forEach((m) => { try { m.remove?.(); } catch {} });
    markersRef.current = [];
  }

  // 3) Рисуем линию маршрута.
  useEffect(() => {
    if (!mapReady || !route?.geometry) return;
    const map = mapRef.current;
    (async () => {
      try {
        setDrawError(null);
        await drawRoute(map, route);
      } catch (e) {
        setDrawError(e?.message || 'Не удалось отрисовать маршрут.');
      }
    })();
  }, [mapReady, route]);

  // 4) Маркеры + подгонка масштаба.
  useEffect(() => {
    if (!mapReady || !route?.geometry) return;
    const map = mapRef.current;
    (async () => {
      try {
        clearMarkers();
        const markers = [await addMarker(map, route.start, { color: '#1b8a5a' })];
        for (const b of bikes) {
          if (b.coords) {
            const color = b.status === 'available' ? '#1a73e8' : '#9aa3ad';
            markers.push(await addMarker(map, b.coords, { color }));
          }
        }
        markersRef.current = markers;

        const points = route.geometry.coordinates.concat(
          bikes.filter((b) => b.coords).map((b) => b.coords),
        );
        await fitToPoints(map, points);
      } catch (e) {
        setDrawError(e?.message || 'Не удалось отрисовать маркеры.');
      }
    })();
  }, [mapReady, route, bikes]);

  return (
    <div className="map-view">
      <div className="toolbar">
        <button type="button" onClick={onBack}>← К списку</button>
        {route && <h2>{route.title}</h2>}
        {notice && (
          <div className="toolbar-notice" role="status">
            <span>{notice}</span>
            <button type="button" className="notice-close" onClick={onDismissNotice} aria-label="Закрыть">×</button>
          </div>
        )}
      </div>

      {mapError ? (
        <div className="map-error">
          <p>{mapError}</p>
          <button type="button" onClick={() => window.location.reload()}>Повторить</button>
        </div>
      ) : (
        <div ref={containerRef} className="map-container" />
      )}

      {drawError && <p className="banner error">{drawError}</p>}

      {route && (
        <div className="route-panel">
          <p>{route.description}</p>
          <p className="meta">{route.categories.join(', ')} · ~{route.durationMin} мин</p>
          {showRent && (
            <button type="button" className="primary" onClick={onRent}>Арендовать велосипед</button>
          )}
        </div>
      )}
    </div>
  );
}
