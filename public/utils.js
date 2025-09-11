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

export function getSvgPoint(input) {
    const svg = $('#graph');
    const pt = svg.createSVGPoint();

    // Duck-typing for event-like objects (Mouse, Touch, etc.) that have clientX/Y
    if (input.clientX !== undefined && input.clientY !== undefined) {
        pt.x = input.clientX;
        pt.y = input.clientY;
        
        // Transform screen coordinates to SVG coordinates
        const ctm = svg.getScreenCTM();
        if (!ctm) return { x: 0, y: 0 };
        return pt.matrixTransform(ctm.inverse());
    } 
    // For absolute coordinate objects like { x: 100, y: 200 }
    else if (typeof input === 'object' && input.x !== undefined && input.y !== undefined) {
        const viewport = $('#viewport');
        if (!viewport) return input;

        pt.x = input.x;
        pt.y = input.y;

        // Transform absolute node coordinates to screen-relative coordinates
        const matrix = viewport.getCTM();
        return pt.matrixTransform(matrix);
    }

    // Fallback
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