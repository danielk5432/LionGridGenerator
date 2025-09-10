const state = {
	graph: { nodes: [], edges: [], adjacency: new Map() },
	lions: [], // [{id, nodeId}]
	queuedMoves: new Map(), // lionId -> targetNodeId
	contaminated: new Set(), // nodeId set
	started: false,
	lastLionId: 0,
};

// magic number constants 방지
// 나중에 이걸로 다 바꾸기 (현재 nodeRadius 만 되어 있음)
const CONFIG = {
    nodeRadius: 18,
    nodeStrokeWidth: 2,
    edgeStrokeWidth: 2,
    arrowStrokeWidth: 3,
	arrowHeadLength: 5,
	arrowHeadWidth: 3,
    emojiFontSize: '24px',
    lionCountFontSize: '10px'
};

const $ = (sel) => document.querySelector(sel);
const svgNS = 'http://www.w3.org/2000/svg';

function resetAll() {
	state.lions = [];
	state.queuedMoves.clear();
	state.contaminated.clear();
	state.started = false;
	state.lastLionId = 0;
	$('#moveBtn').disabled = true;
	$('#startBtn').disabled = state.graph.nodes.length === 0;
	$('#resetBtn').disabled = state.graph.nodes.length === 0;
	render();
}

function buildAdjacency(nodes, edges) {
	const adj = new Map();
	nodes.forEach((n) => adj.set(n.id, new Set()));
	edges.forEach((e) => {
		adj.get(e.from).add(e.to);
		adj.get(e.to).add(e.from);
	});
	return adj;
}

function setGraph(g) {
	state.graph.nodes = g.nodes;
	state.graph.edges = g.edges;
	state.graph.adjacency = buildAdjacency(g.nodes, g.edges);
	resetAll();
}

function normalizeGraph(g) {
	const nodes = (g.nodes || []).map((n) => ({ id: String(n.id), x: Number(n.x), y: Number(n.y) }));
	const edges = (g.edges || []).map((e) => ({ from: String(e.from), to: String(e.to) }));
	return { nodes, edges };
}

function handleTextInput() {
	const text = $('#graphInput').value.trim();
	if (!text) {
		alert('그래프 JSON을 입력해주세요.');
		return;
	}
	try {
		let g = JSON.parse(text);
		if (!Array.isArray(g.nodes) || !Array.isArray(g.edges)) throw new Error('Invalid graph JSON');
		g = normalizeGraph(g);
		setGraph(g);
	} catch (err) {
		alert('그래프 JSON 파싱 오류: ' + err.message);
	}
}

function initContamination() {
	state.contaminated.clear();
	const lionNodes = new Set(state.lions.map((l) => l.nodeId));
	for (const node of state.graph.nodes) {
		if (!lionNodes.has(node.id)) state.contaminated.add(node.id);
	}
}

function spreadContaminationFromPositions(contaminationPositions, excludedEdges, lionNodes) {
	// Start with stored contamination positions, but remove lion nodes
	const next = new Set();
	for (const nodeId of contaminationPositions) {
		if (!lionNodes.has(nodeId)) {
			next.add(nodeId);
		}
	}
	
	// Spread from these positions, excluding edges used by lions and lion nodes
	for (const nodeId of contaminationPositions) {
		const neighbors = state.graph.adjacency.get(nodeId) || new Set();
		for (const nb of neighbors) {
			// Don't spread to lion nodes
			if (!lionNodes.has(nb)) {
				// Check if this edge was used by lions
				const edgeKey = `${nodeId}->${nb}`;
				const reverseEdgeKey = `${nb}->${nodeId}`;
				if (!excludedEdges.has(edgeKey) && !excludedEdges.has(reverseEdgeKey)) {
					next.add(nb);
				}
			}
		}
	}
	
	state.contaminated = next;
}

function addLion(nodeId) {
	const id = ++state.lastLionId;
	state.lions.push({ id, nodeId });
	return id;
}

function queueMove(lionId, targetNodeId) {
	state.queuedMoves.set(lionId, targetNodeId);
	$('#moveBtn').disabled = state.queuedMoves.size === 0;
	render();
}

function cancelMoves(fromNodeId, toNodeId) {
	// Find all lions moving from fromNodeId to toNodeId and cancel their moves
	const lionsToCancel = [];
	for (const lion of state.lions) {
		if (lion.nodeId === fromNodeId && state.queuedMoves.get(lion.id) === toNodeId) {
			lionsToCancel.push(lion.id);
		}
	}
	
	// Cancel one move (reduce count by 1)
	if (lionsToCancel.length > 0) {
		const lionToCancel = lionsToCancel[0];
		state.queuedMoves.delete(lionToCancel);
		$('#moveBtn').disabled = state.queuedMoves.size === 0;
		render();
	}
}

