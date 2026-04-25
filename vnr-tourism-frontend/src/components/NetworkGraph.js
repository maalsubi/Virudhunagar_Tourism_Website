import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { CATEGORY_COLORS, COMMUNITY_COLORS, TALUK_COLORS } from '../utils/constants';

const COLOR_MODES = {
  community: (n) => COMMUNITY_COLORS[n.community % COMMUNITY_COLORS.length] || '#888',
  category: (n) => CATEGORY_COLORS[n.category] || '#888',
  taluk: (n) => TALUK_COLORS[n.taluk] || '#888',
  pagerank: (n) => d3.interpolateYlOrRd(Math.min(n.pagerank || 0, 1)),
};

export default function NetworkGraph({ nodes, links }) {
  const svgRef = useRef(null);
  const [colorMode, setColorMode] = useState('community');
  const [tooltip, setTooltip] = useState(null);

  useEffect(() => {
    if (!nodes || !links || !svgRef.current) return;
    const el = svgRef.current;
    const W = el.clientWidth || 900;
    const H = 520;

    d3.select(el).selectAll('*').remove();

    const svg = d3
      .select(el)
      .attr('viewBox', `0 0 ${W} ${H}`)
      .attr('preserveAspectRatio', 'xMidYMid meet');

    const g = svg.append('g');

    svg.call(
      d3
        .zoom()
        .scaleExtent([0.3, 3])
        .on('zoom', (e) => g.attr('transform', e.transform))
    );

    const nodeMap = Object.fromEntries(nodes.map((n) => [n.place_id, n]));

    const simLinks = links
      .map((l) => ({
        ...l,
        source: nodeMap[l.source] || l.source,
        target: nodeMap[l.target] || l.target,
      }))
      .filter((l) => l.source && l.target);

    const distMap = { strong: 60, medium: 100, weak: 140 };

    const sim = d3
      .forceSimulation(nodes)
      .force('link', d3.forceLink(simLinks).id((d) => d.place_id).distance((d) => distMap[d.strength] || 100))
      .force('charge', d3.forceManyBody().strength(-120))
      .force('center', d3.forceCenter(W / 2, H / 2))
      .force('collide', d3.forceCollide(14));

    const link = g
      .append('g')
      .selectAll('line')
      .data(simLinks)
      .join('line')
      .attr('stroke', '#30363d')
      .attr('stroke-width', (d) => (d.strength === 'strong' ? 1.5 : d.strength === 'medium' ? 1 : 0.5))
      .attr('stroke-opacity', 0.5);

    const colorFn = COLOR_MODES[colorMode];

    const node = g
      .append('g')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .attr('class', 'graph-node')
      .call(
        d3
          .drag()
          .on('start', (e, d) => {
            if (!e.active) sim.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (e, d) => {
            d.fx = e.x;
            d.fy = e.y;
          })
          .on('end', (e, d) => {
            if (!e.active) sim.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      )
      .on('mouseenter', (e, d) => {
        setTooltip({ x: e.pageX + 10, y: e.pageY + 10, node: d });
      })
      .on('mousemove', (e) => {
        setTooltip((t) => (t ? { ...t, x: e.pageX + 10, y: e.pageY + 10 } : t));
      })
      .on('mouseleave', () => setTooltip(null));

    node
      .append('circle')
      .attr('r', (d) => {
        const base = d.is_isolated ? 7 : 5;
        return base + Math.sqrt(d.degree || 0) * 1.2;
      })
      .attr('fill', colorFn)
      .attr('stroke', (d) => (d.is_isolated ? '#95d5b2' : '#21262d'))
      .attr('stroke-width', (d) => (d.is_isolated ? 2 : 1));

    node
      .append('text')
      .text((d) => (d.name.length > 14 ? `${d.name.slice(0, 13)}…` : d.name))
      .attr('x', 0)
      .attr('y', (d) => 5 + Math.sqrt(d.degree || 0) * 1.2 + 10)
      .attr('text-anchor', 'middle')
      .attr('font-size', '8px')
      .attr('fill', '#8b949e')
      .style('pointer-events', 'none');

    sim.on('tick', () => {
      link
        .attr('x1', (d) => d.source.x)
        .attr('y1', (d) => d.source.y)
        .attr('x2', (d) => d.target.x)
        .attr('y2', (d) => d.target.y);
      node.attr('transform', (d) => `translate(${d.x},${d.y})`);
    });

    return () => sim.stop();
  }, [nodes, links, colorMode]);

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.8rem', color: '#8b949e', alignSelf: 'center' }}>Color by:</span>
        {Object.keys(COLOR_MODES).map((m) => (
          <button
            key={m}
            className={`tab ${colorMode === m ? 'active' : ''}`}
            style={{ padding: '0.3rem 0.75rem', fontSize: '0.78rem' }}
            onClick={() => setColorMode(m)}
          >
            {m.charAt(0).toUpperCase() + m.slice(1)}
          </button>
        ))}
        <span style={{ fontSize: '0.75rem', color: '#8b949e', alignSelf: 'center', marginLeft: 'auto' }}>
          🟢 Isolated gems have green border · Scroll to zoom · Drag to pan
        </span>
      </div>
      <svg ref={svgRef} className="graph-svg" style={{ height: 520 }} />
      {tooltip && (
        <div className="graph-tooltip" style={{ left: tooltip.x, top: tooltip.y, position: 'fixed' }}>
          <div style={{ fontWeight: 700, marginBottom: '0.2rem' }}>{tooltip.node.name}</div>
          <div style={{ color: '#8b949e', fontSize: '0.75rem' }}>
            {tooltip.node.taluk} · {tooltip.node.category}
            <br />
            Degree: {tooltip.node.degree} · PR: {(tooltip.node.pagerank || 0).toFixed(3)}
            <br />
            {tooltip.node.is_isolated && '🌿 Remote gem'}
          </div>
        </div>
      )}
    </div>
  );
}
