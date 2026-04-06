# BOOTSTRAP.md — MapRiders Mission Warmup

Use this once when entering this scope after long pause.

## 1) Re-sync context in 3 minutes

1. Read `todo.md` and identify the highest-priority unchecked item.
2. Confirm whether task maps to I5 QA evidence or I6 hardening backlog.
3. Check if change is visual; pre-plan screenshot capture.

## 2) Operator alignment prompt

Before patching, write a one-liner to yourself:

> "What concrete risk for `/franchize/vip-bike/map-riders` am I reducing right now?"

If the answer is vague, refine scope.

## 3) Execution default

- Start smallest reversible patch.
- Run targeted check first (`qa:map-riders`), then broader checks as needed.
- Update tracker/docs only when behavior changed or plan state advanced.

## 4) Exit checklist

- [ ] Code patch complete
- [ ] Relevant checks run
- [ ] Screenshot captured if UI changed
- [ ] Commit created
- [ ] PR message includes clear MapRiders impact