function executeMoves() {
	if (state.queuedMoves.size === 0) return;
	
	// 1. Store contamination positions before lion moves
	const contaminationBeforeMove = new Set(state.contaminated);
	
	// 2. Validate moves: target must be adjacent
	const validMoves = [];
	for (const lion of state.lions) {
		const target = state.queuedMoves.get(lion.id);
		if (target == null) continue;
		const neighbors = state.graph.adjacency.get(lion.nodeId) || new Set();
		if (neighbors.has(target)) {
			validMoves.push({ lion, target, fromNodeId: lion.nodeId });
		}
	}
	
	// 3. Apply lion moves simultaneously
	for (const mv of validMoves) {
		mv.lion.nodeId = mv.target;
	}
	
	// 4. Remove contamination from nodes where lions are now located
	const lionNodes = new Set(state.lions.map(l => l.nodeId));
	for (const nodeId of lionNodes) {
		state.contaminated.delete(nodeId);
	}
	
	// 5. Spread contamination from stored positions, excluding edges used by lions and lion nodes
	const usedEdges = new Set();
	for (const mv of validMoves) {
		const edgeKey = `${mv.fromNodeId}->${mv.target}`;
		const reverseEdgeKey = `${mv.target}->${mv.fromNodeId}`;
		usedEdges.add(edgeKey);
		usedEdges.add(reverseEdgeKey);
	}
	spreadContaminationFromPositions(contaminationBeforeMove, usedEdges, lionNodes);
	
	state.queuedMoves.clear();
	$('#moveBtn').disabled = true;
	render();
}

function startSimulation() {
	if (state.started) return;
	state.started = true;
	initContamination();
	$('#moveBtn').disabled = state.queuedMoves.size === 0;
	render();
}

function svgEl(tag, attrs = {}) {
	const el = document.createElementNS(svgNS, tag);
	for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
	return el;
}

