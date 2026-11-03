import { useEffect, useRef } from 'react';
import { X, ExternalLink } from 'lucide-react';
import { AIRCRAFT } from './spec.js';
export function AircraftReferences({ onClose }) {
  const ref = useRef(null);
  useEffect(() => ref.current.showModal(), []);
  return (
    <dialog
      ref={ref}
      className="reference-dialog"
      onClose={onClose}
      aria-labelledby="aircraft-reference-title"
      onClick={(e) => {
        if (e.target === ref.current) ref.current.close();
      }}
    >
      <div className="dialog-header">
        <div>
          <p>AIRCRAFT ENGINEERING EXHIBIT</p>
          <h2 id="aircraft-reference-title">A whole aircraft. Explained in parts.</h2>
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
        This is an educational representation of the Boeing 777–300ER, with two GE90–115B engines.
        It is not a flight simulator, certified maintenance reference, or manufacturing model.
      </p>
      <div className="reference-counts">
        {[
          [AIRCRAFT.length + ' m', 'Length'],
          [AIRCRAFT.span + ' m', 'Span'],
          [AIRCRAFT.height + ' m', 'Height'],
          ['2 × GE90', 'Engines'],
          ['12 + 2', 'Wheels'],
          ['10', 'Passenger doors'],
        ].map(([n, l]) => (
          <div key={l}>
            <strong>{n}</strong>
            <span>{l}</span>
          </div>
        ))}
      </div>
      <h3>What is dimensionally referenced</h3>
      <p>
        The overall aircraft envelope uses public 777–300ER reference dimensions. Internal profiles,
        structural sections, cabin layout, system routing, fittings and removal paths are
        educational approximations. The representative two-class cabin is not an airline
        configuration.
      </p>
      <h3>Real interactions, educational operation</h3>
      <p>
        Click to select, double-click to isolate. F focuses, D detaches and A reattaches. Escape
        returns to the aircraft. Every modeled physical component retains an ID and its original
        mount. Remove blocking covers first. Park mechanisms before disassembly; engage supports
        before removing load-bearing assemblies.
      </p>
      <p>
        Both engines have independent LP and HP spool models. Removing a required part interlocks
        operation. Gear doors open before the legs move; support jacks engage before retraction.
        Cockpit engine displays use the same illustrative state. Unimplemented cockpit instruments
        are passive geometry.
      </p>
      <h3>Layer views and engine inspection</h3>
      <p>
        Sectional view removes near-side shell and upper-wing sections. Layer switches control skin,
        structure, interiors and systems. Engine lab isolates the mounted engine without changing
        its simulated state. Focused assembly spread affects only the isolated assembly.
      </p>
      <h3>References and source access</h3>
      <a
        href="https://www.boeing.com/commercial/airports/plan-manuals"
        target="_blank"
        rel="noreferrer"
      >
        Boeing · Aircraft characteristics for airport planning <ExternalLink size={13} />
      </a>
      <a
        href="https://www.geaerospace.com/commercial/aircraft-engines/ge90"
        target="_blank"
        rel="noreferrer"
      >
        GE Aerospace · GE90 engine family <ExternalLink size={13} />
      </a>
      <p className="reference-access">
        The Boeing reference destination was blocked by this cloud environment during construction.
        The published envelope values are recorded as reference targets; the internal geometry does
        not claim access to Boeing CAD or proprietary drawings. GE engine-family references were
        consulted during engine development.
      </p>
      <a href="?view=engine">
        Open standalone GE90 laboratory <ExternalLink size={13} />
      </a>
    </dialog>
  );
}
