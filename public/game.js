import { state } from './state.js';
import { render } from './renderer.js';
import { $ } from './utils.js';

export function executeMoves() {
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

export function startSimulation() {
	if (state.started) return;
	state.started = true;
	initContamination();
	$('#moveBtn').disabled = state.queuedMoves.size === 0;
	render();
}

export function initContamination() {
	state.contaminated.clear();
	const lionNodes = new Set(state.lions.map((l) => l.nodeId));
	for (const node of state.graph.nodes) {
		if (!lionNodes.has(node.id)) state.contaminated.add(node.id);
	}
}