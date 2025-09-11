import { handleTextInput, setupUI, initializePanZoom, loadExampleGraph } from './ui.js';
import { initInteractions } from './interactions.js';
import { render } from './renderer.js';

function bootstrap() {
	console.log('Application starting...');
	// 1. Setup UI components (buttons, text area)
	setupUI();
	loadExampleGraph();

	// 2. Initial parse of graph and render
	handleTextInput();

	// 3. Setup SVG canvas interactions (pan/zoom, node clicks, drags)
	initializePanZoom();
	initInteractions();

	// 4. Initial render
	render();
}

document.addEventListener('DOMContentLoaded', bootstrap);
