# Stick Showdown

An original stickman brawler for the browser. Fight endless waves of stickmen in a moonlit arena, chain combos and survive boss waves. Plain HTML, CSS and JavaScript, with no dependencies and no build step.

## Features

- Dash with brief invulnerability, dive kicks, and an ultimate shockwave that charges as you fight
- Training mode with a move checklist, a punching dummy and a button to add more fighters
- Coins drop from defeated enemies and are saved between sessions
- Shop with 7 weapons that get pricier as they get stronger, each with its own ability (bleed, burn, freeze, crit, quake, chain lightning and more)
- Punch, kick, block and jump, with hit-stop, screen shake and particle effects
- Four enemy types (grunt, ninja, brute, boss) with their own speed, health and blocking behaviour
- Endless waves that scale in difficulty, with a boss every 5th wave
- Combo scoring and a saved best score (`localStorage`)
- Procedural sound effects (WebAudio), no asset files
- Keyboard and touch controls, responsive 16:9 canvas

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Move | A / D or arrows | on-screen arrows |
| Jump | W, Space or Up | Jump |
| Punch | J | Punch |
| Kick | K | Kick |
| Block | L, S or Down | Block |
| Dash | Shift or I | Dash |
| Ultimate | U (when the bar is full) | Ult |
| Dive kick | S + K while in the air | n/a |
| Leap forward | hold W + D | Jump + arrow |
| Pause / mute | P or Esc / M | n/a |

Tip: kicks hit harder and knock enemies up, but leave you open for longer. Blocking cuts damage by about 90%.

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
style.css    layout and touch controls
game.js      game logic, AI, rendering, audio
```

## License

MIT. See `LICENSE`.
