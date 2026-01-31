// Scenario 3: Asymmetric Triplet (Different Distances)
import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import GUI from 'lil-gui';
import type { Scenario } from './types';

export class Scenario3 implements Scenario {
    private scene!: THREE.Object3D;
    private gui!: GUI;
    
    private observers: { [key: string]: any } = {};
    private labelElements: HTMLElement[] = [];
    
    // State
    private state = {
        timeLab: 0,
        ageS: 0,
        ageL: 0,
        ageR: 0,
        isFinished: false
    };

    private startConfig = {
        v: 0.5,
        distance: 5, // Base distance
        speed: 2,
        paused: false
    };

    private config = { ...this.startConfig };

    private markerGroup: THREE.Group = new THREE.Group();

    constructor() {}

    init(scene: THREE.Object3D, camera: THREE.PerspectiveCamera, _controls: any, guiContainer: HTMLElement) {
        this.scene = scene;

        // Grid removed previously

        // Distances: S=1x, L=2x, R=3x
        // Vertical Offsets: S=2, L=5, R=8
        this.observers['S'] = this.createPointClock(0x3498db, 'S', 2.0); 
        this.observers['L'] = this.createPointClock(0x2ecc71, 'L', 5.0); 
        this.observers['R'] = this.createPointClock(0xe74c3c, 'R', 8.0); 

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
        this.gui.add(this.config, 'distance', 2, 15).name('Base Dist (D)').onChange(() => this.reset()); // Lower max since R goes 3x
        this.gui.add(this.config, 'speed', 0.1, 5).name('Sim Speed');
        this.gui.add(this.config, 'paused').name('Pause');
        this.gui.add({ reset: () => this.reset() }, 'reset').name('Reset');

        // DOM
        const domReadouts = document.getElementById('readouts')!;
        domReadouts.innerHTML = `
            <div class="readout-item"><span>Lab Time:</span> <span class="readout-val" id="val-lab">0.00</span></div>
            <div class="readout-item"><span>Age S (1xD):</span> <span class="readout-val" id="val-s">0.00</span></div>
            <div class="readout-item"><span>Age L (2xD):</span> <span class="readout-val" id="val-l">0.00</span></div>
            <div class="readout-item"><span>Age R (3xD):</span> <span class="readout-val" id="val-r">0.00</span></div>
            <hr style="border-color: #444; margin: 0.5rem 0;">
             <div class="readout-item" style="font-size: 0.9rem; color: #aaa;">Gamma: <span id="val-gamma">1.00</span></div>
        `;
        
        // Adjust camera to look down more for larger field
        camera.position.set(0, 50, 50);
        camera.lookAt(0, 0, 0);

        this.reset();
    }

    createTracks() {
        const BaseD = 45; // Just for visual lines
        // Angles: S=90 (Z-), L=210, R=330
        const angles = [Math.PI/2, Math.PI/2 + 2*Math.PI/3, Math.PI/2 + 4*Math.PI/3];
        
        angles.forEach(angle => {
            const geometry = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(BaseD * Math.cos(angle), 0, -BaseD * Math.sin(angle)) 
            ]);
            const material = new THREE.LineBasicMaterial({ color: 0x444444 });
            const line = new THREE.Line(geometry, material);
            this.scene.add(line);
        });
    }

    createPointClock(color: number, name: string, yOffset: number = 0.5) {
        const group = new THREE.Group();
        const geometry = new THREE.SphereGeometry(0.1, 16, 16); // Slightly larger
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
        const BaseD = this.config.distance;
        
        const config = [
             { mult: 1, angle: Math.PI/2 },
             { mult: 2, angle: Math.PI/2 + 2*Math.PI/3 },
             { mult: 3, angle: Math.PI/2 + 4*Math.PI/3 }
        ];

        const geometry = new THREE.SphereGeometry(0.05, 16, 16);
        const material = new THREE.MeshBasicMaterial({ color: 0xff00ff }); // Pink

        config.forEach(c => {
            const mesh = new THREE.Mesh(geometry, material);
            const D = BaseD * c.mult;
            const x = D * Math.cos(c.angle);
            const z = -D * Math.sin(c.angle);
            mesh.position.set(x, 0, z);
            this.markerGroup.add(mesh);
        });
    }

    reset() {
        this.state = {
            timeLab: 0,
            ageS: 0,
            ageL: 0,
            ageR: 0,
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

        const BaseD = this.config.distance;
        const v = this.config.v;
        
        // Calculate max trip time (R travels 3x distance)
        const maxMult = 3; 
        const maxD = BaseD * maxMult;
        const maxTime = 2 * (maxD / v);

        // Check for finish first to clamp
        if (this.state.timeLab >= maxTime - 0.001) {
            this.state.timeLab = maxTime;
            this.state.isFinished = true;
        }

        // Configs for each
        const observersConfig = {
            'S': { mult: 1, angle: Math.PI/2 },
            'L': { mult: 2, angle: Math.PI/2 + 2*Math.PI/3 },
            'R': { mult: 3, angle: Math.PI/2 + 4*Math.PI/3 }
        };

        // Update each
        for (const [key, conf] of Object.entries(observersConfig)) {
            const D = BaseD * conf.mult;
            const tHalf = D / v;
            const tReturn = 2 * tHalf;
            
            let currentDist = 0;
            let currentAge = 0;

            if (this.state.timeLab <= tHalf) {
                // Outbound
                currentDist = v * this.state.timeLab;
                currentAge = this.state.timeLab / gamma;
            } else if (this.state.timeLab <= tReturn) {
                // Inbound
                const timeReturn = this.state.timeLab - tHalf;
                currentDist = D - (v * timeReturn);
                currentAge = this.state.timeLab / gamma;
            } else {
                // Return
                currentDist = 0;
                // Age = trip time / gamma + (labTime - tripTime) * 1
                const tripProper = tReturn / gamma;
                const waitTime = this.state.timeLab - tReturn;
                currentAge = tripProper + waitTime;
            }

            // Set state age dynamically using key
            (this.state as any)[`age${key}`] = currentAge;

            // Position
            const x = currentDist * Math.cos(conf.angle);
            const z = -currentDist * Math.sin(conf.angle);
            this.observers[key].group.position.set(x, 0, z);
            this.observers[key].labelDiv.textContent = `${key}\n${currentAge.toFixed(2)}`;
        }

        // DOM
        document.getElementById('val-lab')!.innerText = this.state.timeLab.toFixed(2);
        document.getElementById('val-s')!.innerText = this.state.ageS.toFixed(2);
        document.getElementById('val-l')!.innerText = this.state.ageL.toFixed(2);
        document.getElementById('val-r')!.innerText = this.state.ageR.toFixed(2);
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
