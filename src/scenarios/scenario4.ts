import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import GUI from 'lil-gui';
import type { Scenario } from './types';

export class Scenario4 implements Scenario {
    private scene!: THREE.Object3D;
    private gui!: GUI;
    
    private observers: { [key: string]: any } = {};
    
    // State
    private labelElements: HTMLElement[] = [];
    private state = {
        timeLab: 0,
        ageS: 0,
        ageL: 0,
        ageR: 0,
        isFinished: false
    };

    private startConfig = {
        v: 0.2, // Base velocity for S. Note: R will be 4*v, so max v is ~0.24
        distance: 5,
        speed: 2,
        paused: false
    };

    private config = { ...this.startConfig };

    constructor() {}

    init(scene: THREE.Object3D, camera: THREE.PerspectiveCamera, _controls: any, guiContainer: HTMLElement) {
        this.scene = scene;

        // No GridHelper as requested

        this.observers['S'] = this.createPointClock(0x3498db, 'S', 2.0); // Lowest
        this.observers['L'] = this.createPointClock(0x2ecc71, 'L', 5.0); // Mid
        this.observers['R'] = this.createPointClock(0xe74c3c, 'R', 8.0); // Highest

        this.scene.add(this.observers['S'].group);
        this.scene.add(this.observers['L'].group);
        this.scene.add(this.observers['R'].group);

        // Tracks (Lines showing paths)
        this.createTracks();

        // GUI
        this.gui = new GUI({ container: guiContainer });
        this.gui.domElement.style.position = 'absolute';
        this.gui.domElement.style.top = '0px'; 
        this.gui.domElement.style.right = '0px';

        // Limit v so R (4v) stays < 1. Max v approx 0.245
        this.gui.add(this.config, 'v', 0.05, 0.24).name('Base Velocity (v_S)').onChange(() => this.reset());
        this.gui.add(this.config, 'distance', 2, 10).name('Base Distance (D)').onChange(() => this.reset());
        this.gui.add(this.config, 'speed', 0.1, 5).name('Sim Speed');
        this.gui.add(this.config, 'paused').name('Pause');
        this.gui.add({ reset: () => this.reset() }, 'reset').name('Reset');

        // DOM
        const domReadouts = document.getElementById('readouts')!;
        domReadouts.innerHTML = `
            <div class="readout-item"><span>Lab Time:</span> <span class="readout-val" id="val-lab">0.00</span></div>
            <div class="readout-item"><span>Age S (1v):</span> <span class="readout-val" id="val-s">0.00</span></div>
            <div class="readout-item"><span>Age L (2v):</span> <span class="readout-val" id="val-l">0.00</span></div>
            <div class="readout-item"><span>Age R (4v):</span> <span class="readout-val" id="val-r">0.00</span></div>
            <hr style="border-color: #444; margin: 0.5rem 0;">
             <div class="readout-item" style="font-size: 0.9rem; color: #aaa;">Gamma S: <span id="val-gamma-s">1.00</span></div>
             <div class="readout-item" style="font-size: 0.9rem; color: #aaa;">Gamma L: <span id="val-gamma-l">1.00</span></div>
             <div class="readout-item" style="font-size: 0.9rem; color: #aaa;">Gamma R: <span id="val-gamma-r">1.00</span></div>
        `;
        
        // Adjust camera to look down slightly more
        camera.position.set(0, 50, 50);
        camera.lookAt(0, 0, 0);

        this.reset();
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
    }

