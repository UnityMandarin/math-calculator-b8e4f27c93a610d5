# Arena upgrade: source review

**Delivery:** untested candidate on `upgrade/arena-rework`. The main GitHub Pages game remains the original version. This candidate has not been published or accepted through playtesting.

**Workflow:** Astra High supplied design constraints and final source review; Luna High implemented the upgrade; root coordinated and reconciled the findings.

## Changes

| Area | Result in source |
|---|---|
| Phone controls | Dedicated Jump and hold-Block, horizontal joystick, Pause/Sound controls, safe-area spacing, scrollable full-screen phone menus |
| Combat readability | Enemy windups; boss slam with a locked marker, shared 98-unit horizontal danger radius, warning and recovery |
| Wave choices | Restore up to 35% max health, add up to 20 percentage points of run damage (cap +80%), or reduce dash cooldown up to 10 percentage points (cap 45% shorter); capped options disabled |
| Weapon identity | Distinct procedural silhouettes and arcs; all ten weapons and ultimate branches retained |
| Damage safety | Idempotent death, guarded post-lethal effects, one consumed small projectile per target, retained finishing-hit rewards |
| Saves | Validated legacy inventory/ability IDs, map index, currencies and score; no startup rewrite of fallback loadout; visible storage warnings |
| Run flow | Run-only bonuses reset, separate coins-earned counter, summary, map/loadout status, lightning cleanup, explicit overlay/input handling |
| Options | Saved mute and reduced-motion settings; reduced motion suppresses shake, particles and selected animated effects |

## Review corrections

Source review corrected a paused shop resuming hidden combat, enemy windups bypassing stun/active attacks, capped rewards offering empty choices, misplaced draw coordinates, a transformed mobile container anchoring fixed controls incorrectly, Enter-key menu conflicts, and finishing blows losing attacker-side rewards after an initial damage guard change.

## Remaining risks

- Balance and feel are unverified. The reward choice replaces automatic wave healing and changes later-run survivability.
- Long-session variety is still limited by the shared endless-wave structure across four maps.
- Portrait canvas HUD/training text may remain small despite responsive DOM menus and controls.
- Multi-touch comfort, browser audio, storage failures, performance and visual quality were not observed.
- Progress remains browser-local, with no account sync. Input remapping, gamepad control and fully accessible nonvisual gameplay are not implemented.

**No tests or game execution were performed:** no playtest, preview, build, syntax/import check, simulation, game screenshot, browser game visit, or benchmark. This is a static source review, not proof of runtime correctness or fun. Final gameplay acceptance belongs to the user.
