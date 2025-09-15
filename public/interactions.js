import { state, addLion, queueMove, cancelMoves, drawTempArrow, deleteTempArrow } from './state.js';
import { render, svgEl, calculateArrowGeometry } from './renderer.js';
import { screenToWorld, worldToView, screenToView, getNearestNodeId, $ } from './utils.js';
import { panZoomInstance } from './ui.js';
import { CONFIG } from './config.js';

let interactionInfo = null;

function isDragSourceValid(nodeId) {
    if (!nodeId) return false;
    return true
}

function onInteractionStart(e) {
    const debugOutput = document.getElementById('debug-output');
    if (debugOutput) {
        debugOutput.innerText = `Event: ${e.type}`;
    }

    if (e.touches && e.touches.length > 1) {
        if (debugOutput) debugOutput.innerText += '\nMulti-touch, ignoring.';
        interactionInfo = null;
        return;
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

    if (isNodeInteraction) {
        e.preventDefault();
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
        const arrowEl = e.target.closest('.queue-arrow-hitbox, .arrow-count');
        if (arrowEl) {
            e.stopPropagation();
            cancelMoves(arrowEl.dataset.from, arrowEl.dataset.to);
        }
        const tempArrowEl = e.target.closest('.temp-arrow-hitbox');
        if (tempArrowEl) {
            e.stopPropagation();
            deleteTempArrow(tempArrowEl.dataset.from, tempArrowEl.dataset.to);
        }
        
    }

    interactionInfo = null;
}

function drawTemporaryArrow(endPoint) {
    if (!interactionInfo) return;
    const viewport = $('#graph').querySelector('#viewport');
    if (!viewport) return;

    const tempGroupId = 'queue-arrow-temp-group';
    let arrowGroup = document.getElementById(tempGroupId);
    
    const fromNode = state.graph.nodes.find(n => n.id === interactionInfo.nodeId);
    if (!fromNode) return;

    // 좌표를 모두 world 기준으로 계산
    const startCoords = { x: fromNode.x, y: fromNode.y };
    const endCoords = screenToWorld(endPoint);

    const arrowConfig = {
        nodeRadius: 0, // 임시 화살표는 노드 경계를 고려할 필요 없음
        arrowHeadLength: CONFIG.arrowHeadLength * CONFIG.arrowStrokeWidth,
        arrowHeadWidth: CONFIG.arrowHeadWidth * CONFIG.arrowStrokeWidth
    };

    // 헬퍼 함수로 기하학적 데이터 계산
    const geo = calculateArrowGeometry(startCoords, endCoords, arrowConfig);
    if (!geo) return;

    // 임시 화살표 그룹이 없으면 새로 생성
    if (!arrowGroup) {
        arrowGroup = svgEl('g', { id: tempGroupId, class: 'queue-arrow temp' });
        
        // 그룹 내부에 빈 polygon과 line을 미리 만들어 둡니다.
        const arrowhead = svgEl('polygon', { 'fill': '#ef4444' });
        const line = svgEl('line', { 'vector-effect': 'non-scaling-stroke' });
        
        arrowGroup.appendChild(line);
        arrowGroup.appendChild(arrowhead);
        viewport.appendChild(arrowGroup);
    }
    
    // 그룹 내부의 엘리먼트들을 찾아서 속성 업데이트
    const arrowheadEl = arrowGroup.querySelector('polygon');
    const lineEl = arrowGroup.querySelector('line');

    arrowheadEl.setAttribute('points', geo.polygonPoints);
    
    if (geo.shouldDrawLine) {
        lineEl.setAttribute('x1', geo.lineStart.x);
        lineEl.setAttribute('y1', geo.lineStart.y);
        lineEl.setAttribute('x2', geo.lineEnd.x);
        lineEl.setAttribute('y2', geo.lineEnd.y);
        lineEl.style.display = 'inline';
    } else {
        lineEl.style.display = 'none'; // 거리가 짧으면 선을 숨김
    }
}

function removeTemporaryArrow() {
    const arrowGroup = document.getElementById('queue-arrow-temp-group');
    if (arrowGroup) arrowGroup.remove();
}

function handleMoveQueue(fromNodeId, endPoint) {
    const worldCoords = screenToWorld(endPoint);
	const toNodeId = getNearestNodeId(worldCoords.x, worldCoords.y);
    if (!toNodeId) return;
    let drawn = false;

	const neighbors = state.graph.adjacency.get(fromNodeId) || new Set();
	if (neighbors.has(toNodeId)) {
		const lionsOnNode = state.lions.filter(l => l.nodeId === fromNodeId);
		const lionWithoutMove = lionsOnNode.find(l => !state.queuedMoves.has(l.id));
		if (lionWithoutMove) {
			queueMove(lionWithoutMove.id, toNodeId);
            console.log(`Queued move for Lion ${lionWithoutMove.id} from Node ${fromNodeId} to Node ${toNodeId}`);
            drawn = true;
		}
	}
    
    if (!drawn) {
        drawTempArrow(fromNodeId, toNodeId);
        console.log(`Draw Temp Arrow from Node ${fromNodeId} to Node ${toNodeId}`);
	}
}

export function initInteractions() {
    const svg = $('#graph');
    svg.addEventListener('mousedown', onInteractionStart);
    svg.addEventListener('touchstart', onInteractionStart, { passive: false });
}