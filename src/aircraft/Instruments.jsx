import { useEffect, useRef } from 'react';
export function AircraftInstruments({ lab, state }) {
  const refs = useRef([]);
  const side = state.engineFocus;
  useEffect(() => {
    const update = (snapshot) => {
      const e = side ? snapshot.engines[side] : null;
      const values = e
        ? [e.n1.toFixed(1), e.n2.toFixed(1), Math.round(e.thrust), Math.round(e.temperature)]
        : [
            snapshot.engines.left.n1.toFixed(1),
            snapshot.engines.right.n1.toFixed(1),
            Math.round(lab.mechanisms.value('flaps') * 30),
            lab.mechanisms.value('gear') > 0.999
              ? 'UP'
              : lab.mechanisms.value('gear') < 0.001
                ? 'DOWN'
                : 'MOVING',
          ];
      values.forEach((v, i) => {
        if (refs.current[i]) refs.current[i].textContent = v;
      });
    };
    lab.telemetryListeners.add(update);
    update(lab.simulation.snapshot());
    return () => lab.telemetryListeners.delete(update);
  }, [lab, side]);
  const labels = side
    ? ['N1', 'N2', 'THRUST', 'EGT']
    : ['LEFT ENGINE N1', 'RIGHT ENGINE N1', 'FLAPS', 'LANDING GEAR'];
  const units = side ? ['%', '%', 'kN', '°C'] : ['%', '%', '°', ''];
  return (
    <div
      className="instruments aircraft-instruments"
      aria-label="Illustrative aircraft instrumentation"
    >
      <div className="instrument-grid">
        {labels.map((label, i) => (
          <div className="instrument" key={label}>
            <span>{label}</span>
            <div>
              <strong ref={(el) => (refs.current[i] = el)}>
                {i < 2 ? '0.0' : i === 3 && !side ? 'DOWN' : '0'}
              </strong>
              <em>{units[i]}</em>
            </div>
          </div>
        ))}
      </div>
      <p>
        {lab.simulation.interlocked
          ? 'Maintenance hold · operation interlocked'
          : 'Educational simulation · illustrative values'}
      </p>
    </div>
  );
}
