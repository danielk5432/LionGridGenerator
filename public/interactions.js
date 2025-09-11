import { state, addLion, queueMove, cancelMoves } from './state.js';
import { render, svgEl } from './renderer.js';
import { getSvgPoint, getNearestNodeId, $ } from './utils.js';
import { panZoomInstance, getMouseDownPos, setMouseDownPos } from './ui.js';
import { CONFIG } from './config.js';

let dragInfo = null; // { fromNodeId, startX, startY }

function onNodeClick(nodeId, e) {
    let wasDrag;
    const mouseDownPos = getMouseDownPos();

    if (mouseDownPos) {
        const dx = e.clientX - mouseDownPos.x;
        const dy = e.clientY - mouseDownPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > 5) {
            wasDrag = true;
        }
    }

    if (wasDrag) {
        return;
    }

    if (!state.started) {
        addLion(nodeId);
        $('#startBtn').disabled = false;
        $('#resetBtn').disabled = false;
        render();
    }
}

function onNodeMouseDown(nodeId, e) {
    setMouseDownPos({ x: e.clientX, y: e.clientY });

    if (state.started) {
        const lionOnNode = state.lions.some((l) => l.nodeId === nodeId);
        if (!lionOnNode) return;

        const node = state.graph.nodes.find(n => n.id === nodeId);
        if (!node) return;

        const startCoords = getSvgPoint({ x: node.x, y: node.y });
        dragInfo = { fromNodeId: nodeId, startX: startCoords.x, startY: startCoords.y };
        
        if (panZoomInstance) panZoomInstance.disablePan();
        
        document.addEventListener('mousemove', onDragMove);
        document.addEventListener('mouseup', onDragEnd, { once: true });
    }
}

function onDragMove(e) {
	if (!dragInfo) return;
	const svg = $('#graph');
	const arrowId = 'queue-arrow-temp';
	let arrow = document.getElementById(arrowId);
	const { x, y } = getSvgPoint(e);
    const arrowheadPixelLength = CONFIG.arrowHeadLength * CONFIG.arrowStrokeWidth;

    const dx = x - dragInfo.startX;
    const dy = y - dragInfo.startY;
    const length = Math.sqrt(dx * dx + dy * dy);

    let endX = x;
    let endY = y;

    if (length > arrowheadPixelLength) {
        endX = x - (dx / length) * arrowheadPixelLength;
        endY = y - (dy / length) * arrowheadPixelLength;
    } else {
		endX = dragInfo.startX + (dx / length ) * 0.1;
		endY = dragInfo.startY + (dy / length ) * 0.1;
	}

    if (!arrow) {
        arrow = svgEl('line', { id: arrowId, class: 'queue-arrow', x1: dragInfo.startX, y1: dragInfo.startY, x2: endX, y2: endY, 'marker-end': 'url(#queueArrowhead)'});
        svg.appendChild(arrow);
    } else {
        arrow.setAttribute('x2', endX);
        arrow.setAttribute('y2', endY);
    }
}

function onDragEnd(e) {
	document.removeEventListener('mousemove', onDragMove);
	const svg = $('#graph');
	const arrow = document.getElementById('queue-arrow-temp');
	if (arrow) svg.removeChild(arrow);
	if (!dragInfo) return;

    if (panZoomInstance) {
        panZoomInstance.enablePan();
    }

	const from = dragInfo.fromNodeId;
	const { x, y } = getSvgPoint(e);
	const to = getNearestNodeId(x, y);
	const neighbors = state.graph.adjacency.get(from) || new Set();
	if (neighbors.has(to)) {
		const lionsOnNode = state.lions.filter(l => l.nodeId === from);
		const lionWithoutMove = lionsOnNode.find(l => !state.queuedMoves.has(l.id));
		if (lionWithoutMove) {
			queueMove(lionWithoutMove.id, to);
		}
	}
	dragInfo = null;
}

export function initInteractions() {
    const svg = $('#graph');

    svg.addEventListener('click', (e) => {
        const target = e.target;
        const nodeEl = target.closest('.node');
        const arrowEl = target.closest('.queue-arrow.static');
        const countEl = target.closest('.arrow-count');

        if (nodeEl) {
            onNodeClick(nodeEl.dataset.nodeId, e);
            return;
        }

        if (arrowEl || countEl) {
            e.stopPropagation();
            const el = arrowEl || countEl;
            const fromId = el.dataset.from;
            const toId = el.dataset.to;
            cancelMoves(fromId, toId);
            return;
        }
    });

    svg.addEventListener('mousedown', (e) => {
        const nodeEl = e.target.closest('.node');
        if (nodeEl) {
            onNodeMouseDown(nodeEl.dataset.nodeId, e);
        }
    });
}
