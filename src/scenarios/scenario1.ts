import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import GUI from 'lil-gui';
import type { Scenario } from './types';

export class Scenario1 implements Scenario {
    private scene!: THREE.Object3D;
    private gui!: GUI;
    
    // Objects
    private clockS: any;
    private clockL: any;
    private clockR: any;
    private markerDot!: THREE.Mesh;
    
    // State
    private labelElements: HTMLElement[] = [];
    private state = {
        timeS: 0,
        timeL: 0,
        timeR: 0,
        hasHandedOff: false,
        isFinished: false
    };

    private startConfig = {
        v: 0.5,
        distance: 10,
        speed: 2,
        paused: false
    };

    private config = { ...this.startConfig };

    constructor() {}

    init(scene: THREE.Object3D, camera: THREE.PerspectiveCamera, _controls: any, guiContainer: HTMLElement) {
        this.scene = scene;
        
        // --- objects setup ---
        
        // Grid
        const gridHelper = new THREE.GridHelper(50, 50, 0x444444, 0x222222);
        this.scene.add(gridHelper);

        // Track
        const trackGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(-25, 0, 0), // Extend left for flying start
            new THREE.Vector3(25, 0, 0)
        ]);
        const trackMaterial = new THREE.LineBasicMaterial({ color: 0x666666 });
        const track = new THREE.Line(trackGeometry, trackMaterial);
        this.scene.add(track);

        // Clocks
        this.clockS = this.createPointClock(0x3498db, 'S', 1.0); // Blue
        this.scene.add(this.clockS.group);

        this.clockL = this.createPointClock(0x2ecc71, 'L', 2.5); // Green
        this.scene.add(this.clockL.group);

        this.clockR = this.createPointClock(0xe74c3c, 'R', 4.0); // Red
        this.scene.add(this.clockR.group);

        // Handoff Marker (Pink Dot)
        const dotGeo = new THREE.SphereGeometry(0.05, 16, 16);
        const dotMat = new THREE.MeshBasicMaterial({ color: 0xff00ff });
        this.markerDot = new THREE.Mesh(dotGeo, dotMat);
        this.scene.add(this.markerDot);

        // GUI
        this.gui = new GUI({ container: guiContainer });
        // Make it full width/relative to container
        this.gui.domElement.style.position = 'absolute';
        this.gui.domElement.style.top = '0px'; 
        this.gui.domElement.style.right = '0px';

        this.gui.add(this.config, 'v', 0.1, 0.95).name('Velocity (v/c)').onChange(() => this.reset());
        this.gui.add(this.config, 'distance', 5, 20).name('Distance (D)').onChange(() => this.reset());
        this.gui.add(this.config, 'speed', 0.1, 5).name('Sim Speed');
        this.gui.add(this.config, 'paused').name('Pause');
        this.gui.add({ reset: () => this.reset() }, 'reset').name('Reset');

        // DOM Setup for Readouts (Target internal div)
        const domReadouts = document.getElementById('readouts')!;
        domReadouts.innerHTML = `
            <div class="readout-item"><span>Clock S (Stationary):</span> <span class="readout-val" id="val-s">0.00</span></div>
            <div class="readout-item"><span>Total Relay (L + R):</span> <span class="readout-val highlight" id="val-total">0.00</span></div>
            <hr style="border-color: #444; margin: 0.5rem 0;">
            <div class="readout-item" style="font-size: 0.9rem; color: #aaa;">Gamma: <span id="val-gamma">1.00</span></div>
        `;
        
        // Cam reset
        camera.position.set(0, 10, 20);
        camera.lookAt(0, 0, 0);
        
        this.reset();
    }

    createPointClock(color: number, name: string, yOffset: number = 0.5) {
        const group = new THREE.Group();
        // Simple Point Graphic (small)
        const geometry = new THREE.SphereGeometry(0.05, 16, 16);
        const material = new THREE.MeshBasicMaterial({ color: color });
        const mesh = new THREE.Mesh(geometry, material);
        group.add(mesh);

        // Connecting Line
        const lineGeo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, yOffset, 0)
        ]);
        const lineMat = new THREE.LineBasicMaterial({ color: color, transparent: true, opacity: 0.5 });
        const line = new THREE.Line(lineGeo, lineMat);
        group.add(line);

        // HTML Label
        const div = document.createElement('div');
        div.className = 'clock-label';
        div.textContent = `${name}\n0.00`;
        div.style.whiteSpace = 'pre';
        
        this.labelElements.push(div); // Track for cleanup

        const label = new CSS2DObject(div);
        label.position.set(0, yOffset, 0);
        group.add(label);

        return { group, labelDiv: div, mesh };
    }

    reset() {
        // Start simulation at negative time so L is seen approaching
        // Let's say we want L to start at x = -5
        // x = v * t => t = -5 / v
        // Or fixed time?
        const startDist = 5;
        const startTime = -startDist / this.config.v;

        this.state = {
            timeS: startTime,
            timeL: 0,
            timeR: 0,
            hasHandedOff: false,
            isFinished: false
        };
        this.markerDot.position.set(this.config.distance, 0, 0);
        this.updateLabels();
    }

    update(dt: number) {
        if (this.state.isFinished || this.config.paused) return;

        const simDt = dt * this.config.speed;
        this.state.timeS += simDt;

        const gamma = 1 / Math.sqrt(1 - (this.config.v * this.config.v));
        const gammaEl = document.getElementById('val-gamma');
        if(gammaEl) gammaEl.innerText = gamma.toFixed(3);

        const D = this.config.distance;
        const v = this.config.v;
        
        const tHandoff = D / v;
        const tReturn = 2 * D / v;

        // Position Logic: x = v * t (valid for negative t too)
        
        // Update L
        if (this.state.timeS <= tHandoff) {
            this.clockL.group.position.set(v * this.state.timeS, 0, 0);
            
            // Only accumulate proper time if t >= 0
            if (this.state.timeS >= 0) {
                 this.state.timeL = this.state.timeS / gamma;
            } else {
                 this.state.timeL = 0;
            }
        } else {
            this.clockL.group.position.set(D, 0, 0);
            this.state.timeL = tHandoff / gamma;
        }

        // Update R
        // x_R(t) = D - v(t - tHandoff)
        // R is visible always? No, typically wait. But maybe user wants to see it approaching?
        // Let's keep it waiting until handoff for clarity, or let it fly through?
        // "Twin paradox relay" -> R is typically another particle coming in.
        // Let's just keep R hidden/waiting until handoff for simplicity unless requested otherwise.
        
        const timeSinceHandoff = this.state.timeS - tHandoff;
        
        if (this.state.timeS < tHandoff) {
            this.state.hasHandedOff = false;
            this.state.timeR = 0;
             // Keep R at handoff point waiting? Or far away?
             // Usually Relay implies R passes L. So R should be at position > D coming left.
             // x_R = D - v(t - tHandoff). Calculate it.
             const rPos = D - (v * timeSinceHandoff); // This will be > D for t < tHandoff
             this.clockR.group.position.set(rPos, 0, 0);
             
             // BUT, typically we only care about R after handoff.
             // Let's Fade it in?
        } else {
            this.state.hasHandedOff = true;
            this.state.timeR = timeSinceHandoff / gamma;
            this.clockR.group.position.set(D - (v * timeSinceHandoff), 0, 0);
        }

        // Finish check
        if (this.state.timeS >= tReturn) {
            this.state.isFinished = true;
            this.clockR.group.position.set(0, 0, 0);
        }

        this.updateLabels();
        this.updateDOM(tHandoff, gamma);
    }

    updateLabels() {
        // Show 0 if t < 0
        const displayTimeS = this.state.timeS < 0 ? 0 : this.state.timeS;
        
        this.clockS.labelDiv.textContent = `S\nT: ${displayTimeS.toFixed(2)}`;
        this.clockL.labelDiv.textContent = `L\n\u03C4: ${this.state.timeL.toFixed(2)}`;
        
        if (!this.state.hasHandedOff) {
            // If before start (negative time), L is "Approaching".
            // R is "Waiting" or "Approaching" too?
            // Let's just say R is (Wait) until handoff to avoid confusion
            this.clockR.labelDiv.textContent = `R\n(Wait)`;
            this.clockR.group.visible = true; 
            this.clockR.mesh.material.opacity = 0.3;
            // this.clockR.mesh.material.transparent = true; 
        } else {
            this.clockR.labelDiv.textContent = `R\n\u03C4: ${this.state.timeR.toFixed(2)}`;
            this.clockR.mesh.material.opacity = 1.0;
            // this.clockR.mesh.material.transparent = false;
        }
    }

    updateDOM(tHandoff: number, gamma: number) {
        const sEl = document.getElementById('val-s');
        if (sEl) sEl.innerText = this.state.timeS.toFixed(2);

        const lAtHandoff = (this.state.timeS >= tHandoff ? tHandoff : this.state.timeS) / gamma;
        const rLeg = this.state.hasHandedOff ? this.state.timeR : 0;
        const total = lAtHandoff + rLeg;
        
        const totalEl = document.getElementById('val-total');
        if (totalEl) totalEl.innerText = total.toFixed(2);
    }

    cleanup() {
        if(this.gui) this.gui.destroy();
        
        // Remove DOM labels
        this.labelElements.forEach(el => el.parentElement?.removeChild(el));
        this.labelElements = [];

        // Remove objects
        this.scene.remove(this.clockS.group);
        this.scene.remove(this.clockL.group);
        this.scene.remove(this.clockR.group);
        this.scene.remove(this.markerDot);
        
        while(this.scene.children.length > 0){ 
            this.scene.remove(this.scene.children[0]); 
        }
        document.getElementById('readouts')!.innerHTML = '';
    }

    onResize() {}
}
