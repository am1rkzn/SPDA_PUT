export default function StatusBanner({ banner, onClose }) {
  if (!banner) return null;
  return (
    <div className={`banner ${banner.type}`} role="alert">
      <span>{banner.text}</span>
      <button type="button" onClick={onClose} aria-label="Закрыть">×</button>
    </div>
  );
}
