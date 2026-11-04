import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Play, Square, RotateCcw, Plane, SlidersHorizontal, ChevronUp } from 'lucide-react';
function Toggle({ label, on, onClick }) {
  return (
    <button className={`toggle-control ${on ? 'enabled' : ''}`} aria-pressed={on} onClick={onClick}>
      <span>{label}</span>
      <span className="switch" aria-hidden="true">
        <i />
      </span>
    </button>
  );
}
export function AircraftControls({ lab, state, drawerOpen = false }) {
  const channels = lab.mechanisms.channels;
  const [expanded, setExpanded] = useState(false);
  const moreRef = useRef(null);
  useEffect(() => {
    if (drawerOpen) {
      setExpanded(false);
      if (moreRef.current) moreRef.current.open = false;
    }
  }, [drawerOpen]);
  const [phone, setPhone] = useState(() => matchMedia('(max-width: 760px)').matches);
  const [moreOpen, setMoreOpen] = useState(false);
  useEffect(() => {
    const media = matchMedia('(max-width: 760px)');
    const update = () => setPhone(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  const mechanismPanel = (
    <div className={`mechanism-popover ${phone ? 'aircraft-mechanism-portal' : ''}`}>
      <div className="mechanism-sheet-heading">
        <h3>Aircraft mechanisms</h3>
        <button
          className="button"
          aria-label="Close mechanisms"
          onClick={() => {
            moreRef.current.open = false;
            moreRef.current.querySelector('summary').focus();
          }}
        >
          Done
        </button>
      </div>
      <p>Operating demonstrations use one shared state.</p>
      <label>
        <span>Demonstration speed</span>
        <select
          aria-label="Demonstration speed"
          value={state.speed}
          onChange={(e) => lab.setSpeed(Number(e.target.value))}
        >
          <option value="0.25">¼×</option>
          <option value="0.5">½×</option>
          <option value="1">1×</option>
          <option value="2">2×</option>
        </select>
      </label>
      {[
        ['spoilers', 'Spoilers'],
        ['roll', 'Roll control'],
        ['pitch', 'Elevators'],
        ['rudder', 'Rudder'],
        ['bins', 'Overhead bins'],
      ].map(([key, label]) => (
        <label key={key}>
          <span>{label}</span>
          <input
            aria-label={label}
            type="range"
            min={['roll', 'pitch', 'rudder'].includes(key) ? '-100' : '0'}
            max="100"
            value={Math.round(channels[key].target * 100)}
            onChange={(e) => lab.setMechanism(key, Number(e.target.value) / 100)}
          />
        </label>
      ))}
      <Toggle
        label="Cargo doors"
        on={channels.cargo.target > 0}
        onClick={() => lab.setMechanism('cargo', channels.cargo.target > 0 ? 0 : 1)}
      />
      <Toggle
        label="Maintenance supports"
        on={channels.supports.target > 0}
        onClick={() => lab.setMechanism('supports', channels.supports.target > 0 ? 0 : 1)}
      />
      <Toggle label="Engine airflow" on={state.airflow} onClick={() => lab.toggleAirflow()} />
      <button className="button" onClick={() => lab.park()}>
        Park aircraft
      </button>
    </div>
  );
  return (
    <div
      className="controls-bar aircraft-controls"
      data-expanded={expanded}
      aria-label="Aircraft controls"
    >
      <div className="engine-command-pair">
        {['left', 'right'].map((side) => {
          const e = lab.simulation.engines[side];
          return (
            <div className="engine-command" key={side}>
              <button
                className={`button ${e.on ? 'active' : ''}`}
                aria-label={`${e.on ? 'Stop' : 'Start'} ${side} engine`}
                onClick={() => lab.toggleEngine(side)}
              >
                {e.on ? (
                  <Square size={11} fill="currentColor" />
                ) : (
                  <Play size={11} fill="currentColor" />
                )}
                {side === 'left' ? 'L' : 'R'}
                <span>{e.on ? 'Stop' : 'Start'}</span>
              </button>
              <input
                type="range"
                aria-label={`${side} engine throttle`}
                min="0"
                max="100"
                value={Math.round(e.throttle * 100)}
                onChange={(e) => lab.setEngineThrottle(side, Number(e.target.value) / 100)}
              />
              <output>
                {Math.round(e.throttle * 100)}
                <small>%</small>
              </output>
            </div>
          );
        })}
      </div>
      <div className="aircraft-secondary-controls" id="aircraft-secondary-controls">
        <label className="aircraft-flaps">
          <span>Flaps</span>
          <input
            aria-label="Flap setting"
            type="range"
            min="0"
            max="30"
            step="1"
            value={Math.round(channels.flaps.target * 30)}
            onChange={(e) => lab.setMechanism('flaps', Number(e.target.value) / 30)}
          />
          <output>{Math.round(channels.flaps.target * 30)}°</output>
        </label>
        <button
          className="button"
          aria-label={lab.mechanisms.gearRequested ? 'Extend landing gear' : 'Retract landing gear'}
          onClick={() => lab.setMechanism('gear', !lab.mechanisms.gearRequested)}
        >
          <Plane size={14} />
          <span>Gear {lab.mechanisms.gearRequested ? 'up' : 'down'}</span>
        </button>
        <Toggle
          label="Doors"
          on={channels.doors.target > 0}
          onClick={() => lab.setMechanism('doors', channels.doors.target > 0 ? 0 : 1)}
        />

        <Toggle
          label="Lighting"
          on={channels.lights.target > 0}
          onClick={() => lab.setMechanism('lights', channels.lights.target > 0 ? 0 : 0.8)}
        />
        <details
          className="aircraft-more-controls"
          ref={moreRef}
          onToggle={(e) => setMoreOpen(e.currentTarget.open)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') e.currentTarget.open = false;
          }}
        >
          <summary className="button">
            <SlidersHorizontal size={14} />
            <span>Mechanisms</span>
            <ChevronUp size={12} />
          </summary>
          {phone ? (moreOpen ? createPortal(mechanismPanel, document.body) : null) : mechanismPanel}
        </details>
        <div className="aircraft-reset">
          <button
            className="button"
            aria-label="Reassemble aircraft"
            onClick={() => lab.reassemble()}
          >
            <RotateCcw size={14} />
            <span>Reassemble</span>
          </button>
          <button
            className="icon-button"
            aria-label="Reset view"
            onClick={() => lab.viewer?.setView(state.engineFocus ? 'Orbit' : 'Exterior')}
          >
            <RotateCcw size={15} />
          </button>
        </div>
      </div>
      <div className="aircraft-quick-controls">
        <Toggle label="Sectional" on={state.cutaway} onClick={() => lab.toggleCutaway()} />
        <button
          className="button mobile-controls-toggle"
          aria-expanded={expanded}
          aria-controls="aircraft-secondary-controls"
          onClick={() => {
            if (expanded && moreRef.current) moreRef.current.open = false;
            setExpanded(!expanded);
          }}
        >
          <SlidersHorizontal size={16} />
          <span>{expanded ? 'Fewer controls' : 'More controls'}</span>
          <ChevronUp size={14} />
        </button>
      </div>
    </div>
  );
}
