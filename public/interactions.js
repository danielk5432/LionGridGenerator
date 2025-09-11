import { state, addLion, queueMove, cancelMoves } from './state.js';
import { render, svgEl } from './renderer.js';
import { getSvgPoint, getNearestNodeId, $ } from './utils.js';
import { panZoomInstance } from './ui.js';
import { CONFIG } from './config.js';

// This object holds all information about an ongoing interaction (click or drag)
let interactionInfo = null;

/**
 * Handles the start of an interaction (mousedown or touchstart).
 */
function onInteractionStart(e) {
    // If it's a multi-touch gesture, let the pan/zoom library handle it.
    if (e.touches && e.touches.length > 1) {
        interactionInfo = null; // Cancel any ongoing interaction
        return;
    }

    const nodeEl = e.target.closest('.node');
    const isNodeInteraction = !!nodeEl;

    // Get correct event coordinates based on event type (mouse vs. touch)
    const point = e.touches ? e.touches[0] : e;

    interactionInfo = {
        isNodeInteraction,
        nodeId: isNodeInteraction ? nodeEl.dataset.nodeId : null,
        startX: point.clientX,
        startY: point.clientY,
        startTime: Date.now(),
        isDrag: false,
    };

    // If interacting with a node, prevent default browser actions like scrolling.
    // This is crucial for a smooth drag-to-move experience on mobile.
    if (isNodeInteraction) {
        e.preventDefault();
    }

    // Add move and end listeners
    document.addEventListener('mousemove', onInteractionMove);
    document.addEventListener('touchmove', onInteractionMove, { passive: false });
    document.addEventListener('mouseup', onInteractionEnd);
    document.addEventListener('touchend', onInteractionEnd);
}

/**
 * Handles movement during an interaction (mousemove or touchmove).
 */
function onInteractionMove(e) {
    if (!interactionInfo) return;

    const point = e.touches ? e.touches[0] : e;
    const dx = point.clientX - interactionInfo.startX;
    const dy = point.clientY - interactionInfo.startY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // If moved more than a threshold, it's a drag.
    if (distance > 5) {
        interactionInfo.isDrag = true;
    }

    // If it's a drag that started on a node during the simulation, draw the arrow.
    if (interactionInfo.isDrag && interactionInfo.isNodeInteraction && state.started) {
        // Prevent pan while dragging to create a move arrow
        if (panZoomInstance) panZoomInstance.disablePan();
        e.preventDefault();
        drawTemporaryArrow(e);
    }
}

/**
 * Handles the end of an interaction (mouseup or touchend).
 */
function onInteractionEnd(e) {
    // Clean up listeners immediately
    document.removeEventListener('mousemove', onInteractionMove);
    document.removeEventListener('touchmove', onInteractionMove);
    document.removeEventListener('mouseup', onInteractionEnd);
    document.removeEventListener('touchend', onInteractionEnd);

    if (!interactionInfo) return;

    const wasDrag = interactionInfo.isDrag;
    const wasNodeInteraction = interactionInfo.isNodeInteraction;

    // Cleanup UI (arrow, re-enable pan)
    removeTemporaryArrow();
    if (panZoomInstance) panZoomInstance.enablePan();

    if (wasNodeInteraction) {
        if (wasDrag) {
            // Drag ended on a node: try to queue a move
            if (state.started) {
                const endPoint = e.changedTouches ? e.changedTouches[0] : e;
                handleMoveQueue(interactionInfo.nodeId, endPoint);
            }
        } else {
            // It was a tap on a node: try to place a lion
            if (!state.started) {
                addLion(interactionInfo.nodeId);
                $('#startBtn').disabled = false;
                $('#resetBtn').disabled = false;
                render();
            }
        }
    } else {
        // It was a click/drag on the canvas, check for cancelling a move
        const arrowEl = e.target.closest('.queue-arrow.static, .arrow-count');
        if (arrowEl) {
            e.stopPropagation();
            cancelMoves(arrowEl.dataset.from, arrowEl.dataset.to);
        }
    }

    // Reset interaction state
    interactionInfo = null;
}

/**
 * Draws the temporary arrow while dragging to queue a move.
 */
function drawTemporaryArrow(endPoint) {
    if (!interactionInfo) return;

    const svg = $('#graph');
	const arrowId = 'queue-arrow-temp';
    let arrow = document.getElementById(arrowId);
    
    const node = state.graph.nodes.find(n => n.id === interactionInfo.nodeId);
    if (!node) return;

    const startCoords = getSvgPoint({ x: node.x, y: node.y });
	const { x, y } = getSvgPoint(endPoint);
    const arrowheadPixelLength = CONFIG.arrowHeadLength * CONFIG.arrowStrokeWidth;

    const dx = x - startCoords.x;
    const dy = y - startCoords.y;
    const length = Math.sqrt(dx * dx + dy * dy);

    let endX = x;
    let endY = y;

    if (length > arrowheadPixelLength) {
        endX = x - (dx / length) * arrowheadPixelLength;
        endY = y - (dy / length) * arrowheadPixelLength;
    } else if (length > 0) {
		endX = startCoords.x + (dx / length ) * 0.1;
		endY = startCoords.y + (dy / length ) * 0.1;
	}

    if (!arrow) {
        arrow = svgEl('line', { id: arrowId, class: 'queue-arrow', x1: startCoords.x, y1: startCoords.y, x2: endX, y2: endY, 'marker-end': 'url(#queueArrowhead)'});
        svg.appendChild(arrow);
    } else {
        arrow.setAttribute('x2', endX);
        arrow.setAttribute('y2', endY);
    }
}

function removeTemporaryArrow() {
    const arrow = document.getElementById('queue-arrow-temp');
	if (arrow) arrow.remove();
}

/**
 * Handles the logic for queuing a move after a drag ends.
 */
function handleMoveQueue(fromNodeId, endPoint) {
    const { x, y } = getSvgPoint(endPoint);
	const toNodeId = getNearestNodeId(x, y);
	const neighbors = state.graph.adjacency.get(fromNodeId) || new Set();

	if (neighbors.has(toNodeId)) {
		const lionsOnNode = state.lions.filter(l => l.nodeId === fromNodeId);
		const lionWithoutMove = lionsOnNode.find(l => !state.queuedMoves.has(l.id));
		if (lionWithoutMove) {
			queueMove(lionWithoutMove.id, toNodeId);
		}
	}
}

/**
 * Initializes all interaction event listeners.
 */
export function initInteractions() {
    const svg = $('#graph');
    // Use passive: false for touchstart to allow preventDefault()
    svg.addEventListener('mousedown', onInteractionStart);
    svg.addEventListener('touchstart', onInteractionStart, { passive: false });
}