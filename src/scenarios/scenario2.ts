import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import GUI from 'lil-gui';
import type { Scenario } from './types';

export class Scenario2 implements Scenario {
    private scene!: THREE.Object3D;
    private gui!: GUI;
    
    private observers: { [key: string]: any } = {};
    
    // State
    private labelElements: HTMLElement[] = [];
    private state = {
        timeLab: 0,
        timeProper: 0,
        isReturn: false,
        isFinished: false
    };

    private startConfig = {
        v: 0.5,
        distance: 10,
        speed: 2,
        paused: false
    };

    private config = { ...this.startConfig };

    private markerGroup: THREE.Group = new THREE.Group();

    constructor() {}

    init(scene: THREE.Object3D, camera: THREE.PerspectiveCamera, _controls: any, guiContainer: HTMLElement) {
        this.scene = scene;

        // Grid


        this.observers['S'] = this.createPointClock(0x3498db, 'S', 2.0); // Lowest
        this.observers['L'] = this.createPointClock(0x2ecc71, 'L', 5.0); // Mid
        this.observers['R'] = this.createPointClock(0xe74c3c, 'R', 8.0); // Highest

        this.scene.add(this.observers['S'].group);
        this.scene.add(this.observers['L'].group);
        this.scene.add(this.observers['R'].group);

        // Turnaround Markers
        this.scene.add(this.markerGroup);

        // Tracks (Lines showing paths)
        this.createTracks();

        // GUI
        this.gui = new GUI({ container: guiContainer });
        this.gui.domElement.style.position = 'absolute';
        this.gui.domElement.style.top = '0px'; 
        this.gui.domElement.style.right = '0px';

        this.gui.add(this.config, 'v', 0.1, 0.95).name('Velocity (v/c)').onChange(() => this.reset());
        this.gui.add(this.config, 'distance', 5, 20).name('Distance (D)').onChange(() => this.reset());
        this.gui.add(this.config, 'speed', 0.1, 5).name('Sim Speed');
        this.gui.add(this.config, 'paused').name('Pause');
        this.gui.add({ reset: () => this.reset() }, 'reset').name('Reset');

        // DOM
        const domReadouts = document.getElementById('readouts')!;
        domReadouts.innerHTML = `
            <div class="readout-item"><span>Lab Time:</span> <span class="readout-val" id="val-lab">0.00</span></div>
            <div class="readout-item"><span>Clock S (Proper):</span> <span class="readout-val" id="val-s">0.00</span></div>
            <div class="readout-item"><span>Clock L (Proper):</span> <span class="readout-val" id="val-l">0.00</span></div>
            <div class="readout-item"><span>Clock R (Proper):</span> <span class="readout-val" id="val-r">0.00</span></div>
            <hr style="border-color: #444; margin: 0.5rem 0;">
             <div class="readout-item" style="font-size: 0.9rem; color: #aaa;">Gamma: <span id="val-gamma">1.00</span></div>
        `;
        
        // Adjust camera to look down slightly more
        camera.position.set(0, 30, 30);
        camera.lookAt(0, 0, 0);

        this.reset();
    }

    createTracks() {
        // Draw 3 lines from origin to distance D at angles
        const D = 25; // Draw long enough
        const angles = [Math.PI/2, Math.PI/2 + 2*Math.PI/3, Math.PI/2 + 4*Math.PI/3];
        
        angles.forEach(angle => {
            const geometry = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(D * Math.cos(angle), 0, -D * Math.sin(angle)) // XZ plane, -sin for Z up
            ]);
            const material = new THREE.LineBasicMaterial({ color: 0x444444 });
            const line = new THREE.Line(geometry, material);
            this.scene.add(line);
        });
    }

    createPointClock(color: number, name: string, yOffset: number = 0.5) {
        const group = new THREE.Group();
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

        const div = document.createElement('div');
        div.className = 'clock-label';
        div.textContent = `${name}\n0.00`;
        div.style.whiteSpace = 'pre';
        this.labelElements.push(div);
        
        const label = new CSS2DObject(div);
        label.position.set(0, yOffset, 0);
        group.add(label);

        return { group, labelDiv: div, mesh };
    }

    updateMarkers() {
        this.markerGroup.clear();
        const D = this.config.distance;
        const angles = [Math.PI/2, Math.PI/2 + 2*Math.PI/3, Math.PI/2 + 4*Math.PI/3];
        
        const geometry = new THREE.SphereGeometry(0.05, 16, 16);
        const material = new THREE.MeshBasicMaterial({ color: 0xff00ff }); // Pink

        angles.forEach(angle => {
            const mesh = new THREE.Mesh(geometry, material);
            const x = D * Math.cos(angle);
            const z = -D * Math.sin(angle);
            mesh.position.set(x, 0, z);
            this.markerGroup.add(mesh);
        });
    }

    reset() {
        this.state = {
            timeLab: 0,
            timeProper: 0,
            isReturn: false,
            isFinished: false
        };
        // Reset positions
        ['S', 'L', 'R'].forEach(k => {
            this.observers[k].group.position.set(0,0,0);
            this.observers[k].labelDiv.textContent = `${k}\n0.00`;
        });
        this.updateMarkers();
    }

    update(dt: number) {
        if (this.state.isFinished || this.config.paused) return;

        const simDt = dt * this.config.speed;
        this.state.timeLab += simDt;

        const gamma = 1 / Math.sqrt(1 - (this.config.v * this.config.v));
        document.getElementById('val-gamma')!.innerText = gamma.toFixed(3);

        const D = this.config.distance;
        const v = this.config.v;
        const tHalf = D / v; 
        const tTotal = 2 * tHalf;

        // Determine phase
        let currentDist = 0;
        
        if (this.state.timeLab <= tHalf) {
            // Outbound
            currentDist = v * this.state.timeLab;
        } else if (this.state.timeLab < tTotal - 0.0001) { // Epsilon check
             // Inbound
            const timeReturn = this.state.timeLab - tHalf;
            currentDist = D - (v * timeReturn);
        } else {
            // Finished
            currentDist = 0;
            this.state.timeLab = tTotal; // Clamp lab time
            this.state.isFinished = true;
        }

        // Calculate Proper Time (same for all)
        // dtau = dt / gamma
        this.state.timeProper = this.state.timeLab / gamma; 
        
        // Update Positions
        // Angles: S=90, L=210, R=330
        const angles = {
            'S': Math.PI/2,
            'L': Math.PI/2 + 2*Math.PI/3,
            'R': Math.PI/2 + 4*Math.PI/3
        };

        for (const [key, angle] of Object.entries(angles)) {
            // X = dist * cos(angle), Z = -dist * sin(angle)
            const x = currentDist * Math.cos(angle);
            const z = -currentDist * Math.sin(angle);
            this.observers[key].group.position.set(x, 0, z);
            this.observers[key].labelDiv.textContent = `${key}\n${this.state.timeProper.toFixed(2)}`;
        }

        // DOM
        document.getElementById('val-lab')!.innerText = this.state.timeLab.toFixed(2);
        ['S', 'L', 'R'].forEach(k => {
             document.getElementById(`val-${k.toLowerCase()}`)!.innerText = this.state.timeProper.toFixed(2);
        });
    }

    cleanup() {
        if(this.gui) this.gui.destroy();
        
        this.labelElements.forEach(el => el.parentElement?.removeChild(el));
        this.labelElements = [];
        this.markerGroup.clear();

        while(this.scene.children.length > 0){ 
            this.scene.remove(this.scene.children[0]); 
        }
        document.getElementById('readouts')!.innerHTML = '';
    }

    onResize() {}
}
