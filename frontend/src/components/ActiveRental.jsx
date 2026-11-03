export default function ActiveRental({ rental, loading, onFinish }) {
  const time = rental.startedAt
    ? new Date(rental.startedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <section className="panel">
      <h2>● Аренда активна</h2>
      <p><strong>{rental.bikeLabel || rental.bikeId}</strong>{time ? ` · начата ${time}` : ''}</p>
      <p>Маршрут: {rental.routeTitle || rental.routeId}</p>
      <button type="button" className="danger" onClick={onFinish} disabled={loading}>
        {loading ? 'Завершение…' : 'Завершить аренду'}
      </button>
    </section>
  );
}
