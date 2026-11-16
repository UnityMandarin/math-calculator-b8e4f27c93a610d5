# Stick Showdown

An original stickman brawler for the browser. Fight endless waves, learn the controls in Training, and use saved coins to unlock weapons and abilities. The game uses plain HTML, CSS, and JavaScript with no dependencies or build step.

## Game modes and progression

- **Play:** survive endless waves. Bosses arrive every fifth wave; a marked, wind-up ground slam gives you time to move or block, followed by a recovery window.
- **Training:** practice against a dummy, review the move checklist, and add practice fighters. Training does not grant wave rewards, coins, or best-score progress.
- **Wave rewards:** after each cleared survival wave, choose one run-only reward: restore 35% health, add up to 20% damage, or reduce dash cooldown by up to 10%. Bonuses stack for the run, cap at +80% damage and 45% shorter dash cooldown, and reset when it ends. The reward cards show current and next values and disable capped bonuses.
- **Shop, Map, Abilities:** use earned coins to unlock and equip ten distinct weapons and five abilities; select among four arenas. Purchases, equipped loadout, selected map, best score, sound, and reduced-motion preference use the existing `localStorage` keys plus a preference key.
- **Run summary:** the end screen reports wave, defeats, points, best score, arena, weapon, coins earned, and temporary run bonuses.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Move | A / D or arrows | Left joystick |
| Jump | W, Space, or Up | Jump button |
| Punch | J | Punch button |
| Kick | K | Kick button |
| Block | L, S, or Down | Hold Block button |
| Dash | Shift or I | Dash button |
| Ultimate | U when the meter is full | Ult button |
| Dive kick | While airborne, hold S and press K | While airborne, hold Block and tap Kick |
| Pause / resume | P or Esc | Pause button |
| Mute / unmute | M | Sound button |

The menu has a Reduced motion toggle. A storage warning appears if saved data cannot be read or written. Existing valid save keys remain in use.

## Run locally

Open `index.html` in a browser, or serve the folder:

```bash
npx serve .
```

## Deploy on GitHub Pages

1. Push these files to a repository.
2. Go to **Settings, Pages**, pick the `main` branch and the `/ (root)` folder, then save.
3. Your game goes live at `https://<user>.github.io/<repo>/`.

## Project structure

```
index.html   page and overlay UI
style.css    responsive arena, overlays, and touch controls
game.js      game logic, AI, rendering, audio, and saved progression
```

## License

MIT. See `LICENSE`.
