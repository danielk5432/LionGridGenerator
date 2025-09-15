import { render } from './renderer.js';
import { initContamination } from './game.js';
import { buildAdjacency, $ } from './utils.js';

export const state = {
	graph: { nodes: [], edges: [], adjacency: new Map() },
	lions: [], // [{id, nodeId}]
	queuedMoves: new Map(), // lionId -> targetNodeId
	contaminated: new Set(), // nodeId set
	started: false,
    freedraw: false,
    temparrows: new Array(), // 임시 화살표들 저장용
	lastLionId: 0,
};

export function resetAll() {
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


export function setGraph(g) {
	state.graph.nodes = g.nodes;
	state.graph.edges = g.edges;
	state.graph.adjacency = buildAdjacency(g.nodes, g.edges);
	resetAll();
}

export function startSimulation() {
	if (state.started) return;
	state.started = true;
	initContamination();
	$('#moveBtn').disabled = state.queuedMoves.size === 0;
	render();
}

export function addLion(nodeId) {
	const id = ++state.lastLionId;
	state.lions.push({ id, nodeId });
	return id;
}

export function queueMove(lionId, targetNodeId) {
	state.queuedMoves.set(lionId, targetNodeId);
	$('#moveBtn').disabled = state.queuedMoves.size === 0;
	render();
}

export function drawTempArrow(fromNodeId, toNodeId) {
    state.temparrows.push({ fromNodeId, toNodeId });
	render();
}

export function deleteTempArrow(fromNodeId, toNodeId) {
    state.temparrows = state.temparrows.filter(arrow => !(arrow.fromNodeId === fromNodeId && arrow.toNodeId === toNodeId));
    render();
}


export function cancelMoves(fromNodeId, toNodeId) {
	const lionsToCancel = [];
	for (const lion of state.lions) {
		if (lion.nodeId === fromNodeId && state.queuedMoves.get(lion.id) === toNodeId) {
			lionsToCancel.push(lion.id);
		}
	}
	
	if (lionsToCancel.length > 0) {
		const lionToCancel = lionsToCancel[0];
		state.queuedMoves.delete(lionToCancel);
		$('#moveBtn').disabled = state.queuedMoves.size === 0;
		render();
	}
}