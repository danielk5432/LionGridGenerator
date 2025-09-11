import { state, addLion, queueMove, cancelMoves } from './state.js';
import { render, svgEl } from './renderer.js';
import { screenToWorld, worldToView, screenToView, getNearestNodeId, $ } from './utils.js';
import { panZoomInstance } from './ui.js';
import { CONFIG } from './config.js';

let interactionInfo = null;

function isDragSourceValid(nodeId) {
    if (!nodeId) return false;
    return state.lions.some(lion => 
        lion.nodeId === nodeId && !state.queuedMoves.has(lion.id)
    );
}

function onInteractionStart(e) {
    const debugOutput = document.getElementById('debug-output');
    if (debugOutput) {
        debugOutput.innerText = `Event: ${e.type}`;
    }

    if (e.touches && e.touches.length > 1) {
        interactionInfo = null; // Prevent single-touch logic
        if (panZoomInstance) panZoomInstance.enablePan();
        return; // Let panzoom handle it
    }

    const nodeEl = e.target.closest('.node');
    const isNodeInteraction = !!nodeEl;
    const nodeId = isNodeInteraction ? nodeEl.dataset.nodeId : null;
    const canDrag = isNodeInteraction && state.started && isDragSourceValid(nodeId);
    const point = e.touches ? e.touches[0] : e;

    interactionInfo = {
        isNodeInteraction,
        nodeId,
        canDrag,
        startX: point.clientX,
        startY: point.clientY,
        lastX: point.clientX,
        lastY: point.clientY,
        startTime: Date.now(),
        isDrag: false,
    };

    if (isNodeInteraction && state.started) {
        if (panZoomInstance) panZoomInstance.disablePan();
    }

    

    document.addEventListener('mousemove', onInteractionMove);
    document.addEventListener('touchmove', onInteractionMove, { passive: false });
    document.addEventListener('mouseup', onInteractionEnd);
    document.addEventListener('touchend', onInteractionEnd);
}

function onInteractionMove(e) {
    const debugOutput = document.getElementById('debug-output');
    const point = e.touches ? e.touches[0] : e;
    if(!point) return;
    if (debugOutput) {
        debugOutput.innerText = `Event: ${e.type}\n` +
                                `X: ${point.clientX}\n` +
                                `Y: ${point.clientY}`;
    }

    if (!interactionInfo) return;

    interactionInfo.lastX = point.clientX;
    interactionInfo.lastY = point.clientY;

    if (interactionInfo.canDrag) {
        interactionInfo.isDrag = true;
        e.preventDefault();
        drawTemporaryArrow(point);
    } else {
        const dx = point.clientX - interactionInfo.startX;
        const dy = point.clientY - interactionInfo.startY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > 5) {
            interactionInfo.isDrag = true;
        }
    }
}

function onInteractionEnd(e) {
    const debugOutput = document.getElementById('debug-output');
    if (debugOutput) {
        const point = e.changedTouches ? e.changedTouches[0] : e;
        debugOutput.innerText = `Event: ${e.type}\n` +
                                `X: ${point.clientX}\n` +
                                `Y: ${point.clientY}`;
    }
    document.removeEventListener('mousemove', onInteractionMove);
    document.removeEventListener('touchmove', onInteractionMove);
    document.removeEventListener('mouseup', onInteractionEnd);
    document.removeEventListener('touchend', onInteractionEnd);

    if (!interactionInfo) return;


    if (panZoomInstance) panZoomInstance.enablePan();

    const wasDrag = interactionInfo.isDrag;
    const wasNodeInteraction = interactionInfo.isNodeInteraction;

    removeTemporaryArrow();

    if (wasNodeInteraction) {
        if (wasDrag) {
            if (interactionInfo.canDrag) {
                const endPoint = {
                    clientX: interactionInfo.lastX,
                    clientY: interactionInfo.lastY
                };
                handleMoveQueue(interactionInfo.nodeId, endPoint);
            }
        } else {
            if (!state.started) {
                addLion(interactionInfo.nodeId);
                $('#startBtn').disabled = false;
                $('#resetBtn').disabled = false;
                render();
            }
        }
    }
    else {
        const arrowEl = e.target.closest('.queue-arrow.static, .arrow-count');
        if (arrowEl) {
            e.stopPropagation();
            cancelMoves(arrowEl.dataset.from, arrowEl.dataset.to);
        }
    }

    interactionInfo = null;
}

function drawTemporaryArrow(endPoint) {
    if (!interactionInfo) return;
    const svg = $('#graph');
	const arrowId = 'queue-arrow-temp';
    let arrow = document.getElementById(arrowId);
    const node = state.graph.nodes.find(n => n.id === interactionInfo.nodeId);
    if (!node) return;

    const startCoords = worldToView({ x: node.x, y: node.y });
	const endCoords = screenToView(endPoint);
    const dx = endCoords.x - startCoords.x;
    const dy = endCoords.y - startCoords.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    let endX = endCoords.x;
    let endY = endCoords.y;
    const arrowheadPixelLength = CONFIG.arrowHeadLength * CONFIG.arrowStrokeWidth;

    if (length > arrowheadPixelLength) {
        endX = endCoords.x - (dx / length) * arrowheadPixelLength;
        endY = endCoords.y - (dy / length) * arrowheadPixelLength;
    } else if (length > 0) {
		endX = startCoords.x + (dx / length ) * 0.1;
		endY = startCoords.y + (dy / length ) * 0.1;
	}

    if (!arrow) {
        arrow = svgEl('line', { id: arrowId, class: 'queue-arrow', x1: startCoords.x, y1: startCoords.y, x2: endX, y2: endY, 'marker-end': 'url(#queueArrowhead)'});
        svg.appendChild(arrow);
    } else {
        arrow.setAttribute('x1', startCoords.x);
        arrow.setAttribute('y1', startCoords.y);
        arrow.setAttribute('x2', endX);
        arrow.setAttribute('y2', endY);
    }
}

function removeTemporaryArrow() {
    const arrow = document.getElementById('queue-arrow-temp');
	if (arrow) arrow.remove();
}

function handleMoveQueue(fromNodeId, endPoint) {
    const worldCoords = screenToWorld(endPoint);
	const toNodeId = getNearestNodeId(worldCoords.x, worldCoords.y);
    if (!toNodeId) return;

	const neighbors = state.graph.adjacency.get(fromNodeId) || new Set();
	if (neighbors.has(toNodeId)) {
		const lionsOnNode = state.lions.filter(l => l.nodeId === fromNodeId);
		const lionWithoutMove = lionsOnNode.find(l => !state.queuedMoves.has(l.id));
		if (lionWithoutMove) {
			queueMove(lionWithoutMove.id, toNodeId);
		}
	}
}

export function initInteractions() {
    const svg = $('#graph');
    svg.addEventListener('mousedown', onInteractionStart);
    svg.addEventListener('touchstart', onInteractionStart, { passive: false });
}