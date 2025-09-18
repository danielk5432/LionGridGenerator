import { state, startSimulation, resetAll, setGraph } from './state.js';
import { executeMoves } from './game.js';
import { normalizeGraph, $ } from './utils.js';

export let panZoomInstance = null;

// --- New Embedded Graph List Functions ---

async function populateGraphList() {
  const container = $('#graph-list-container');
  if (!container) return;

  try {
    const response = await fetch('public/graphs/all-graphs.json'); // Updated path
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const { graphs } = await response.json();

    graphs.forEach(graphInfo => {
      const item = document.createElement('div');
      item.className = 'graph-list-item';
      item.innerHTML = `
        <h4>${graphInfo.name}</h4>
        <p>${graphInfo.description}</p>
      `;
      container.appendChild(item);

      // Add click event to load the graph
      item.addEventListener('click', async () => {
        try {
          const graphResponse = await fetch(graphInfo.filePath);
          if (!graphResponse.ok) throw new Error(`Failed to fetch graph data from ${graphInfo.filePath}`);
          const graphData = await graphResponse.json();

          // 1. Populate the textarea
          $('#graphInput').value = JSON.stringify(graphData, null, 2);
          // 2. Trigger the existing load function
          handleTextInput();
        } catch (err) {
          console.error('Error loading individual graph:', err);
          alert(err.message);
        }
      });
    });

  } catch (error) {
    console.error('Could not populate graph list:', error);
    container.innerHTML = '<p style="color: red; padding: 10px;">Failed to load graph list.</p>';
  }
  panZoomInstance.zoom(3);
    panZoomInstance.pan({ x: -100, y: -200 });
}

export function setupUI() {
	$('#loadBtn').addEventListener('click', handleTextInput);
	$('#startBtn').addEventListener('click', startSimulation);
	$('#moveBtn').addEventListener('click', executeMoves);
	$('#resetBtn').addEventListener('click', resetAll);

	// Populate the list of available graphs on startup
	populateGraphList();
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
    // Hammer.js를 사용하기 위한 커스텀 이벤트 핸들러
    const eventsHandler = {
        haltEventListeners: ['touchstart', 'touchend', 'touchmove', 'touchleave', 'touchcancel'],
        init: function(options) {
            const instance = options.instance;
            let initialScale = 1;
            let pannedX = 0;
            let pannedY = 0;

            // Hammer.js 초기화
            this.hammer = Hammer(options.svgElement, {
                inputClass: Hammer.SUPPORT_POINTER_EVENTS ? Hammer.PointerEventInput : Hammer.TouchInput
            });

            // Pinch(두 손가락 확대/축소) 제스처 활성화
            this.hammer.get('pinch').set({ enable: true });

            // Pan(한 손가락 이동) 이벤트 처리
            this.hammer.on('panstart panmove', function(ev) {
                // 노드 위에서 시작된 Pan은 무시 (우리 코드와의 충돌 방지)
                if (ev.target.closest('.node')) {
                    return;
                }
                if (ev.type === 'panstart') {
                    pannedX = 0;
                    pannedY = 0;
                }
                instance.panBy({ x: ev.deltaX - pannedX, y: ev.deltaY - pannedY });
                pannedX = ev.deltaX;
                pannedY = ev.deltaY;
            });

            // Pinch(확대/축소) 이벤트 처리
            this.hammer.on('pinchstart pinchmove', function(ev) {
                if (ev.type === 'pinchstart') {
                    initialScale = instance.getZoom();
                }
                instance.zoomAtPoint(initialScale * ev.scale, { x: ev.center.x, y: ev.center.y });
            });
        },
        destroy: function() {
            this.hammer.destroy();
        }
    };

    panZoomInstance = svgPanZoom('#graph', {
        zoomEnabled: true,
        panEnabled: true,
        controlIconsEnabled: false,
        fit: true,
        center: true,
        minZoom: 0.5,
        maxZoom: 10,
        viewportSelector: '#viewport',
        dblClickZoomEnabled: false, // Hammer가 더블탭을 처리하도록 비활성화
        // ▼▼▼ 핵심: 기본 이벤트 핸들러 대신 우리가 만든 핸들러를 사용 ▼▼▼
        customEventsHandler: eventsHandler
    });

    // 창 크기 변경 이벤트 리스너
    window.addEventListener('resize', () => {
        panZoomInstance.resize();
        panZoomInstance.center();
    });

    panZoomInstance.zoom(3);
    panZoomInstance.pan({ x: -100, y: 100 });
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