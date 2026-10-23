import { useEffect, useRef } from 'react';
import { X, ExternalLink } from 'lucide-react';
export function ReferenceNotes({ onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="reference-dialog"
      aria-labelledby="reference-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) ref.current.close();
      }}
    >
      <div className="dialog-header">
        <div>
          <p>ENGINEERING REFERENCE</p>
          <h2 id="reference-title">Architecture, honestly represented.</h2>
        </div>
        <button
          className="icon-button"
          aria-label="Close reference notes"
          onClick={() => ref.current.close()}
        >
          <X size={20} />
        </button>
      </div>
      <p>
        This exhibit models the GE90–115B architecture used on the Boeing 777–300ER. It is an
        interactive educational assembly, not a manufacturing model, flight simulator or maintenance
        reference.
      </p>
      <div className="reference-counts">
        {[
          ['22', 'Fan blades'],
          ['128″', 'Fan diameter'],
          ['4', 'Booster stages'],
          ['9', 'HPC stages'],
          ['2', 'HPT stages'],
          ['6', 'LPT stages'],
        ].map(([value, label]) => (
          <div key={label}>
            <strong>{value}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <h3>Two spools. Separate jobs.</h3>
      <p>
        The LP spool connects the fan, four-stage booster and six-stage LP turbine. The HP spool
        connects the nine-stage compressor and two-stage HP turbine. Stator rows and the annular
        combustor remain stationary.
      </p>
      <h3>What is approximated</h3>
      <p>
        Internal dimensions, chord and twist distributions, all non-fan blade/vane counts, bearings,
        fasteners, variable-stator schedule, fuel-nozzle arrangement, auxiliary routing and removal
        paths are mechanically motivated educational geometry. The fan has 22 blades and a 128-inch
        diameter as specified in the project reference. GE Aerospace's public GE90 table
        independently confirms the 1/4/9 compression-stage architecture and 6/2 LP/HP turbine-stage
        counts.
      </p>
      <p>
        N1, N2, thrust and exhaust temperature are illustrative. Angular motion is slowed for
        inspection. Starting and stopping are accelerated demonstrations. Any missing required part
        freezes the operating model and disables airflow. Reassembly requires an explicit restart.
      </p>
      <h3>Public GE Aerospace references</h3>
      <a
        href="https://www.geaerospace.com/commercial/aircraft-engines/ge90"
        target="_blank"
        rel="noreferrer"
      >
        GE Aerospace · GE90 engine family <ExternalLink size={13} />
      </a>
      <p className="reference-access">
        GE's GE90 engine-family page and its GE90–115B engine photograph were consulted. The table's
        135-inch maximum engine diameter is a different measurement from the 128-inch fan diameter.
        Unpublished internal geometry remains approximate.
      </p>
      <h3>Controls</h3>
      <p>
        Drag to orbit · right-drag or Shift-drag to pan · scroll or pinch to zoom · click to select
        · double-click to isolate. In the focused viewport: F focuses, D detaches, A reattaches,
        Space starts/stops, Home resets, Escape clears isolation. Arrow keys orbit/zoom; with a
        detached selection, they rotate that part.
      </p>
    </dialog>
  );
}
