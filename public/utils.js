import { state } from './state.js';

export const $ = (sel) => document.querySelector(sel);
export const svgNS = 'http://www.w3.org/2000/svg';

/**
 * Converts a screen coordinate (from a mouse/touch event) to coordinates
 * relative to the SVG element's top-left corner (view space).
 * @param {{clientX, clientY}} point The screen point.
 * @returns {{x, y}} The point in view space.
 */
export function screenToView(point) {
    const svg = $('#graph');
    const pt = svg.createSVGPoint();
    pt.x = point.clientX;
    pt.y = point.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    return pt.matrixTransform(ctm.inverse());
}

/**
 * Converts a screen coordinate (from a mouse/touch event) to the internal
 * "world" coordinates of the SVG, accounting for pan and zoom.
 * @param {{clientX, clientY}} point The screen point.
 * @returns {{x, y}} The point in world space.
 */
export function screenToWorld(point) {
    const viewPoint = screenToView(point);
    const viewport = $('#viewport');
    if (!viewport) return viewPoint;
    const viewportTransform = viewport.getCTM();
    if (!viewportTransform) return viewPoint;
    return viewPoint.matrixTransform(viewportTransform.inverse());
}

/**
 * Converts an internal "world" coordinate to its visible position in the SVG's
 * coordinate system (view space), accounting for pan and zoom.
 * @param {{x, y}} point The world point.
 * @returns {{x, y}} The point in view space.
 */
export function worldToView(point) {
    const svg = $('#graph');
    const viewport = $('#viewport');
    const pt = svg.createSVGPoint();
    pt.x = point.x;
    pt.y = point.y;
    if (!viewport) return pt;
    const viewportTransform = viewport.getCTM();
    if (!viewportTransform) return pt;
    return pt.matrixTransform(viewportTransform);
}

export function buildAdjacency(nodes, edges) {
	const adj = new Map();
	nodes.forEach((n) => adj.set(n.id, new Set()));
	edges.forEach((e) => {
		adj.get(e.from).add(e.to);
		adj.get(e.to).add(e.from);
	});
	return adj;
}

export function getNearestNodeId(x, y) {
	let best = { id: null, d2: Infinity };
	for (const n of state.graph.nodes) {
		// Compare coordinates directly in the SVG world coordinate space.
        const dx = n.x - x;
        const dy = n.y - y;
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