import { state } from './state.js';

export const $ = (sel) => document.querySelector(sel);
export const svgNS = 'http://www.w3.org/2000/svg';


export function buildAdjacency(nodes, edges) {
	const adj = new Map();
	nodes.forEach((n) => adj.set(n.id, new Set()));
	edges.forEach((e) => {
		adj.get(e.from).add(e.to);
		adj.get(e.to).add(e.from);
	});
	return adj;
}

/**
 * 입력값의 종류에 따라 좌표를 변환하는 범용 함수.
 * - 입력값이 이벤트(Event)이면: 화면 좌표를 SVG 내부 좌표로 변환.
 * - 입력값이 좌표 객체({x,y})이면: 노드의 절대 좌표를 현재 Pan/Zoom 상태의 상대 좌표로 변환.
 * @param {Event | {x: number, y: number}} input - 마우스 이벤트 또는 좌표 객체
 * @returns {{x: number, y: number}} 변환된 SVG 좌표
 */
export function getSvgPoint(input) {
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

export function getNearestNodeId(x, y) {
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

export function normalizeGraph(g) {
	const nodes = (g.nodes || []).map((n) => ({ id: String(n.id), x: Number(n.x), y: Number(n.y) }));
	const edges = (g.edges || []).map((e) => ({ from: String(e.from), to: String(e.to) }));
	return { nodes, edges };
}