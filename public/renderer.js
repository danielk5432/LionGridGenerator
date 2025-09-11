import { state } from './state.js';
import { CONFIG } from './config.js';
import { $, svgNS } from './utils.js';

export function svgEl(tag, attrs = {}) {
	const el = document.createElementNS(svgNS, tag);
	for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
	return el;
}

export function render() {
    const svg = $('#graph');
    
    let viewport = svg.querySelector('#viewport');
    if (!viewport) {
        viewport = svgEl('g', { id: 'viewport' });
        svg.appendChild(viewport);
    }

    clearSvg();

    renderDefs(svg);
    renderEdges(viewport);
    renderNodes(viewport);
    renderQueueArrows(viewport);
}


function clearSvg() {
    const svg = $('#graph');
    const viewport = svg.querySelector('#viewport');

    if (viewport) {
        while (viewport.firstChild) {
            viewport.removeChild(viewport.firstChild);
        }
    }

    Array.from(svg.querySelectorAll('.queue-arrow:not(.static)')).forEach(el => el.remove());
}


function renderDefs(svg) {
	const arrowHeadLength = CONFIG.arrowHeadLength;
	const arrowHeadWidth = CONFIG.arrowHeadWidth;
	const defs = svgEl('defs');
	const arrow = svgEl('marker', { id: 'arrowhead', markerWidth: '10', markerHeight: '7', refX: '10', refY: '3.5', orient: 'auto' });
	arrow.appendChild(svgEl('polygon', { points: '0 0, 10 3.5, 0 7', fill: '#cbd5e1' }));
	defs.appendChild(arrow);

	const queueArrow = svgEl('marker', { 
        id: 'queueArrowhead',
        markerUnits: 'strokeWidth',
        markerWidth: arrowHeadLength.toString(),
        markerHeight: arrowHeadWidth.toString(),
        refX: '0',
        refY: (arrowHeadWidth/2).toString(),
        orient: 'auto' 
    });
    queueArrow.appendChild(svgEl('polygon', { points: `0 0, ${arrowHeadLength} ${arrowHeadWidth/2}, 0 ${arrowHeadWidth}`, fill: '#ef4444' }));

	defs.appendChild(queueArrow);

	svg.appendChild(defs);
}

function renderEdges(viewport) {
	for (const e of state.graph.edges) {
		const from = state.graph.nodes.find((n) => n.id === e.from);
		const to = state.graph.nodes.find((n) => n.id === e.to);
		if (!from || !to) continue;
		const line = svgEl('line', { class: 'edge', x1: from.x, y1: from.y, x2: to.x, y2: to.y });
		viewport.appendChild(line);
	}
}

function renderNodes(viewport) {
	const lionNodes = new Map();
	const nodeRadius = CONFIG.nodeRadius;
	for (const l of state.lions) lionNodes.set(l.nodeId, (lionNodes.get(l.nodeId) || 0) + 1);

	for (const node of state.graph.nodes) {
		const g = svgEl('g', { class: 'node', 'data-node-id': node.id });
		g.appendChild(svgEl('circle', { cx: node.x, cy: node.y, r: nodeRadius }));

		const lionsHere = lionNodes.get(node.id) || 0;
		if (lionsHere > 0) {
			const text = svgEl('text', { class: 'emoji', x: node.x, y: node.y + 2.5, 'text-anchor': 'middle' });
				text.textContent = '🦁';
				g.appendChild(text);
			if (lionsHere != 1) {
				const countText = svgEl('text', { 
					class: 'lion-count', 
					x: node.x + 11, 
					y: node.y + 6, 
					'text-anchor': 'middle'
				});
				countText.textContent = `x${lionsHere}`;
				g.appendChild(countText);
			}
		}

		if (state.started && state.contaminated.has(node.id) && lionsHere === 0) {
			const text = svgEl('text', { class: 'emoji', x: node.x, y: node.y + 2, 'text-anchor': 'middle' });
			text.textContent = '🦠';
			g.appendChild(text);
		}

		viewport.appendChild(g);
	}
}


function renderQueueArrows(viewport) {
	const nodeRadius = CONFIG.nodeRadius;

	const moveGroups = new Map();
	for (const lion of state.lions) {
		const target = state.queuedMoves.get(lion.id);
		if (target == null) continue;
		const key = `${lion.nodeId}->${target}`;
		moveGroups.set(key, (moveGroups.get(key) || 0) + 1);
	}
	
	for (const [key, count] of moveGroups) {
		const [fromId, toId] = key.split('->');
		const fromNode = state.graph.nodes.find((n) => n.id === fromId);
		const toNode = state.graph.nodes.find((n) => n.id === toId);
		if (!fromNode || !toNode) continue;
		
		const dx = toNode.x - fromNode.x;
        const dy = toNode.y - fromNode.y;
        const length = Math.sqrt(dx * dx + dy * dy);

        let newX1 = fromNode.x;
        let newY1 = fromNode.y;
        let newX2 = toNode.x;
        let newY2 = toNode.y;

        if (length > 0) {
            newX1 = fromNode.x + (dx / length) * nodeRadius;
            newY1 = fromNode.y + (dy / length) * nodeRadius;
            
			const arrowheadPixelLength = CONFIG.arrowHeadLength * CONFIG.arrowStrokeWidth;
            const totalShortenDist = nodeRadius + arrowheadPixelLength;
            newX2 = toNode.x - (dx / length) * totalShortenDist;
            newY2 = toNode.y - (dy / length) * totalShortenDist;
        }

        const line = svgEl('line', { 
            class: 'queue-arrow static', 
            x1: newX1,
            y1: newY1,
            x2: newX2,
            y2: newY2,
            'marker-end': 'url(#queueArrowhead)',
            'data-from': fromId,
            'data-to': toId
        });
		
		viewport.appendChild(line);
		
		if (count > 1) {
			const midX = (fromNode.x + toNode.x) / 2;
			const midY = (fromNode.y + toNode.y) / 2;

			const offsetDistance = 7;
			const dx = toNode.x - fromNode.x;
			const dy = toNode.y - fromNode.y;
			const length = Math.sqrt(dx * dx + dy * dy);

			let textX = midX;
			let textY = midY;

			if (length > 0) {
				const offsetX = (dy / length) * offsetDistance;
				const offsetY = (-dx / length) * offsetDistance;

				textX = midX + offsetX;
				textY = midY + offsetY;
			}

			const text = svgEl('text', { 
				class: 'arrow-count', 
				x: textX, 
				y: textY, 
				'text-anchor': 'middle',
				'data-from': fromId,
				'data-to': toId
			});
			text.textContent = count.toString();
			viewport.appendChild(text);
		}
	}
}