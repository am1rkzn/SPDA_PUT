import { useEffect, useState } from 'react';
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

  // Восстановление активной аренды + маршрута при открытии/refresh.
  useEffect(() => {
    api.getRental()
      .then(async (r) => {
        if (!r) return;
        setRental(r);
        try {
          setSelectedRoute(await api.getRoute(r.routeId));
        } catch {}
        setStep('map');
        setRentStage('active');
      })
      .catch(() => {});
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
    clearBanner();
    setLoading(true);
    try {
      setSelectedRoute(await api.getRoute(id));
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

  async function handleStartRental(bikeId) {
    clearBanner();
    setLoading(true);
    try {
      setRental(await api.startRental({ bikeId, routeId: selectedRoute.id }));
      setRentStage('active');
    } catch (e) {
      showError(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleFinishRental() {
    clearBanner();
    setLoading(true);
    try {
      await api.finishRental();
      setRental(null);
      setRentStage('none');
      setNotice('Аренда завершена');
    } catch (e) {
      showError(e);
    } finally {
      setLoading(false);
    }
  }

  async function goToActiveRental() {
    if (!rental) return;
    try {
      setSelectedRoute(await api.getRoute(rental.routeId));
    } catch {}
    setStep('map');
    setRentStage('active');
  }

  function handleBackToRecommend() {
    setNotice(null);
    setStep('recommend');
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>ПУТЬ — велопрогулки по Казани</h1>
        {rental && !(renderedStep === 'map' && rentStage === 'active') && (
          <button type="button" onClick={goToActiveRental}>● Аренда активна</button>
        )}
      </header>

      <div className="app-body">
        <StatusBanner banner={banner} onClose={clearBanner} />

        <main>
          <div key={renderedStep} className={`step-fade ${phase}`}>
            {renderedStep === 'recommend' && (
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

            {renderedStep === 'map' && selectedRoute && (
              <div className="route-detail">
                <MapView
                  route={selectedRoute}
                  notice={notice}
                  onDismissNotice={dismissNotice}
                  onBack={handleBackToRecommend}
                  onRent={handleRent}
                  showRent={rentStage === 'none'}
                />

                {rentStage === 'pick' && (
                  <div className="rent-overlay">
                    <BikePicker
                      bikes={bikes}
                      route={selectedRoute}
                      loading={loading}
                      onBack={handleCloseRent}
                      onRefresh={refreshBikes}
                      onStart={handleStartRental}
                    />
                  </div>
                )}

                {rentStage === 'active' && (
                  <div className="rent-overlay">
                    <ActiveRental rental={rental} loading={loading} onFinish={handleFinishRental} />
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
