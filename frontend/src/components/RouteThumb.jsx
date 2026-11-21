import { useEffect, useState } from 'react';
import * as api from '../api.js';

// Список маршрутов (/api/routes) не содержит геометрии, поэтому плитка без фото
// дозапрашивает детали своего маршрута. Результат кэшируем, чтобы смена фильтров
// не плодила повторные запросы.
const cache = new Map();

const SIZE = 100;
const PADDING = 12;

function buildPoints(coordinates) {
  const lons = coordinates.map(([lon]) => lon);
  const lats = coordinates.map(([, lat]) => lat);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);

  // Долготу сжимаем на косинус широты, иначе схема растягивается по горизонтали.
  const k = Math.cos(((minLat + maxLat) / 2) * Math.PI / 180) || 1;
  const spanX = Math.max((maxLon - minLon) * k, 1e-6);
  const spanY = Math.max(maxLat - minLat, 1e-6);
  const scale = Math.min((SIZE - PADDING * 2) / spanX, (SIZE - PADDING * 2) / spanY);
  const offsetX = (SIZE - spanX * scale) / 2;
  const offsetY = (SIZE - spanY * scale) / 2;

  return coordinates.map(([lon, lat]) => [
    offsetX + (lon - minLon) * k * scale,
    offsetY + (maxLat - lat) * scale, // север сверху
  ]);
}

export default function RouteThumb({ routeId, title }) {
  const [points, setPoints] = useState(() => cache.get(routeId) || null);

  useEffect(() => {
    if (points) return undefined;
    let alive = true;
    api.getRoute(routeId)
      .then((route) => {
        const coords = route?.geometry?.coordinates;
        const next = Array.isArray(coords) && coords.length > 1 ? buildPoints(coords) : null;
        cache.set(routeId, next);
        if (alive) setPoints(next);
      })
      .catch(() => {
        cache.set(routeId, null);
        if (alive) setPoints(null);
      });
    return () => { alive = false; };
  }, [routeId, points]);

  if (!points) return null;

  const polyline = points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  const [startX, startY] = points[0];

  return (
    <svg
      className="route-thumb"
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`Схема маршрута: ${title}`}
    >
      <polyline className="route-thumb__shadow" points={polyline} />
      <polyline className="route-thumb__line" points={polyline} />
      <circle className="route-thumb__start" cx={startX} cy={startY} r="2.4" />
    </svg>
  );
}