function clearSvg() {
    const svg = $('#graph');
    const viewport = svg.querySelector('#viewport');

    // viewport가 존재하면, 그 안의 내용물만 모두 지웁니다.
    if (viewport) {
        while (viewport.firstChild) {
            viewport.removeChild(viewport.firstChild);
        }
    }

    // 임시 화살표(static이 아닌 것)만 svg에서 직접 찾아서 지웁니다.
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
        // ⬇️ 아래 속성들을 수정/추가합니다.
        markerUnits: 'strokeWidth', // 단위를 '선 두께' 기준으로 변경
        markerWidth: arrowHeadLength.toString(),
        markerHeight: arrowHeadWidth.toString(),          // 선 두께의 3배 높이
        refX: '0',                  // 선 끝에 정확히 붙도록 너비와 맞춤
        refY: (arrowHeadWidth/2).toString(),                // 높이의 절반으로 중앙 정렬
        orient: 'auto' 
    });
    // polygon 좌표도 위 크기에 맞춰서 수정합니다.
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
	const lionNodes = new Map(); // nodeId -> lions count'
	const nodeRadius = CONFIG.nodeRadius;
	for (const l of state.lions) lionNodes.set(l.nodeId, (lionNodes.get(l.nodeId) || 0) + 1);

	for (const node of state.graph.nodes) {
		const g = svgEl('g', { class: 'node', 'data-node-id': node.id });
		g.appendChild(svgEl('circle', { cx: node.x, cy: node.y, r: nodeRadius }));

		// lions emoji inside node (support multiple, overlapping)
		const lionsHere = lionNodes.get(node.id) || 0;
		if (lionsHere > 0) {
			const text = svgEl('text', { class: 'emoji', x: node.x, y: node.y + 2.5, 'text-anchor': 'middle' });
				text.textContent = '🦁';
				g.appendChild(text);
			if (lionsHere != 1) {
				// Add count text
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

		// contamination emoji inside node (only if no lions)
		if (state.started && state.contaminated.has(node.id) && lionsHere === 0) {
			const text = svgEl('text', { class: 'emoji', x: node.x, y: node.y + 2, 'text-anchor': 'middle' });
			text.textContent = '🦠';
			g.appendChild(text);
		}

		g.addEventListener('click', (e) => onNodeClick(node.id, e));
		g.addEventListener('mousedown', (e) => onNodeMouseDown(node.id, e));
		viewport.appendChild(g);
	}
}

let dragInfo = null; // { fromNodeId, startX, startY }
let canvasWasDragged = false;
let panZoomInstance = null;

/**
 * 입력값의 종류에 따라 좌표를 변환하는 범용 함수.
 * - 입력값이 이벤트(Event)이면: 화면 좌표를 SVG 내부 좌표로 변환.
 * - 입력값이 좌표 객체({x,y})이면: 노드의 절대 좌표를 현재 Pan/Zoom 상태의 상대 좌표로 변환.
 * @param {Event | {x: number, y: number}} input - 마우스 이벤트 또는 좌표 객체
 * @returns {{x: number, y: number}} 변환된 SVG 좌표
 */
function getSvgPoint(input) {
    const svg = $('#graph');
    const pt = svg.createSVGPoint();

    // 입력값이 마우스/터치 이벤트인 경우
    if (input instanceof Event || (window.TouchEvent && input instanceof TouchEvent)) {
        const point = input.changedTouches ? input.changedTouches[0] : input;
        pt.x = point.clientX;
        pt.y = point.clientY;
        
        // 화면 좌표 -> SVG 좌표 변환
        const ctm = svg.getScreenCTM();
        if (!ctm) return { x: 0, y: 0 };
        return pt.matrixTransform(ctm.inverse());
    } 
    // 입력값이 좌표 객체({x, y})인 경우
    else if (typeof input === 'object' && input.x !== undefined && input.y !== undefined) {
        const viewport = $('#viewport');
        if (!viewport) return input;

        pt.x = input.x;
        pt.y = input.y;

        // 노드 절대 좌표 -> 현재 보이는 상대 좌표 변환
        const matrix = viewport.getCTM();
        return pt.matrixTransform(matrix);
    }

    // 예외 처리
    return { x: 0, y: 0 };
}

function onNodeClick(nodeId, e) {
	let wasDrag = canvasWasDragged; // 라이브러리가 판단한 드래그 여부

    // 백업 장치: 마우스 이동 거리를 직접 계산
    if (mouseDownPos) {
        const dx = e.clientX - mouseDownPos.x;
        const dy = e.clientY - mouseDownPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // 만약 마우스가 5px 이상 움직였다면 드래그로 간주
        if (distance > 5) {
            wasDrag = true;
        }
    }

    // 라이브러리가 드래그로 판단했거나, 실제 마우스 이동 거리가 길었다면 함수 종료
    if (wasDrag) {
        return;
    }

    // 드래그가 아닐 경우에만 사자 추가 로직 실행
    if (!state.started) {
        addLion(nodeId);
        $('#startBtn').disabled = false;
        $('#resetBtn').disabled = false;
        render();
    }
}

function onNodeMouseDown(nodeId, e) {
    mouseDownPos = { x: e.clientX, y: e.clientY };
    canvasWasDragged = false;

    if (state.started) {
        const lionOnNode = state.lions.some((l) => l.nodeId === nodeId);
        if (!lionOnNode) return;

        const node = state.graph.nodes.find(n => n.id === nodeId);
        if (!node) return;

        // ▼▼▼ 이 부분이 간단해집니다 ▼▼▼
        // getSvgPoint에 노드의 원본 좌표를 넘겨주어 현재 보이는 위치를 계산합니다.
        const startCoords = getSvgPoint({ x: node.x, y: node.y });

        dragInfo = { fromNodeId: nodeId, startX: startCoords.x, startY: startCoords.y };
        
        if (panZoomInstance) panZoomInstance.disablePan();
        
        document.addEventListener('mousemove', onDragMove);
        document.addEventListener('mouseup', onDragEnd, { once: true });
    }
}

function getNearestNodeId(x, y) {
	let best = { id: null, d2: Infinity };
	for (const n of state.graph.nodes) {
		// 1. 노드의 원본(절대) 좌표를 현재 보이는 화면(상대) 좌표로 변환합니다.
        const nodeCurrentPos = getSvgPoint({ x: n.x, y: n.y });

        // 2. 이제 마우스 위치와 변환된 노드 위치, 즉 동일한 좌표계에서 거리를 계산합니다.
        const dx = nodeCurrentPos.x - x;
        const dy = nodeCurrentPos.y - y;
        
		const d2 = dx * dx + dy * dy;
		if (d2 < best.d2) best = { id: n.id, d2 };
	}
	return best.id;
}

function onDragMove(e) {
	if (!dragInfo) return;
	const svg = $('#graph');
	const arrowId = 'queue-arrow-temp';
	let arrow = document.getElementById(arrowId);
	const { x, y } = getSvgPoint(e);
	// 1. 화살표 머리의 실제 픽셀 크기를 계산합니다.
    // (markerUnits가 'strokeWidth'이므로, 선 두께를 곱해 실제 크기를 구합니다)
    const arrowheadPixelLength = CONFIG.arrowHeadLength * CONFIG.arrowStrokeWidth;

    // 2. 시작점에서 현재 마우스 위치까지의 벡터와 거리를 계산합니다.
    const dx = x - dragInfo.startX;
    const dy = y - dragInfo.startY;
    const length = Math.sqrt(dx * dx + dy * dy);

    let endX = x;
    let endY = y;

    // 3. 선의 길이를 화살표 머리 크기만큼 줄인 새로운 끝점을 계산합니다.
    if (length > arrowheadPixelLength) { // 선이 화살표보다 길 때만 줄입니다.
        endX = x - (dx / length) * arrowheadPixelLength;
        endY = y - (dy / length) * arrowheadPixelLength;
    }
	else{
		endX = dragInfo.startX + (dx / length ) * 0.1;
		endY = dragInfo.startY + (dy / length ) * 0.1;
	}

    if (!arrow) {
        // 4. 계산된 끝점으로 선을 생성합니다.
        arrow = svgEl('line', { id: arrowId, class: 'queue-arrow', x1: dragInfo.startX, y1: dragInfo.startY, x2: endX, y2: endY, 'marker-end': 'url(#queueArrowhead)'});
        svg.appendChild(arrow);
    } else {
        // 5. 드래그 중에도 계속해서 계산된 끝점으로 업데이트합니다.
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

	// 화살표 그리기가 끝났으므로, 캔버스 이동(Pan) 기능을 다시 활성화합니다.
    if (panZoomInstance) {
        panZoomInstance.enablePan();
    }

	const from = dragInfo.fromNodeId;
	const { x, y } = getSvgPoint(e);
	const to = getNearestNodeId(x, y);
	// Only queue if adjacent
	const neighbors = state.graph.adjacency.get(from) || new Set();
	if (neighbors.has(to)) {
		// Queue for only ONE lion on the from-node (the first one without a queued move)
		const lionsOnNode = state.lions.filter(l => l.nodeId === from);
		const lionWithoutMove = lionsOnNode.find(l => !state.queuedMoves.has(l.id));
		if (lionWithoutMove) {
			queueMove(lionWithoutMove.id, to);
		}
	}
	dragInfo = null;
}

function renderQueueArrows(viewport) {
	const nodeRadius = CONFIG.nodeRadius;

	// Group moves by from->to pairs
	const moveGroups = new Map(); // "fromId->toId" -> count
	for (const lion of state.lions) {
		const target = state.queuedMoves.get(lion.id);
		if (target == null) continue;
		const key = `${lion.nodeId}->${target}`;
		moveGroups.set(key, (moveGroups.get(key) || 0) + 1);
	}
	
	// Render arrows with counts
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
            // 시작점 좌표: fromNode 중심에서 toNode 방향으로 반지름만큼 이동
            newX1 = fromNode.x + (dx / length) * nodeRadius;
            newY1 = fromNode.y + (dy / length) * nodeRadius;
            
            // 끝점 좌표: toNode 중심에서 fromNode 방향으로 반지름만큼 이동 (반대로 빼줌)
			const arrowheadPixelLength = CONFIG.arrowHeadLength * CONFIG.arrowStrokeWidth;
            const totalShortenDist = nodeRadius + arrowheadPixelLength;
            newX2 = toNode.x - (dx / length) * totalShortenDist;
            newY2 = toNode.y - (dy / length) * totalShortenDist;
        }

        // Create arrow line
        const line = svgEl('line', { 
            class: 'queue-arrow static', 
            x1: newX1, // 계산된 시작점 x
            y1: newY1, // 계산된 시작점 y
            x2: newX2, // 계산된 끝점 x
            y2: newY2, // 계산된 끝점 y
            'marker-end': 'url(#queueArrowhead)',
            'data-from': fromId,
            'data-to': toId
        });
		
		// Add click event to cancel moves
		line.addEventListener('click', (e) => {
			e.stopPropagation();
			cancelMoves(fromId, toId);
		});
		
		viewport.appendChild(line);
		
		// Add count text only if count > 1
		if (count > 1) {
			const midX = (fromNode.x + toNode.x) / 2;
			const midY = (fromNode.y + toNode.y) / 2;

			const offsetDistance = 7; // 화살표에서 숫자를 얼마나 떨어뜨릴지 결정하는 값
			const dx = toNode.x - fromNode.x;
			const dy = toNode.y - fromNode.y;
			const length = Math.sqrt(dx * dx + dy * dy);

			let textX = midX;
			let textY = midY;

			// 화살표 길이가 0보다 클 때만 계산 (0으로 나누기 방지)
			if (length > 0) {
				// 화살표에 수직인 방향(시계방향)으로의 벡터를 계산합니다.
				const offsetX = (dy / length) * offsetDistance;
				const offsetY = (-dx / length) * offsetDistance;

				// 중앙점에서 계산된 offset만큼 떨어진 위치를 최종 좌표로 설정합니다.
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
			text.addEventListener('click', (e) => {
				e.stopPropagation();
				cancelMoves(fromId, toId);
			});
			viewport.appendChild(text);
		}
	}
}

function render() {
    const svg = $('#graph');
    
    // viewport를 찾고, 만약 없으면 새로 생성합니다.
    let viewport = svg.querySelector('#viewport');
    if (!viewport) {
        viewport = svgEl('g', { id: 'viewport' });
        svg.appendChild(viewport);
    }

    // 이제 내용물을 지우는 clearSvg를 호출합니다.
    clearSvg();

    // 나머지 렌더링 함수들은 그대로 viewport를 사용합니다.
    renderDefs(svg);
    renderEdges(viewport);
    renderNodes(viewport);
    renderQueueArrows(viewport);
}

function setupUI() {
	$('#loadBtn').addEventListener('click', handleTextInput);
	$('#startBtn').addEventListener('click', startSimulation);
	$('#moveBtn').addEventListener('click', executeMoves);
	$('#resetBtn').addEventListener('click', resetAll);
}

function bootstrap() {
	setupUI();
	// Load example graph into textarea
	const exampleGraph = {
		"nodes": [
			{"id": 1, "x": 100, "y": 100},
			{"id": 2, "x": 200, "y": 100},
			{"id": 3, "x": 300, "y": 100},
			{"id": 4, "x": 100, "y": 200},
			{"id": 5, "x": 200, "y": 200},
			{"id": 6, "x": 300, "y": 200},
			{"id": 7, "x": 150, "y": 150},
			{"id": 8, "x": 250, "y": 150}
		],
		"edges": [
			{"from": 1, "to": 2},
			{"from": 2, "to": 3},
			{"from": 1, "to": 4},
			{"from": 2, "to": 5},
			{"from": 3, "to": 6},
			{"from": 4, "to": 5},
			{"from": 5, "to": 6},
			{"from": 1, "to": 7},
			{"from": 2, "to": 7},
			{"from": 4, "to": 7},
			{"from": 5, "to": 7},
			{"from": 2, "to": 8},
			{"from": 3, "to": 8},
			{"from": 5, "to": 8},
			{"from": 6, "to": 8}
		]
	};
	$('#graphInput').value = JSON.stringify(exampleGraph, null, 2);
	render();
	let eventTarget = null; // 터치/클릭된 대상을 저장할 변수

    // mousedown과 touchstart 이벤트를 사용해 실제 이벤트 대상을 미리 저장
    $('#graph').addEventListener('mousedown', e => { eventTarget = e.target; });
    $('#graph').addEventListener('touchstart', e => { eventTarget = e.target; });

    panZoomInstance = svgPanZoom('#graph', {
        zoomEnabled: true,
        panEnabled: true,
        controlIconsEnabled: false,
		doubleClickZoomEnabled: false,
        fit: true,
        center: true,
        minZoom: 0.5,
        maxZoom: 10,
        viewportSelector: '#viewport',
        
        // ▼ 핵심: Pan/Zoom 동작 전 실행되는 콜백 함수 추가 ▼
        beforePan: function() {
            const isNode = eventTarget && eventTarget.closest('.node');
            
            // 게임이 시작된 후에 노드를 드래그할 때만 Pan을 막습니다.
            if (isNode && state.started) {
                return false;
            }
        }
    });
    
    // 창 크기가 변경될 때 캔버스 크기도 맞춰주기
    window.addEventListener('resize', () => {
        panZoomInstance.resize();
        panZoomInstance.center();
    });
}

document.addEventListener('DOMContentLoaded', bootstrap);

// Example expected graph JSON structure:
// {
//   "nodes": [ {"id": 1, "x": 100, "y": 120}, {"id": 2, "x": 240, "y": 180} ],
//   "edges": [ {"from": 1, "to": 2}, {"from": 2, "to": 3} ]
// }