import { state } from './state.js';
import { render, animateMoves } from './renderer.js';
import { $ } from './utils.js';

function calculateContaminationSpread(contaminationPositions, excludedEdges, lionNodes) {
    const nextContaminated = new Set();
    const newSpreads = [];
    const nodeMap = new Map(state.graph.nodes.map(n => [n.id, n]));

    // Contaminated nodes that are not final lion positions remain contaminated
    for (const nodeId of contaminationPositions) {
        if (!lionNodes.has(nodeId)) {
            nextContaminated.add(nodeId);
        }
    }

    // Spread from original positions
    for (const fromId of contaminationPositions) {
        const neighbors = state.graph.adjacency.get(fromId) || new Set();
        for (const toId of neighbors) {
            // Don't spread to a node that will have a lion
            if (lionNodes.has(toId)) continue;

            // Don't spread along an edge used by a lion
            const edgeKey = `${fromId}->${toId}`;
            const reverseEdgeKey = `${toId}->${fromId}`;
            if (excludedEdges.has(edgeKey) || excludedEdges.has(reverseEdgeKey)) continue;

            // If the target is newly contaminated, create animation data
            if (!nextContaminated.has(toId)) {
                const fromNode = nodeMap.get(fromId);
                const toNode = nodeMap.get(toId);
                if (fromNode && toNode) {
                    newSpreads.push({ from: fromNode, to: toNode, type: 'contamination' });
                }
            }
            nextContaminated.add(toId);
        }
    }
    return { nextContaminated, newSpreads };
}


export async function executeMoves() {
	if (state.queuedMoves.size === 0) return;
    $('#moveBtn').disabled = true;

	// 1. Store pre-move state
	const contaminationBeforeMove = new Set(state.contaminated);
	const animationData = [];
	const nodeMap = new Map(state.graph.nodes.map(n => [n.id, n]));

	// 2. Validate lion moves
	const validMoves = [];
	for (const lion of state.lions) {
		const targetId = state.queuedMoves.get(lion.id);
		if (targetId == null) continue;

		const fromNode = nodeMap.get(lion.nodeId);
		const toNode = nodeMap.get(targetId);
		const neighbors = state.graph.adjacency.get(lion.nodeId) || new Set();

		if (fromNode && toNode && neighbors.has(targetId)) {
			validMoves.push({ lion, target: targetId, fromNodeId: lion.nodeId });
			animationData.push({ from: fromNode, to: toNode, type: 'lion' });
		}
	}

	if (validMoves.length === 0) {
		state.queuedMoves.clear();
		$('#moveBtn').disabled = true;
		render();
		return;
	}

    // 3. Calculate final state and contamination animations
    const finalLionNodes = new Set();
    state.lions.forEach(l => {
        const move = validMoves.find(mv => mv.lion.id === l.id);
        finalLionNodes.add(move ? move.target : l.nodeId);
    });

	const usedEdges = new Set();
	validMoves.forEach(mv => {
		const edgeKey = `${mv.fromNodeId}->${mv.target}`;
		const reverseEdgeKey = `${mv.target}->${mv.fromNodeId}`;
		usedEdges.add(edgeKey);
		usedEdges.add(reverseEdgeKey);
	});

    const { nextContaminated, newSpreads } = calculateContaminationSpread(contaminationBeforeMove, usedEdges, finalLionNodes);
    animationData.push(...newSpreads);

	// 4. Animate everything
	await animateMoves(animationData);

	// 5. Apply final state
	for (const mv of validMoves) {
		mv.lion.nodeId = mv.target;
	}
    state.contaminated = nextContaminated;

	// 6. Finalize
	state.queuedMoves.clear();
	$('#moveBtn').disabled = true;
	render();
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
