import { memo, useDeferredValue, useMemo, useState } from 'react';
import { ChevronRight, ChevronDown, Eye, EyeOff, Search, Box, Layers3, X } from 'lucide-react';

export const AssemblyTree = memo(function AssemblyTree({ lab, selected, version, onClose }) {
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query);
  const treeRoot = lab.state.inspectionRoot || lab.rootId || 'ge90';
  const [expanded, setExpanded] = useState(
    () => new Set(['ge90', 'fan', 'aircraft', 'aircraft.wings', 'aircraft.engines']),
  );
  const nodes = useMemo(() => new Map(lab.parts.map((p) => [p.id, p])), [lab.parts]);
  const rows = useMemo(() => {
    if (deferred.trim()) {
      const tokens = deferred.toLowerCase().split(/\s+/);
      return lab.parts
        .filter((p) =>
          tokens.every((t) => `${p.name} ${p.id} ${p.material}`.toLowerCase().includes(t)),
        )
        .map((p) => ({ part: p, depth: 1 }));
    }
    const out = [];
    function walk(id, depth) {
      const p = nodes.get(id);
      if (!p) return;
      out.push({ part: p, depth });
      if (expanded.has(id) || id === treeRoot)
        p.children.forEach((child) => walk(child, depth + 1));
    }
    walk(treeRoot, 0);
    return out;
  }, [nodes, expanded, deferred, lab.parts, treeRoot]);
  function toggle(id) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  const keyDown = (event, index) => {
    const { part } = rows[index];
    if (event.key === 'ArrowRight' && part.children.length) {
      event.preventDefault();
      setExpanded((p) => new Set([...p, part.id]));
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      if (expanded.has(part.id)) toggle(part.id);
      else if (part.parent) lab.select(part.parent);
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const next = Math.min(
        rows.length - 1,
        Math.max(0, index + (event.key === 'ArrowDown' ? 1 : -1)),
      );
      document.getElementById(`tree-${rows[next].part.id}`)?.focus();
      lab.select(rows[next].part.id);
    }
  };
  return (
    <aside className="assembly-panel" aria-label="Component assembly hierarchy">
      <div className="panel-heading">
        <div>
          <h2>Assembly</h2>
          <p>{lab.parts.length.toLocaleString()} components</p>
        </div>
        <button className="icon-button drawer-close" onClick={onClose} aria-label="Close assembly">
          <X size={18} />
        </button>
        <Layers3 className="desktop-only muted" size={18} />
      </div>
      <label className="search-field">
        <Search size={16} />
        <input
          aria-label="Find a component"
          placeholder="Find a component…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query ? (
          <button aria-label="Clear search" onClick={() => setQuery('')}>
            <X size={14} />
          </button>
        ) : null}
      </label>
      <div className="tree-meta">
        <span>
          {query
            ? 'SEARCH RESULTS'
            : lab.kind === 'aircraft'
              ? 'AIRCRAFT HIERARCHY'
              : 'ENGINE HIERARCHY'}
        </span>
        <span>{query ? rows.length : '01'}</span>
      </div>
      {lab.kind === 'aircraft' ? (
        <div className="aircraft-layerbar" aria-label="Aircraft layers">
          {[
            ['skin', 'Skin'],
            ['structure', 'Structure'],
            ['interior', 'Interior'],
            ['systems', 'Systems'],
          ].map(([key, label]) => (
            <button
              key={key}
              aria-pressed={lab.state.layers[key]}
              onClick={() => lab.setLayer(key, !lab.state.layers[key])}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
      <div
        className="tree-scroll"
        role="tree"
        aria-label={lab.kind === 'aircraft' ? 'Aircraft components' : 'Engine components'}
      >
        {rows.length ? (
          rows.map(({ part: p, depth }, index) => (
            <div
              key={p.id}
              className={`tree-row ${selected === p.id ? 'selected' : ''} ${!p.visible ? 'hidden-part' : ''}`}
              role="none"
              style={{ '--depth': Math.min(depth, 5) }}
            >
              <button
                className="tree-disclosure"
                aria-label={`${expanded.has(p.id) ? 'Collapse' : 'Expand'} ${p.name}`}
                onClick={() => toggle(p.id)}
                disabled={!p.children.length || !!query}
                tabIndex={-1}
              >
                {p.children.length ? (
                  expanded.has(p.id) ? (
                    <ChevronDown size={13} />
                  ) : (
                    <ChevronRight size={13} />
                  )
                ) : (
                  <span className="part-dot" />
                )}
              </button>
              <button
                id={`tree-${p.id}`}
                role="treeitem"
                aria-selected={selected === p.id}
                aria-level={depth + 1}
                aria-expanded={p.children.length ? expanded.has(p.id) : undefined}
                className="tree-label"
                title={`${p.name} · ${p.id}`}
                onClick={() => lab.select(p.id)}
                onDoubleClick={() => lab.isolate(p.id)}
                onKeyDown={(e) => keyDown(e, index)}
              >
                {depth === 0 ? <Box size={14} /> : null}
                <span>{p.name}</span>
                {p.detached ? <span className="detached-dot" title="Detached" /> : null}
              </button>
              <button
                className="tree-eye"
                aria-label={`${p.visible ? 'Hide' : 'Show'} ${p.name}`}
                aria-pressed={!p.visible}
                onClick={() => lab.toggleVisibility(p.id)}
              >
                {p.visible ? <Eye size={13} /> : <EyeOff size={13} />}
              </button>
            </div>
          ))
        ) : (
          <div className="empty-search">
            <Search size={24} />
            <p>No matching components.</p>
            <button onClick={() => setQuery('')}>Clear search</button>
          </div>
        )}
      </div>
      <div className="assembly-spread">
        <label htmlFor="assembly-spread">
          <span>Assembly spread</span>
          <output>{Math.round(lab.state.explosion * 100)}%</output>
        </label>
        <input
          id="assembly-spread"
          aria-label="Assembly spread"
          type="range"
          min="0"
          max="100"
          value={Math.round(lab.state.explosion * 100)}
          onChange={(e) => lab.setExplosion(Number(e.target.value) / 100)}
        />
        <div>
          <span>Assembled</span>
          <span>Exploded</span>
        </div>
      </div>
      <div className="assembly-foot">
        <span className="small-orbit" />
        <p>
          {lab.kind === 'aircraft'
            ? 'One aircraft. Connected systems.'
            : 'One engine. Two independent spools.'}
          <br />
          <strong>Explore from the outside in.</strong>
        </p>
      </div>
    </aside>
  );
});
