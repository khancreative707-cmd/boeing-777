import { useEffect, useRef, useState } from 'react';
import {
  MousePointer2,
  Move3D,
  RotateCcw,
  Scan,
  AlertTriangle,
  ChevronRight,
  Wind,
} from 'lucide-react';
import { EngineViewer } from '../scene/viewer.js';
import { Instruments } from './Instruments.jsx';
export function Viewport({ lab, state }) {
  const mount = useRef(null);
  const [error, setError] = useState(''),
    [view, setView] = useState('Orbit');
  useEffect(() => {
    let viewer;
    try {
      viewer = new EngineViewer(mount.current, lab);
      window.__engineLab = lab;
    } catch (e) {
      console.error(e);
      setError(e.message);
    }
    return () => {
      viewer?.dispose();
      delete window.__engineLab;
    };
  }, [lab]);
  return (
    <main className="viewport-panel">
      <div className="viewport-heading">
        <div>
          <h1>GE90–115B</h1>
          <p>
            High-bypass turbofan <span>·</span> Two-spool architecture
          </p>
        </div>
        <nav className="camera-views" aria-label="Camera views">
          {['Orbit', 'Front', 'Side', 'Rear'].map((v) => (
            <button
              key={v}
              onClick={() => {
                setView(v);
                lab.viewer?.setView(v);
              }}
              aria-pressed={view === v}
              className={view === v ? 'active' : ''}
            >
              {v}
            </button>
          ))}
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
          <span>GE90 / 115B</span>
        </div>
        <Instruments lab={lab} interlocked={lab.simulation.interlocked} />
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
        <button className="isolation-back button" onClick={() => lab.isolate(state.isolated)}>
          <Scan size={14} />
          Show complete engine
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
