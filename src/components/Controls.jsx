import { Play, Square, Expand, RotateCcw, Wind, Scissors, SlidersHorizontal } from 'lucide-react';
function Toggle({ label, pressed, onClick, icon: Icon }) {
  return (
    <button
      className={`toggle-control ${pressed ? 'enabled' : ''}`}
      onClick={onClick}
      aria-pressed={pressed}
    >
      {Icon ? <Icon size={14} /> : null}
      <span>{label}</span>
      <span className="switch" aria-hidden="true">
        <i />
      </span>
    </button>
  );
}
export function Controls({ lab, state }) {
  const on = lab.simulation.on;
  return (
    <div className="controls-bar" aria-label="Engine controls">
      <button
        className={`start-button ${on ? 'running' : ''}`}
        onClick={() => lab.toggleRun()}
        title={
          lab.simulation.interlocked
            ? 'Reassemble required components to start the engine'
            : undefined
        }
      >
        {on ? <Square size={14} fill="currentColor" /> : <Play size={15} fill="currentColor" />}
        <span>{on ? 'Stop engine' : 'Start engine'}</span>
      </button>
      <label className="throttle-control">
        <span>Throttle</span>
        <output>
          {Math.round(state.throttle * 100)}
          <small>%</small>
        </output>
        <input
          aria-label="Educational throttle"
          type="range"
          min="0"
          max="100"
          value={Math.round(state.throttle * 100)}
          onChange={(e) => lab.setThrottle(Number(e.target.value) / 100)}
          style={{ '--range-value': `${state.throttle * 100}%` }}
        />
        <span className="slider-max">
          100<small>%</small>
        </span>
      </label>
      <label className="speed-control">
        <span>Speed</span>
        <select
          aria-label="Animation speed"
          value={state.speed}
          onChange={(e) => lab.setSpeed(Number(e.target.value))}
        >
          <option value="0.25">¼×</option>
          <option value="0.5">½×</option>
          <option value="1">1×</option>
          <option value="2">2×</option>
        </select>
      </label>
      <div className="assembly-controls">
        <button
          className={`button ${state.exploded ? 'active' : ''}`}
          onClick={() => lab.explode()}
        >
          <Expand size={14} />
          <span>Explode</span>
        </button>
        <button className="button" onClick={() => lab.reassemble()}>
          <RotateCcw size={14} />
          <span>Reassemble</span>
        </button>
      </div>
      <div className="view-toggles">
        <Toggle
          label="Cutaway"
          pressed={state.cutaway}
          onClick={() => lab.toggleCutaway()}
          icon={Scissors}
        />
        <Toggle
          label="Airflow"
          pressed={state.airflow}
          onClick={() => lab.toggleAirflow()}
          icon={Wind}
        />
      </div>
      <button
        className="button reset-view"
        aria-label="Reset view"
        onClick={() => lab.viewer?.setView('Orbit')}
      >
        <RotateCcw size={15} />
        <span>Reset view</span>
      </button>
    </div>
  );
}
