import { useState, useSyncExternalStore } from 'react';
import { BookOpen, Layers3, PanelRight, CircleHelp, X } from 'lucide-react';
import { EngineLab } from './engine/lab.js';
import { AssemblyTree } from './components/AssemblyTree.jsx';
import { Inspector } from './components/Inspector.jsx';
import { Viewport } from './components/Viewport.jsx';
import { Controls } from './components/Controls.jsx';
import { ReferenceNotes } from './components/ReferenceNotes.jsx';

export default function App() {
  const [lab] = useState(() => new EngineLab());
  const state = useSyncExternalStore(lab.subscribe, lab.getSnapshot);
  const [notes, setNotes] = useState(false),
    [drawer, setDrawer] = useState(null);
  return (
    <div className={`laboratory ${drawer ? `drawer-${drawer}` : ''}`}>
      <header className="app-header">
        <a className="wordmark" href="./" aria-label="Anatomy Engine Laboratory">
          <img src="/favicon.svg" width="28" height="28" alt="" />
          <strong>ANATOMY</strong>
        </a>
        <span className="header-divider" />
        <span className="lab-name">Engine laboratory</span>
        <span className="header-engine">GE90–115B</span>
        <div className="header-right">
          <span>Boeing 777–300ER</span>
          <button className="button reference-button" onClick={() => setNotes(true)}>
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
      <Controls lab={lab} state={state} />
      <footer className="status-bar">
        <div>
          <i
            className={`status-light ${lab.simulation.on ? 'on' : ''} ${lab.simulation.interlocked ? 'held' : ''}`}
          />
          <span aria-live="polite">{state.phase}</span>
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
      {notes ? <ReferenceNotes onClose={() => setNotes(false)} /> : null}
    </div>
  );
}
