import { useState, useSyncExternalStore } from 'react';
import {
  Compass,
  BookOpen,
  Layers3,
  PanelRight,
  CircleHelp,
  ArrowLeft,
  ChevronRight,
} from 'lucide-react';
import { AircraftLab } from './lab.js';
import { AssemblyTree } from '../components/AssemblyTree.jsx';
import { Inspector } from '../components/Inspector.jsx';
import { Viewport } from '../components/Viewport.jsx';
import { AircraftControls } from './Controls.jsx';
import { AircraftReferences } from './References.jsx';
import './aircraft.css';
export default function AircraftApp() {
  const [lab] = useState(() => new AircraftLab());
  const state = useSyncExternalStore(lab.subscribe, lab.getSnapshot);
  const [drawer, setDrawer] = useState(null),
    [notes, setNotes] = useState(false);
  const trail = [...lab.registry.ancestors(state.selected)].reverse();
  return (
    <div className={`laboratory aircraft-laboratory ${drawer ? `drawer-${drawer}` : ''}`}>
      <header className="app-header">
        <a className="wordmark" href="./" aria-label="Anatomy Aircraft Laboratory">
          <img src="/favicon.svg" width="28" height="28" alt="" />
          <strong>ANATOMY</strong>
        </a>
        <span className="header-divider" />
        <span className="lab-name">Aircraft laboratory</span>
        <span className="header-engine">Boeing 777–300ER</span>
        <div className="header-right">
          <nav className="exhibit-tabs" aria-label="Exhibit mode">
            <button
              className={!state.engineFocus ? 'active' : ''}
              aria-pressed={!state.engineFocus}
              onClick={() => lab.showAircraft()}
            >
              Aircraft
            </button>
            <button
              className={state.engineFocus ? 'active' : ''}
              aria-pressed={!!state.engineFocus}
              onClick={() => lab.inspectEngine(state.engineFocus || 'left')}
            >
              Engine lab
            </button>
          </nav>
          <button
            className="button tour-launch"
            aria-label="Guided tour"
            aria-pressed={state.tourStep !== null}
            onClick={() => {
              if (state.tourStep !== null) lab.endTour();
              else if (lab.setTourStep(0) && matchMedia('(max-width: 760px)').matches)
                setDrawer('inspector');
            }}
          >
            <Compass size={15} />
            <span>Tour</span>
          </button>
          <button
            className="button reference-button"
            aria-label="Reference notes"
            onClick={() => setNotes(true)}
          >
            <BookOpen size={15} />
            <span>Reference notes</span>
          </button>
        </div>
      </header>
      <div className="mobile-toolbar">
        <button
          className="button"
          onClick={() => setDrawer(drawer === 'assembly' ? null : 'assembly')}
        >
          <Layers3 size={15} />
          Assembly
        </button>
        <span>{lab.parts.length.toLocaleString()} parts</span>
        <button
          className="button"
          onClick={() => setDrawer(drawer === 'inspector' ? null : 'inspector')}
        >
          <PanelRight size={15} />
          Inspector
        </button>
      </div>
      <div className="aircraft-navigation">
        <nav aria-label="Assembly breadcrumb">
          <button onClick={() => lab.showAircraft()}>Aircraft</button>
          {trail
            .filter((p) => p.id !== 'aircraft')
            .slice(-3)
            .map((p) => (
              <span key={p.id}>
                <ChevronRight size={10} />
                <button
                  onClick={() => {
                    lab.select(p.id);
                    lab.viewer?.focus(p.id);
                  }}
                >
                  {p.name}
                </button>
              </span>
            ))}
        </nav>
        {state.engineFocus ? (
          <div className="engine-side-picker">
            {['left', 'right'].map((s) => (
              <button
                key={s}
                aria-pressed={state.engineFocus === s}
                onClick={() => lab.inspectEngine(s)}
              >
                {s === 'left' ? 'L' : 'R'} GE90–115B
              </button>
            ))}
          </div>
        ) : (
          <span>777–300ER / EDUCATIONAL ASSEMBLY</span>
        )}
      </div>
      <div className="workspace">
        {drawer ? (
          <button
            className="drawer-scrim"
            aria-label="Close panel"
            onClick={() => setDrawer(null)}
          />
        ) : null}
        <AssemblyTree
          lab={lab}
          selected={state.selected}
          version={state.version}
          onClose={() => setDrawer(null)}
        />
        <Viewport lab={lab} state={state} />
        <Inspector lab={lab} state={state} onClose={() => setDrawer(null)} />
      </div>
      <AircraftControls lab={lab} state={state} />
      <footer className="status-bar">
        <div>
          <i
            className={`status-light ${lab.simulation.on ? 'on' : ''} ${lab.simulation.interlocked ? 'held' : ''}`}
          />
          <span aria-live="polite">
            {state.armed
              ? 'Preparing inspection'
              : lab.simulation.interlocked
                ? 'Maintenance hold'
                : state.gearPhase && state.gearPhase !== 'Gear down'
                  ? state.gearPhase
                  : state.phase}
          </span>
          {state.reduced ? <span className="motion-note">Reduced motion</span> : null}
        </div>
        <p>
          Drag to orbit <span>·</span> Scroll to zoom <span>·</span> Double-click to isolate
        </p>
        <button
          className="keyboard-help"
          aria-label="Interaction and keyboard help"
          onClick={() => setNotes(true)}
        >
          <CircleHelp size={15} />
        </button>
      </footer>
      {notes ? <AircraftReferences onClose={() => setNotes(false)} /> : null}
    </div>
  );
}
