import * as THREE from 'three';

export interface Scenario {
    init(scene: THREE.Object3D, camera: THREE.Camera, controls: any, guiContainer: HTMLElement): void;
    update(dt: number): void;
    cleanup(): void;
    onResize(): void;
}

export type Config = {
    v: number;
    distance: number;
    speed: number;
    paused: boolean;
};