    update(dt: number) {
        if (this.config.paused) return;

        const simDt = dt * this.config.speed;
        this.state.timeLab += simDt;

        const vS = this.config.v;
        const vL = vS * 2;
        const vR = vS * 4;

        // Gammas
        const getGamma = (v: number) => {
             // clamp v slightly below 1 to avoid infinity if user maxes out slider
             const safeV = Math.min(v, 0.999);
             return 1 / Math.sqrt(1 - safeV * safeV);
        };
        const gammaS = getGamma(vS);
        const gammaL = getGamma(vL);
        const gammaR = getGamma(vR);

        document.getElementById('val-gamma-s')!.innerText = gammaS.toFixed(3);
        document.getElementById('val-gamma-l')!.innerText = gammaL.toFixed(3);
        document.getElementById('val-gamma-r')!.innerText = gammaR.toFixed(3);

        const D = this.config.distance; // Same distance for all
        
        // Define observers configs
        const obsConfigs = {
            'S': { v: vS, gamma: gammaS, angle: Math.PI/2 },
            'L': { v: vL, gamma: gammaL, angle: Math.PI/2 + 2*Math.PI/3 },
            'R': { v: vR, gamma: gammaR, angle: Math.PI/2 + 4*Math.PI/3 }
        };

        let allFinished = true;

        for (const [key, conf] of Object.entries(obsConfigs)) {
            const tHalf = D / conf.v;
            const tReturn = 2 * tHalf;

            let currentDist = 0;
            // Proper time calculation is tricky if we just sum dt. 
            // Better to calculate closed form from timeLab:
            // tau = tLab / gamma (during flight)
            // if finished, tau = tTotal / gamma + (timeLab - tTotal)
            
            let currentAge = 0;

            if (this.state.timeLab <= tHalf) {
                // Outbound
                currentDist = conf.v * this.state.timeLab;
                currentAge = this.state.timeLab / conf.gamma;
                allFinished = false;
            } else if (this.state.timeLab <= tReturn) {
                // Return
                currentDist = D - (conf.v * (this.state.timeLab - tHalf));
                currentAge = this.state.timeLab / conf.gamma;
                allFinished = false;
            } else {
                // Finished
                currentDist = 0;
                // Age = (Flight Time / gamma) + Wait Time
                const flightTimeProper = tReturn / conf.gamma;
                const waitTime = this.state.timeLab - tReturn;
                currentAge = flightTimeProper + waitTime;
            }

            // Update State
            (this.state as any)[`age${key}`] = currentAge;

            // Update Position
            const x = currentDist * Math.cos(conf.angle);
            const z = -currentDist * Math.sin(conf.angle);
            this.observers[key].group.position.set(x, 0, z);
            this.observers[key].labelDiv.textContent = `${key}\n${currentAge.toFixed(2)}`;
        }

        if (allFinished && !this.state.isFinished) {
            this.state.isFinished = true;
            // Optional: Pause when all done?
            // this.config.paused = true;
        }

        // DOM
        document.getElementById('val-lab')!.innerText = this.state.timeLab.toFixed(2);
        document.getElementById('val-s')!.innerText = this.state.ageS.toFixed(2);
        document.getElementById('val-l')!.innerText = this.state.ageL.toFixed(2);
        document.getElementById('val-r')!.innerText = this.state.ageR.toFixed(2);
    }

    createTracks() {
        // Draw 3 lines from origin. Length 20 covers the max Distance (10) comfortably
        const TrackLen = 20; 
        const angles = [Math.PI/2, Math.PI/2 + 2*Math.PI/3, Math.PI/2 + 4*Math.PI/3];
        
        angles.forEach(angle => {
            const geometry = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(TrackLen * Math.cos(angle), 0, -TrackLen * Math.sin(angle)) 
            ]);
            const material = new THREE.LineBasicMaterial({ color: 0x444444 });
            const line = new THREE.Line(geometry, material);
            this.scene.add(line);
        });
    }

    cleanup() {
        if(this.gui) this.gui.destroy();
        
        this.labelElements.forEach(el => el.parentElement?.removeChild(el));
        this.labelElements = [];

        while(this.scene.children.length > 0){ 
            this.scene.remove(this.scene.children[0]); 
        }
        document.getElementById('readouts')!.innerHTML = '';
    }

    onResize() {}
}
