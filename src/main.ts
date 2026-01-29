
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import './style.css';
import type { Scenario } from './scenarios/types';
import { Scenario1 } from './scenarios/scenario1';
import { Scenario2 } from './scenarios/scenario2';
import { Scenario3 } from './scenarios/scenario3';

// --- State ---
let currentScenario: Scenario | null = null;
let currentScenarioId = '1';
const scenarios: { [key: string]: { new(): Scenario } } = {
    '1': Scenario1,
    '2': Scenario2,
    '3': Scenario3
};

// --- DOM References ---
const canvasContainer = document.getElementById('canvas-container')!;
const controlsContainer = document.getElementById('controls-container')!;

// --- Setup Scene ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x242424); // Match tab panel bg

const camera = new THREE.PerspectiveCamera(45, canvasContainer.clientWidth / canvasContainer.clientHeight, 0.1, 1000);
camera.position.set(0, 10, 20);

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(canvasContainer.clientWidth, canvasContainer.clientHeight);
canvasContainer.appendChild(renderer.domElement);

// Label Renderer
const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(canvasContainer.clientWidth, canvasContainer.clientHeight);
labelRenderer.domElement.style.position = 'absolute';
labelRenderer.domElement.style.top = '0px';
labelRenderer.domElement.style.pointerEvents = 'none'; 
canvasContainer.appendChild(labelRenderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

const sceneContent = new THREE.Group();
scene.add(sceneContent);

// Global Static Lights
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(5, 10, 5);
scene.add(dirLight);

// --- Switching Logic ---

function loadScenario(id: string) {
    if (currentScenario) {
        currentScenario.cleanup();
    }
    
    // Create new
    const ScenarioClass = scenarios[id];
    if (ScenarioClass) {
        currentScenario = new ScenarioClass();
        currentScenario.init(sceneContent as any, camera, controls, controlsContainer);
    }
}

// --- Animation Loop ---
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const dt = clock.getDelta();
  if (currentScenario) {
      currentScenario.update(dt);
  }
  
  controls.update();
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
}

// Global Resize handler (Targeting container now)
window.addEventListener('resize', () => {
    // We need to resize based on container size, which might change if window resizes
    const width = canvasContainer.clientWidth;
    const height = canvasContainer.clientHeight;
    
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    labelRenderer.setSize(width, height);
    if(currentScenario) currentScenario.onResize();
});

// --- UI Logic ---

const tab1 = document.getElementById('tab-1')!;
const tab2 = document.getElementById('tab-2')!;
const tab3 = document.getElementById('tab-3')!;
const titleEl = document.getElementById('scenario-title')!;
const descEl = document.getElementById('scenario-desc')!;
const restartBtn = document.getElementById('restart-btn')!;

function setActiveTab(id: string) {
    // Reset all
    currentScenarioId = id;
    [tab1, tab2, tab3].forEach(t => t.classList.remove('active'));

    if (id === '1') {
        tab1.classList.add('active');
        titleEl.textContent = 'Twin Paradox Relay';
        descEl.textContent = 'Clock S remains stationary. L moves away, hands off to R, which returns. Total relay time < S time.';
    } else if (id === '2') {
        tab2.classList.add('active');
        titleEl.textContent = 'Symmetric Triplet Expansion';
        descEl.textContent = 'Three observers (S, L, R) move outward at 120° angles at the same speed. They age identically.';
    } else if (id === '3') {
        tab3.classList.add('active');
        titleEl.textContent = 'Asymmetric Triplet';
        descEl.textContent = 'Three observers move at different distances. L goes 2x dist, R goes 3x dist of S (Base). All return to origin eventually.';
    }
}

tab1.onclick = () => {
    loadScenario('1');
    setActiveTab('1');
};

tab2.onclick = () => {
    loadScenario('2');
    setActiveTab('2');
};

tab3.onclick = () => {
    loadScenario('3');
    setActiveTab('3');
};

restartBtn.onclick = () => {
    loadScenario(currentScenarioId);
};

// Initial load
loadScenario('1');
setActiveTab('1');

animate();
