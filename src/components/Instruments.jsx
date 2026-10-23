import { useEffect, useRef } from 'react';
export function Instruments({ lab, interlocked }) {
  const n1 = useRef(null),
    n2 = useRef(null),
    thrust = useRef(null),
    temperature = useRef(null);
  useEffect(() => {
    const update = (s) => {
      if (n1.current) n1.current.textContent = s.n1.toFixed(1);
      if (n2.current) n2.current.textContent = s.n2.toFixed(1);
      if (thrust.current) thrust.current.textContent = Math.round(s.thrust);
      if (temperature.current) temperature.current.textContent = Math.round(s.temperature);
    };
    update(lab.simulation.snapshot());
    lab.telemetryListeners.add(update);
    return () => lab.telemetryListeners.delete(update);
  }, [lab]);
  return (
    <div className="instruments" aria-label="Illustrative engine instrumentation">
      <div className="instrument-grid">
        {[
          ['N1', n1, '0.0', '%'],
          ['N2', n2, '0.0', '%'],
          ['THRUST', thrust, '0', 'kN'],
          ['EGT', temperature, '20', '°C'],
        ].map(([label, ref, initial, unit]) => (
          <div className="instrument" key={label}>
            <span>{label}</span>
            <div>
              <strong ref={ref}>{initial}</strong>
              <em>{unit}</em>
            </div>
          </div>
        ))}
      </div>
      <p>
        {interlocked
          ? 'Maintenance hold · spool readings frozen'
          : 'Educational simulation · illustrative values'}
      </p>
    </div>
  );
}
