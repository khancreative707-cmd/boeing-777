import {
  ArrowUpRight,
  ArrowDownToLine,
  Scan,
  RotateCcw,
  RotateCw,
  X,
  Link2,
  ChevronRight,
} from 'lucide-react';
import { PartPreview } from './PartPreview.jsx';
import { GuidedTour } from './GuidedTour.jsx';
export function Inspector({ lab, state, onClose, modal = false }) {
  const p = lab.registry.get(state.selected),
    parent = lab.registry.get(p?.parent);
  if (!p) return null;
  const blocked = lab.assembly.blockedBy(p.id);
  const detachedAncestor = lab.assembly.hasDetachedAncestor(p.id);
  const status = state.exploded
    ? 'Exploded'
    : p.amount > 0 && p.amount < 0.999
      ? p.target
        ? 'Detaching'
        : 'Reattaching'
      : p.detached
        ? 'Detached'
        : detachedAncestor
          ? 'With detached assembly'
          : 'Attached';
  const spool = p.spool || lab.registry.ancestors(p.id).find((a) => a.spool)?.spool;
  const isRoot = p.kind === 'root';
  return (
    <aside
      className="inspector-panel"
      aria-label="Component inspector"
      role={modal ? 'dialog' : undefined}
      aria-modal={modal || undefined}
      tabIndex={modal ? -1 : undefined}
    >
      <div className="inspector-eyebrow">
        <span>COMPONENT INSPECTOR</span>
        <button className="icon-button drawer-close" aria-label="Close inspector" onClick={onClose}>
          <X size={18} />
        </button>
        <button
          className="icon-button desktop-only"
          title="Focus selected component"
          aria-label="Focus selected component"
          onClick={() => lab.viewer?.focus(p.id)}
        >
          <ArrowUpRight size={16} />
        </button>
      </div>
      <div className="inspector-scroll">
        <GuidedTour lab={lab} step={state.tourStep} />
        <div className="part-illustration">
          <PartPreview lab={lab} id={p.id} />
          <span>
            {p.kind === 'assembly' ? 'ASSEMBLY' : p.kind === 'blade' ? 'AIRFOIL' : 'COMPONENT'} /{' '}
            {p.id.split('.').at(-1).toUpperCase()}
          </span>
        </div>
        <h2>{p.name}</h2>
        <p className="part-id">{p.id.toUpperCase()}</p>
        <p className="purpose">{p.purpose}</p>
        {lab.kind === 'aircraft' && p.operation ? (
          <button className="button operate-part" onClick={() => lab.operatePart(p.id)}>
            Operate component · {p.operation.replace(':', ' ')}
          </button>
        ) : null}
        {lab.kind === 'aircraft' && p.id.startsWith('aircraft.engines.') && !state.engineFocus ? (
          <button
            className="button operate-part"
            onClick={() => lab.inspectEngine(p.id.includes('.left') ? 'left' : 'right', p.id)}
          >
            Enter engine inspection
          </button>
        ) : null}
        <dl className="properties">
          <div>
            <dt>Material</dt>
            <dd>{p.material}</dd>
          </div>
          <div>
            <dt>Parent</dt>
            <dd>
              <button onClick={() => parent && lab.select(parent.id)} disabled={!parent}>
                {parent?.name || (lab.kind === 'aircraft' ? 'Aircraft root' : 'Engine root')}
                {parent ? <ChevronRight size={11} /> : null}
              </button>
            </dd>
          </div>
          <div>
            <dt>{lab.kind === 'aircraft' && !p.engineSide ? 'Layer' : 'Spool'}</dt>
            <dd>
              {lab.kind === 'aircraft' && !p.engineSide
                ? p.layer || lab.registry.ancestors(p.id).find((a) => a.layer)?.layer || 'Exterior'
                : spool
                  ? `${spool === 'LP' ? 'Low' : 'High'} pressure`
                  : 'Stationary'}
            </dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd className={p.detached ? 'accent' : ''}>{status}</dd>
          </div>
        </dl>
        <div className="inspector-actions">
          <button
            className="button detach"
            disabled={isRoot}
            onClick={() => (p.detached || p.target ? lab.reattach() : lab.detach())}
          >
            {p.detached || p.target ? <Link2 size={15} /> : <ArrowUpRight size={15} />}{' '}
            {p.detached || p.target ? 'Reattach component' : 'Detach component'}
          </button>
          <div className="action-pair">
            <button
              className={`button ${state.isolated ? 'active' : ''}`}
              aria-pressed={!!state.isolated}
              onClick={() => lab.isolate()}
            >
              <Scan size={14} />
              {state.isolated
                ? lab.kind === 'aircraft'
                  ? 'Show aircraft'
                  : 'Show engine'
                : 'Isolate'}
            </button>
            <button className="button" onClick={() => lab.viewer?.focus(p.id)}>
              <ArrowDownToLine size={14} />
              Focus
            </button>
          </div>
        </div>
        {p.detached ? (
          <div className="inspect-rotation">
            <h3>INSPECT DETACHED PART</h3>
            <p>Rotate independently of the {lab.kind === 'aircraft' ? 'aircraft' : 'engine'}.</p>
            <div>
              {['x', 'y', 'z'].map((axis) => (
                <div className="rotation-axis" key={axis}>
                  <span>{axis.toUpperCase()}</span>
                  <button
                    aria-label={`Rotate ${axis} backward`}
                    onClick={() => lab.rotate(axis, -Math.PI / 8)}
                  >
                    <RotateCcw size={14} />
                  </button>
                  <button
                    aria-label={`Rotate ${axis} forward`}
                    onClick={() => lab.rotate(axis, Math.PI / 8)}
                  >
                    <RotateCw size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        <section className="mechanism-note">
          <h3>MECHANICAL RELATIONSHIP</h3>
          <p>{p.relationship}</p>
        </section>
        <section className="mechanism-note">
          <h3>REMOVAL NOTE</h3>
          {!isRoot && blocked.length ? (
            <>
              <p>
                Remove {blocked.map((id) => lab.registry.get(id)?.name || id).join(', ')} first.
              </p>
              {blocked
                .filter((id) => lab.registry.get(id))
                .slice(0, 2)
                .map((id) => (
                  <button key={id} className="text-link" onClick={() => lab.select(id)}>
                    Select {lab.registry.get(id).name}
                    <ArrowUpRight size={12} />
                  </button>
                ))}
            </>
          ) : (
            <p>
              {isRoot
                ? 'Select an assembly or individual component in the hierarchy.'
                : 'Removal paths are educational. Operating motion pauses while required components are away from their mounts.'}
            </p>
          )}
        </section>
        <p className="inspector-disclaimer">Educational geometry · not maintenance instructions</p>
      </div>
    </aside>
  );
}
