The user wants to modify Scenario 4 so that all observers (S, L, R) travel the **same distance** `D` but at different speeds ($v, 2v, 4v$).
This implies they will return at different times. S (slowest) will return last.

## Plan

1.  **Modify `src/scenarios/scenario4.ts`**:
    - Update `update` method:
      - Use a single `distance` `D` for all observers.
      - Calculate specific `v`, `gamma`, `tHalf`, and `tTotal` for each observer.
      - Determine position of each observer independently based on `timeLab`.
      - Simulation finishes when the slowest observer (S) returns.
    - Update `createTracks` to just draw lines of sufficient length (e.g. max slider distance).
2.  **Modify `src/main.ts`**:
    - Update the description text for Tab 4 to reflect "Same Distance, Different Speeds".
