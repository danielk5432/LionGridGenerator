import { state, startSimulation, resetAll, setGraph } from './state.js';
import { normalizeGraph, $ } from './utils.js';
import { executeMoves } from './game.js';

export let panZoomInstance = null;
let mouseDownPos = null;

export function getMouseDownPos() {
    return mouseDownPos;
}

export function setMouseDownPos(pos) {
    mouseDownPos = pos;
}

export function setupUI() {
	$('#loadBtn').addEventListener('click', handleTextInput);
	$('#startBtn').addEventListener('click', startSimulation);
	$('#moveBtn').addEventListener('click', executeMoves);
	$('#resetBtn').addEventListener('click', resetAll);
}

export function handleTextInput() {
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

export function initializePanZoom() {
    let eventTarget = null;

    $('#graph').addEventListener('mousedown', e => { eventTarget = e.target; });
    $('#graph').addEventListener('touchstart', e => { eventTarget = e.target; });

    panZoomInstance = svgPanZoom('#graph', {
        zoomEnabled: true,
        panEnabled: true,
        controlIconsEnabled: false,
        fit: true,
        center: true,
        minZoom: 0.5,
        maxZoom: 10,
        viewportSelector: '#viewport',
        dblClickZoomEnabled: false,
        zoomScaleSensitivity: 0.2,
        beforePan: function(oldPan, newPan) {
            const isNode = eventTarget && eventTarget.closest('.node');
            if (isNode && state.started) {
                return false;
            }
        }
    });

    window.addEventListener('resize', () => {
        panZoomInstance.resize();
        panZoomInstance.center();
    });
}

export function loadExampleGraph() {
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
			{"from": 1, "to": 2}, {"from": 2, "to": 3}, {"from": 1, "to": 4},
			{"from": 2, "to": 5}, {"from": 3, "to": 6}, {"from": 4, "to": 5},
			{"from": 5, "to": 6}, {"from": 1, "to": 7}, {"from": 2, "to": 7},
			{"from": 4, "to": 7}, {"from": 5, "to": 7}, {"from": 2, "to": 8},
			{"from": 3, "to": 8}, {"from": 5, "to": 8}, {"from": 6, "to": 8}
		]
	};
	$('#graphInput').value = JSON.stringify(exampleGraph, null, 2);
}