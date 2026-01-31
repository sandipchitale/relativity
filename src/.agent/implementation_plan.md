The user wants to remove "extraneous lines" from Scenario 2 and Scenario 3 animations, while keeping the "lines at 120 degrees". The "lines at 120 degrees" refer to the star-shaped tracks for the observers, which are separated by 120 degrees. The "extraneous lines" are identified as the `THREE.GridHelper`.

## Plan

1.  **Modify `src/scenarios/scenario2.ts`**:
    - Remove the `THREE.GridHelper` instantiation and addition to the scene.
2.  **Modify `src/scenarios/scenario3.ts`**:
    - Remove the `THREE.GridHelper` instantiation and addition to the scene.
