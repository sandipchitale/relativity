The user wants to update Scenario 1 (Relay).

1.  **Start animation with L at a distance**: Currently L starts at 0. I will start L at a negative x position (e.g. `-distance/2` or constant `-5`) so it is moving when it passes S.
    - This requires adjusting the `update` logic.
    - L's position should be `v * (t - t_offset)`.
    - If we want L to pass S at $t=0$, then $x_L(t) = v * t$. This is already the case!
    - But currently the loop starts at $t=0$, so $x_L(0) = 0$.
    - To show L "coming in", I should start the simulation at a negative time, e.g. $t_{start} = -5$.
    - If I change `this.state.timeS` to start at a negative value, the rest of the logic (`if timeS <= tHandoff`) should still hold, provided I handle the pre-zero phase correctly.
    - At $t < 0$, L is at negative x. S is at 0.
    - Actually, usually in this scenario we compare _intervals_ from the separation event.
    - If I start at negative time, "Clock S" will show negative time? Or should I start counting S time from 0 when L passes?
    - Let's just start the simulation time at a negative value, so visually L approaches S.
    - "Start the animation when L is some distance away from S".
    - Let's set `timeS` initially to say `-D/v * 0.5` (start halfway to left).
    - But wait, the user says "clear L is moving at constant velocity".
    - If I start at t < 0, L will be to the left.
    - S clock should probably stay at 0 until L passes? Or S clock runs too?
    - The "Twin Paradox" usually compares the interval between separation and reunion.
    - If I show the "approach", that's fine, but the _measurement_ starts at 0 (coincidence).
    - So, for $t < 0$, clocks display "0.00" or just running negative?
    - I'll make clocks display 0.00 until $t=0$.
    - And position of L will be $v*t$.
    - What about R? R comes in from far right. R needs to meet L at D.
    - This implies R is also moving for a long time.
    - Maybe just focus on L starting away.

2.  **Pink Dot**:
    - Remove `handoffLine` (which is the vertical yellow line).
    - Add a pink dot at `(distance, 0, 0)`.

3.  **Remove Vertical Yellow Lines**:
    - This refers to `handoffLine`.

## Plan

1.  **Modify `src/scenarios/scenario1.ts`**:
    - Remove `handoffLine` creation and update.
    - Add a `markerDot` (pink sphere) at the handoff point.
    - Change `reset()` to initialize `timeS` to a negative value, e.g., `-tHandoff * 0.3`.
    - Update `updateLabels` to show 0.00 if time is negative.
    - Ensure positions update correctly for negative time (L at negative x).
