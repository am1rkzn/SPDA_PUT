import { useEffect, useRef, useState } from 'react';
import * as api from './api.js';
import PreferenceForm from './components/PreferenceForm.jsx';
import Recommendations from './components/Recommendations.jsx';
import MapView from './components/MapView.jsx';
import BikePicker from './components/BikePicker.jsx';
import ActiveRental from './components/ActiveRental.jsx';
import StatusBanner from './components/StatusBanner.jsx';

const FAV_KEY = 'put-favorites';

function loadFavorites() {
  try {
    return JSON.parse(localStorage.getItem(FAV_KEY)) || [];
  } catch {
    return [];
  }
}

export default function App() {
  // step — целевой экран; renderedStep — тот, что сейчас на экране (для cross-fade).
  const [step, setStep] = useState('recommend');
  const [renderedStep, setRenderedStep] = useState('recommend');
  const [phase, setPhase] = useState('in');
  const [rentStage, setRentStage] = useState('none');
  const [filters, setFilters] = useState({ tripType: 'любой', maxDuration: 60, tags: [] });
  const [routes, setRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [bikes, setBikes] = useState([]);
  const [rental, setRental] = useState(null);
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState(null);
  const [notice, setNotice] = useState(null);
  const [favorites, setFavorites] = useState(loadFavorites);

  // Cross-fade: сначала затухание старого экрана, затем появление нового.
  useEffect(() => {
    if (step === renderedStep) {
      setPhase('in');
      return;
    }
    setPhase('out');
    const t = setTimeout(() => {
      setRenderedStep(step);
      setPhase('in');
    }, 250);
    return () => clearTimeout(t);
  }, [step, renderedStep]);

  const [syncState, setSyncState] = useState('loading');
  const [writing, setWriting] = useState(false);
  const writeLock = useRef(false);
  const viewVersion = useRef(0);

  async function syncRental() {
    const version = ++viewVersion.current;
    setSyncState('loading');
    try {
      const current = await api.getRental();
      if (viewVersion.current !== version) return;
      api.confirmActive(current);
      setRental(current);
      setRentStage(current ? 'active' : 'none');
      setSyncState('ready');
      if (!current) {
        setStep('recommend');
        return;
      }
      setSelectedRoute(null);
      setStep('map');
      api.getRoute(current.routeId).then(route => {
        if (viewVersion.current === version) setSelectedRoute(route);
      }).catch(e => {
        if (viewVersion.current === version) showError(e);
      });
    } catch (e) {
      if (viewVersion.current === version) {
        setSyncState('error');
        showError(e);
      }
    }
  }

  useEffect(() => {
    syncRental();
    return () => { ++viewVersion.current; };
  }, []);

  // Живое обновление рекомендаций при любой смене фильтров.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.getRoutes(filters)
      .then((list) => {
        if (!cancelled) setRoutes(list);
      })
      .catch((e) => {
        if (!cancelled) setBanner({ type: 'error', text: e?.message || 'Что-то пошло не так' });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [filters]);

  function showError(e) {
    setBanner({ type: 'error', text: e?.message || 'Что-то пошло не так' });
  }
  function clearBanner() {
    setBanner(null);
  }
  function dismissNotice() {
    setNotice(null);
  }

  function toggleFavorite(id) {
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      localStorage.setItem(FAV_KEY, JSON.stringify(next));
      return next;
    });
  }

  async function handleShowRoute(id) {
    const version = ++viewVersion.current;
    clearBanner();
    setLoading(true);
    try {
      const route = await api.getRoute(id);
      if (version !== viewVersion.current) return;
      setSelectedRoute(route);
      setNotice(null);
      setRentStage('none');
      setStep('map');
    } catch (e) {
      showError(e);
    } finally {
      setLoading(false);
    }
  }

  async function loadBikes() {
    setLoading(true);
    try {
      setBikes(await api.getBikes());
    } catch (e) {
      showError(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleRent() {
    clearBanner();
    await loadBikes();
    setRentStage('pick');
  }

  async function refreshBikes() {
    clearBanner();
    await loadBikes();
  }

  function handleCloseRent() {
    setRentStage('none');
  }

  async function writeRental(action, successNotice) {
    if (writeLock.current || syncState !== 'ready') return;
    writeLock.current = true;
    setWriting(true);
    clearBanner();
    try {
      await action();
      setNotice(successNotice);
    } catch (e) {
      showError(e);
    } finally {
      await syncRental();
      setWriting(false);
      writeLock.current = false;
    }
  }

  function handleStartRental(bikeId) {
    return writeRental(() => api.startRental({ bikeId, routeId: selectedRoute.id }), null);
  }

  function handleFinishRental() {
    return writeRental(() => api.finishRental(rental.id), 'Аренда завершена');
  }

  function goToActiveRental() {
    clearBanner();
    syncRental();
  }

  function handleBackToRecommend() {
    ++viewVersion.current;
    setNotice(null);
    setStep('recommend');
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>ПУТЬ — велопрогулки по Казани</h1>
        {syncState === 'ready' && rental && !(renderedStep === 'map' && rentStage === 'active') && (
          <button type="button" onClick={goToActiveRental}>● Аренда активна</button>
        )}
      </header>

      <div className="app-body">
        <StatusBanner banner={banner} onClose={clearBanner} />

        <main>
          {syncState === 'loading' && <p role="status">Проверяем текущую аренду…</p>}
          {notice && step === 'recommend' && <p role="status">{notice}</p>}
          {syncState === 'error' && (
            <button onClick={() => { clearBanner(); syncRental(); }}>Повторить загрузку аренды</button>
          )}
          <div key={renderedStep} className={`step-fade ${phase}`}>
            {renderedStep === 'recommend' && syncState === 'ready' && (
              <div className="layout">
                <PreferenceForm filters={filters} onFiltersChange={setFilters} />
                <Recommendations
                  routes={routes}
                  loading={loading}
                  favorites={favorites}
                  onToggleFavorite={toggleFavorite}
                  onShow={handleShowRoute}
                />
              </div>
            )}

            {renderedStep === 'map' && syncState === 'ready' && (
              <div className="route-detail">
                {selectedRoute && <MapView
                  route={selectedRoute}
                  notice={notice}
                  onDismissNotice={dismissNotice}
                  onBack={handleBackToRecommend}
                  onRent={handleRent}
                  showRent={rentStage === 'none' && !rental && syncState === 'ready'}
                />}

                {rentStage === 'pick' && (
                  <div className="rent-overlay">
                    <BikePicker
                      bikes={bikes}
                      route={selectedRoute}
                      loading={loading || writing || syncState !== 'ready'}
                      onBack={handleCloseRent}
                      onRefresh={refreshBikes}
                      onStart={handleStartRental}
                    />
                  </div>
                )}

                {rentStage === 'active' && rental && (
                  <div className="rent-overlay">
                    <ActiveRental rental={rental} loading={writing || syncState !== 'ready'} onFinish={handleFinishRental} />
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
