import { lazy, Suspense, useEffect } from 'react';
const AircraftApp = lazy(() => import('./aircraft/App.jsx'));
const EngineExhibit = lazy(() => import('./EngineExhibit.jsx'));
export default function App() {
  const engine = new URLSearchParams(location.search).get('view') === 'engine';
  useEffect(() => {
    document.title = engine
      ? 'GE90–115B · Anatomy Engine Laboratory'
      : 'Boeing 777–300ER · Aircraft Anatomy';
  }, [engine]);
  return (
    <Suspense
      fallback={
        <div className="exhibit-loading">
          <img src="/favicon.svg" width="36" height="36" alt="" />
          <p>Preparing {engine ? 'engine' : 'aircraft'} anatomy…</p>
        </div>
      }
    >
      {engine ? <EngineExhibit /> : <AircraftApp />}
    </Suspense>
  );
}
