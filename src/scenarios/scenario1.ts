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

    init(scene: THREE.Object3D, camera: THREE.PerspectiveCamera, controls: any, guiContainer: HTMLElement) {
        this.scene = scene;
        
        // --- objects setup ---
        
        // Grid (XY Plane for Minkowski)
        const gridHelper = new THREE.GridHelper(50, 50, 0x444444, 0x222222);
        gridHelper.rotation.x = Math.PI / 2; // Rotate to stand up facing Z
        this.scene.add(gridHelper);

        // Track (Space axis at t=0)
        const trackGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(-25, 0, 0), // Extend left for flight start
            new THREE.Vector3(25, 0, 0)
        ]);
        const trackMaterial = new THREE.LineBasicMaterial({ color: 0x666666 });
        const track = new THREE.Line(trackGeometry, trackMaterial);
        this.scene.add(track);

        // Axis Labels
        const makeLabel = (text: string, x: number, y: number) => {
            const div = document.createElement('div');
            div.className = 'axis-label';
            div.textContent = text;
            div.style.color = '#888';
            div.style.fontStyle = 'italic';
            div.style.fontWeight = 'bold';
            this.labelElements.push(div);
            
            const label = new CSS2DObject(div);
            label.position.set(x, y, 0);
            this.scene.add(label);
        };

        makeLabel('t', 1, 55); // Top of Time axis
        makeLabel('ct', 26, 0);  // End of Distance axis (x)

        // Clocks
        this.clockS = this.createPointClock(0x3498db, 'S', -2.0, 1.0); // Blue, Left (-X)
        this.scene.add(this.clockS.dotGroup);
        this.scene.add(this.clockS.labelGroup);

        this.clockL = this.createPointClock(0x2ecc71, 'L', 2.0, 1.0); // Green, Right (+X)
        this.scene.add(this.clockL.dotGroup);
        this.scene.add(this.clockL.labelGroup);

        this.clockR = this.createPointClock(0xe74c3c, 'R', 2.0, 2.5); // Red, Right (+X), slightly higher
        this.scene.add(this.clockR.dotGroup);
        this.scene.add(this.clockR.labelGroup);

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
        
        // Cam reset (Looking at XY plane)
        // Center view on middle of scenario (~25 units up) to frame 0..50 nicely.
        camera.position.set(0, 25, 120); 
        camera.lookAt(0, 25, 0);

        if (controls) {
            controls.target.set(0, 25, 0);
            controls.update();
        }
        
        this.reset();
    }

    createPointClock(color: number, name: string, xOffset: number, yOffset: number) {
        // Dot Group (Mesh only)
        const dotGroup = new THREE.Group();
        const geometry = new THREE.SphereGeometry(0.05, 16, 16);
        const material = new THREE.MeshBasicMaterial({ color: color });
        const mesh = new THREE.Mesh(geometry, material);
        dotGroup.add(mesh);

        // Label Group (Line + Label)
        const labelGroup = new THREE.Group();

        // Connecting Line
        const lineGeo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(xOffset, yOffset, 0)
        ]);
        const lineMat = new THREE.LineBasicMaterial({ color: color, transparent: true, opacity: 0.5 });
        const line = new THREE.Line(lineGeo, lineMat);
        labelGroup.add(line);

        // HTML Label
        const div = document.createElement('div');
        div.className = 'clock-label';
        div.textContent = `${name}\n0.00`;
        div.style.whiteSpace = 'pre';
        
        this.labelElements.push(div); // Track for cleanup

        const label = new CSS2DObject(div);
        label.position.set(xOffset, yOffset, 0);
        labelGroup.add(label);

        return { dotGroup, labelGroup, labelDiv: div, mesh };
    }

    private worldlineGroup: THREE.Group = new THREE.Group();

    reset() {
        // Start simulation at negative time so L is seen approaching
        const startDist = 5;
        const startTime = -startDist / this.config.v;

        this.state = {
            timeS: startTime,
            timeL: 0,
            timeR: 0,
            hasHandedOff: false,
            isFinished: false
        };
        const tHandoff = this.config.distance / this.config.v;
        this.markerDot.position.set(this.config.distance, tHandoff, 0);

        this.createWorldlines(startTime);

        const gamma = 1 / Math.sqrt(1 - (this.config.v * this.config.v));
        const timeLStrut = tHandoff / gamma;
        this.updateLabels(this.state.timeS, timeLStrut);
    }

    createWorldlines(startTime: number) {
        // Cleanup old lines
        this.scene.remove(this.worldlineGroup);
        this.worldlineGroup = new THREE.Group();
        this.scene.add(this.worldlineGroup);

        const v = this.config.v;
        const D = this.config.distance;
        const tHandoff = D / v;
        const tReturn = 2 * D / v;
        const overrunTime = 5 / v; // Distance of 5 (startDist)
        const tFinal = tReturn + overrunTime;

        // S Worldline (Vertical at x=0)
        // Draw from startTime (or earlier) to end
        const ptsS = [
            new THREE.Vector3(0, startTime - 5, 0),
            new THREE.Vector3(0, tFinal + 2, 0)
        ];
        const geoS = new THREE.BufferGeometry().setFromPoints(ptsS);
        const matS = new THREE.LineBasicMaterial({ color: 0x3498db, opacity: 0.3, transparent: true });
        this.worldlineGroup.add(new THREE.Line(geoS, matS));

        // L Worldline (Incoming slope, continues past handoff)
        // x_L = v*t
        const ptsL = [
            new THREE.Vector3(v * (startTime - 5), startTime - 5, 0),
            new THREE.Vector3(v * tFinal, tFinal, 0)
        ];
        const geoL = new THREE.BufferGeometry().setFromPoints(ptsL);
        const matL = new THREE.LineBasicMaterial({ color: 0x2ecc71, opacity: 0.3, transparent: true });
        this.worldlineGroup.add(new THREE.Line(geoL, matL));

        // R Worldline (Incoming leg -> Left motion past S)
        // x_R = D - v(t - tHandoff)
        // Visualized from same early start time as L effectively
        const startVizT = startTime - 5;
        // x at startVizT
        const xStart = D - v * (startVizT - tHandoff);

        const ptsR = [
            new THREE.Vector3(xStart, startVizT, 0),
            new THREE.Vector3(D - v * (tFinal - tHandoff), tFinal, 0)
        ];
        const geoR = new THREE.BufferGeometry().setFromPoints(ptsR);
        const matR = new THREE.LineBasicMaterial({ color: 0xe74c3c, opacity: 0.3, transparent: true });
        this.worldlineGroup.add(new THREE.Line(geoR, matR));
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
        const overrunTime = 5 / v; // Allow going past S
        const tFinal = tReturn + overrunTime;

        // Position Logic: x depends on currentSimTime (unclamped)
        const currentSimTime = this.state.timeS;

        // S (Stationary at x=0)
        this.clockS.dotGroup.position.set(0, currentSimTime, 0);

        // L (x = v*t) - Continues moving
        this.clockL.dotGroup.position.set(v * currentSimTime, currentSimTime, 0);

        // R (x = D - v * (t - tHandoff)) - Continues moving
        const rPos = D - v * (currentSimTime - tHandoff);
        this.clockR.dotGroup.position.set(rPos, currentSimTime, 0);
        
        // --- Labels Position Updates ---
        // Determine whether to clamp label position (for R and S only)
        // If > tReturn, clamp to tReturn
        const isPastReturn = currentSimTime > tReturn;
        const clampedTime = isPastReturn ? tReturn : currentSimTime;

        // S Label (x=0, y=clampedTime)
        this.clockS.labelGroup.position.set(0, clampedTime, 0);

        // R Label (x=D-v*(clampedTime-tHandoff), y=clampedTime)
        // Note: R's x formula works for tReturn too.
        // If clampedTime == tReturn, then x = 0.
        const rLabelX = D - v * (clampedTime - tHandoff);
        this.clockR.labelGroup.position.set(rLabelX, clampedTime, 0);

        // L Label (follows L)
        // L keeps moving, so its label follows it.
        this.clockL.labelGroup.position.set(v * currentSimTime, currentSimTime, 0);

        // Calculate Locked/Display Times
        // Lock everything once we hit tReturn
        const displayTime = Math.min(currentSimTime, tReturn);

        // L Time Proper
        if (displayTime >= 0) {
            this.state.timeL = displayTime / gamma;
        } else {
            this.state.timeL = 0;
        }

        // R Time Proper
        if (displayTime < tHandoff) {
            this.state.hasHandedOff = false;
            this.state.timeR = 0;
        } else {
            this.state.hasHandedOff = true;
            this.state.timeR = (displayTime - tHandoff) / gamma;
        }
        
        // Check if simulation should stop completely
        if (this.state.timeS >= tFinal) {
            this.state.isFinished = true;
            this.state.timeS = tFinal; // Clamp for safety
        }

        // We pass 'displayTime' to label updaters so they know what to show
        // Note: updateLabels signature assumes state usage, but we need to override the 'timeS' part
        // or passing explicit values. Let's pass values to be safe.
        // We'll modify updateLabels signature in the next chunk.
        
        // Calculate constant L time at handoff for R's label
        const timeL_at_Handoff = tHandoff / gamma;

        this.updateLabels(displayTime, timeL_at_Handoff);
        this.updateDOM(displayTime, gamma, tHandoff);
    }



    updateLabels(displayTimeS: number, timeLStrut: number) {
        // Show 0 if t < 0
        const tVal = displayTimeS < 0 ? 0 : displayTimeS;
        
        this.clockS.labelDiv.textContent = `S\nT: ${tVal.toFixed(2)}`;
        this.clockL.labelDiv.textContent = `L\n\u03C4: ${this.state.timeL.toFixed(2)}`;
        
        if (!this.state.hasHandedOff) {
            this.clockR.labelDiv.textContent = `R\n(Wait)`;
            this.clockR.labelGroup.visible = true; 
            this.clockR.mesh.material.opacity = 0.3;
        } else {
            // R's Clock = R's proper time + L's proper time at handoff
            this.clockR.labelDiv.textContent = `R\n\u03C4: ${this.state.timeR.toFixed(2)} + ${timeLStrut.toFixed(2)}`;
            this.clockR.mesh.material.opacity = 1.0;
        }
    }

    updateDOM(displayTimeS: number, gamma: number, tHandoff: number) {
        const sEl = document.getElementById('val-s');
        if (sEl) sEl.innerText = displayTimeS.toFixed(2);

        // L's accumulated time at current displayTime 
        // We know state.timeL is already set based on displayTime in update()
        const lCurrent = this.state.timeL;

        // R's leg proper time
        const rLeg = this.state.hasHandedOff ? this.state.timeR : 0;
        
        // This 'total' usually implies the total Relay path time?
        // If hasHandedOff, it is timeL(handoff) + timeR(current)
        // If NOT handed off, it is just timeL(current)
        
        let total = 0;
        if (this.state.hasHandedOff) {
             const timeL_at_Handoff = tHandoff / gamma;
             total = timeL_at_Handoff + rLeg;
        } else {
             total = lCurrent;
        }
        
        const totalEl = document.getElementById('val-total');
        if (totalEl) totalEl.innerText = total.toFixed(2);
    }

    cleanup() {
        if(this.gui) this.gui.destroy();
        
        // Remove DOM labels
        this.labelElements.forEach(el => el.parentElement?.removeChild(el));
        this.labelElements = [];

        // Remove objects
        this.scene.remove(this.clockS.dotGroup);
        this.scene.remove(this.clockS.labelGroup);
        this.scene.remove(this.clockL.dotGroup);
        this.scene.remove(this.clockL.labelGroup);
        this.scene.remove(this.clockR.dotGroup);
        this.scene.remove(this.clockR.labelGroup);
        this.scene.remove(this.markerDot);
        
        while(this.scene.children.length > 0){ 
            this.scene.remove(this.scene.children[0]); 
        }
        document.getElementById('readouts')!.innerHTML = '';
    }

    onResize() {}
}
