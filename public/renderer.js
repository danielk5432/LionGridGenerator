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

    renderEdges(viewport);
    renderNodes(viewport);
    renderQueueArrows(viewport);
}

/**
 * 앱 시작 시 SVG에 필요한 <defs>를 한 번만 생성합니다.
 * @param {SVGElement} svg - SVG 최상위 엘리먼트
 */
export function initDefs(svg) {
    const arrowHeadLength = CONFIG.arrowHeadLength;
    const arrowHeadWidth = CONFIG.arrowHeadWidth;

    const defs = svgEl('defs');

    // 드래그 시 사용할 화살촉 marker (id: queueArrowhead)
    const queueArrow = svgEl('marker', { 
        id: 'queueArrowhead',
        markerUnits: 'strokeWidth',
        markerWidth: arrowHeadLength.toString(),
        markerHeight: arrowHeadWidth.toString(),
        refX: arrowHeadLength.toString(),
        refY: (arrowHeadWidth / 2).toString(),
        orient: 'auto' 
    });
    queueArrow.appendChild(svgEl('polygon', { 
        points: `0 0, ${arrowHeadLength} ${arrowHeadWidth / 2}, 0 ${arrowHeadWidth}`, 
        fill: '#ef4444' // fill 속성을 여기에 명시
    }));
    defs.appendChild(queueArrow);

    // 짧은 화살표를 위한 symbol (id: arrowhead-shape)
    const arrowheadShape = svgEl('symbol', {
        id: 'arrowhead-shape',
        overflow: 'visible'
    });
    arrowheadShape.appendChild(svgEl('polygon', {
        points: `0 0, ${arrowHeadLength} ${arrowHeadWidth / 2}, 0 ${arrowHeadWidth}`,
        fill: '#ef4444'
    }));
    defs.appendChild(arrowheadShape);

    svg.prepend(defs);
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



/**
 * 시작점과 끝점이 주어지면 화살표를 구성하는 데이터를 계산합니다.
 * @param {object} startPoint - { x, y }
 * @param {object} endPoint - { x, y }
 * @param {object} config - { nodeRadius, arrowHeadLength, arrowHeadWidth }
 * @returns {object|null} 화살표를 그리는 데 필요한 데이터 또는 null
 */
export function calculateArrowGeometry(startPoint, endPoint, config) {
    const { nodeRadius, arrowHeadLength, arrowHeadWidth } = config;

    const dx = endPoint.x - startPoint.x;
    const dy = endPoint.y - startPoint.y;
    const length = Math.sqrt(dx * dx + dy * dy);

    if (length === 0) return null;

    const ux = dx / length;
    const uy = dy / length;

    // 1. 화살촉 꼭짓점 계산
    const tipPoint = {
        x: endPoint.x - ux * nodeRadius,
        y: endPoint.y - uy * nodeRadius
    };
    const baseCenterPoint = {
        x: tipPoint.x - ux * arrowHeadLength,
        y: tipPoint.y - uy * arrowHeadLength
    };
    const sidePoint1 = {
        x: baseCenterPoint.x + uy * (arrowHeadWidth / 2),
        y: baseCenterPoint.y - ux * (arrowHeadWidth / 2)
    };
    const sidePoint2 = {
        x: baseCenterPoint.x - uy * (arrowHeadWidth / 2),
        y: baseCenterPoint.y + ux * (arrowHeadWidth / 2)
    };
    
    const polygonPoints = `${tipPoint.x},${tipPoint.y} ${sidePoint1.x},${sidePoint1.y} ${sidePoint2.x},${sidePoint2.y}`;

    // 2. 선 좌표 계산
    const lineStart = {
        x: startPoint.x + ux * nodeRadius,
        y: startPoint.y + uy * nodeRadius
    };
    const lineEnd = baseCenterPoint;
    
    // 3. 선을 그려야 할지 여부 판단
    const shouldDrawLine = length > nodeRadius * 2 + arrowHeadLength;

    return { polygonPoints, lineStart, lineEnd, shouldDrawLine };
}


export function renderQueueArrows(viewport) {
    const nodeRadius = CONFIG.nodeRadius;
    const arrowConfig = {
        nodeRadius: nodeRadius,
        arrowHeadLength: CONFIG.arrowHeadLength * CONFIG.arrowStrokeWidth,
        arrowHeadWidth: CONFIG.arrowHeadWidth * CONFIG.arrowStrokeWidth
    };

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

        // 헬퍼 함수로 모든 계산을 위임합니다.
        const geo = calculateArrowGeometry(fromNode, toNode, arrowConfig);
        if (!geo) continue;

        // 1. 화살촉 그리기
        const arrowhead = svgEl('polygon', {
            class: 'queue-arrow static',
            points: geo.polygonPoints,
            fill: '#ef4444'
        });
        viewport.appendChild(arrowhead);
        
        // 2. 선 그리기 (필요한 경우)
        if (geo.shouldDrawLine) {
            const line = svgEl('line', {
                class: 'queue-arrow static',
                x1: geo.lineStart.x, y1: geo.lineStart.y,
                x2: geo.lineEnd.x, y2: geo.lineEnd.y
            });
            viewport.appendChild(line);
        }


        // 클릭을 위한 히트박스 (항상)
        const dx = toNode.x - fromNode.x;
        const dy = toNode.y - fromNode.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        let hitboxX1 = fromNode.x;
        let hitboxY1 = fromNode.y;
        let hitboxX2 = toNode.x;
        let hitboxY2 = toNode.y;

        const ux = dx / length;
        const uy = dy / length;

        hitboxX1 = fromNode.x + ux * nodeRadius;
        hitboxY1 = fromNode.y + uy * nodeRadius;
        hitboxX2 = toNode.x - ux * nodeRadius;
        hitboxY2 = toNode.y - uy * nodeRadius;
        
        // 계산된 좌표로 히트박스를 생성합니다.
        const hitboxLine = svgEl('line', {
            class: 'queue-arrow-hitbox',
            x1: hitboxX1, y1: hitboxY1,
            x2: hitboxX2, y2: hitboxY2,
            'stroke': 'transparent',
            'stroke-width': '20',
            'data-from': fromId,
            'data-to': toId
        });
        viewport.appendChild(hitboxLine);
        // --- 카운트 숫자 표시 (필요시) ---
        if (count > 1) {
            const midX = (fromNode.x + toNode.x) / 2;
            const midY = (fromNode.y + toNode.y) / 2;
            const offsetDistance = 7;
            let textX = midX;
            let textY = midY;
            if (length > 0) {
                textX += (dy / length) * offsetDistance;
                textY += (-dx / length) * offsetDistance;
            }
            const text = svgEl('text', { 
                class: 'arrow-count', 
                x: textX, y: textY, 
                'text-anchor': 'middle',
                'data-from': fromId, 'data-to': toId
            });
            text.textContent = count.toString();
            viewport.appendChild(text);
        }
    }
}