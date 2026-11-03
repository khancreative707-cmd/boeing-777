import { useEffect, useRef, useState } from 'react';
import {
  MousePointer2,
  Move3D,
  RotateCcw,
  Scan,
  AlertTriangle,
  ChevronRight,
  Wind,
  Orbit,
} from 'lucide-react';
import { EngineViewer } from '../scene/viewer.js';
import { Instruments } from './Instruments.jsx';
import { AircraftInstruments } from '../aircraft/Instruments.jsx';
export function Viewport({ lab, state }) {
  const aircraft = lab.kind === 'aircraft';
  const mount = useRef(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let viewer;
    try {
      viewer = new EngineViewer(mount.current, lab);
      window.__engineLab = lab;
      if (aircraft) window.__aircraftLab = lab;
    } catch (e) {
      console.error(e);
      setError(e.message);
    }
    return () => {
      viewer?.dispose();
      delete window.__engineLab;
      if (aircraft) delete window.__aircraftLab;
    };
  }, [lab]);
  return (
    <main className={`viewport-panel ${aircraft ? 'aircraft-viewport' : ''}`}>
      <div className="viewport-heading">
        <div>
          <h1>
            {aircraft
              ? state.engineFocus
                ? `${state.engineFocus === 'left' ? 'Left' : 'Right'} GE90–115B`
                : 'Boeing 777–300ER'
              : 'GE90–115B'}
          </h1>
          <p>
            {aircraft && !state.engineFocus
              ? 'Aircraft anatomy · Two GE90–115B engines'
              : 'High-bypass turbofan · Two-spool architecture'}
          </p>
        </div>
        <nav className="camera-views" aria-label="Camera views">
          {(aircraft && !state.engineFocus
            ? ['Exterior', 'Front', 'Side', 'Top', 'Underside']
            : ['Orbit', 'Front', 'Side', 'Rear']
          ).map((v) => (
            <button
              key={v}
              onClick={() => {
                lab.viewer?.setView(v);
              }}
              aria-pressed={state.cameraView === v}
              className={state.cameraView === v ? 'active' : ''}
            >
              {v}
            </button>
          ))}
          {aircraft && !state.engineFocus ? (
            <select
              aria-label="Interior camera"
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) lab.openInterior(e.target.value);
                e.target.value = '';
              }}
            >
              <option value="">Interior…</option>
              <option value="Cabin">Cabin</option>
              <option value="Cockpit">Cockpit</option>
              <option value="Cargo">Cargo bay</option>
            </select>
          ) : null}
          <button
            aria-label="Auto orbit"
            title={
              state.reduced
                ? 'Auto orbit is disabled for reduced motion'
                : 'Slow orbit · drag to take control'
            }
            disabled={state.reduced}
            aria-pressed={state.autoOrbit}
            className={state.autoOrbit ? 'active' : ''}
            onClick={() => lab.setAutoOrbit(!state.autoOrbit)}
          >
            <Orbit size={14} />
          </button>
        </nav>
      </div>
      <div
        className="viewport-canvas iso-plate"
        ref={mount}
        tabIndex={0}
        role="group"
        aria-label="Interactive engine viewport. F to focus, D to detach, A to reattach, Space to start, Home to reset, Escape to show all."
      >
        {error ? (
          <div className="webgl-error">
            <AlertTriangle size={32} />
            <h2>WebGL is unavailable</h2>
            <p>Enable hardware acceleration in your browser to explore the engine.</p>
            <p>{error}</p>
            <button className="button" onClick={() => location.reload()}>
              <RotateCcw size={14} />
              Try again
            </button>
          </div>
        ) : null}
      </div>
      <div className="viewport-bottom">
        <div className="viewport-meta">
          <span>
            {state.exploded
              ? 'EXPLODED ASSEMBLY'
              : state.isolated
                ? 'ISOLATED COMPONENT'
                : state.cutaway
                  ? 'INTERNAL CUTAWAY'
                  : 'COMPLETE ASSEMBLY'}
          </span>
          <span>{aircraft ? '777 / 300ER' : 'GE90 / 115B'}</span>
        </div>
        {aircraft ? (
          <AircraftInstruments lab={lab} state={state} />
        ) : (
          <Instruments lab={lab} interlocked={lab.simulation.interlocked} />
        )}
      </div>
      {state.airflow ? (
        <div className="airflow-legend">
          <span>
            <i className="bypass-dot" />
            Bypass air
          </span>
          <span>
            <i className="core-dot" />
            Core air
          </span>
          {!lab.simulation.on ? (
            <small>
              {lab.simulation.interlocked
                ? 'Flow paused for maintenance'
                : 'Start engine to visualize flow'}
            </small>
          ) : null}
        </div>
      ) : null}
      {state.isolated ? (
        <button
          className="isolation-back button"
          onClick={() => (aircraft ? lab.showAircraft() : lab.isolate(state.isolated))}
        >
          <Scan size={14} />
          {aircraft ? 'Show complete aircraft' : 'Show complete engine'}
        </button>
      ) : null}
      {state.message ? (
        <div
          className={`viewport-notice ${state.message.startsWith('Remove') || state.message.includes('interlocked') ? 'important' : ''}`}
          role="status"
        >
          <MousePointer2 size={13} />
          <span>{state.message}</span>
        </div>
      ) : null}
    </main>
  );
}
