# USS Sentient

A navigable Three.js layout prototype for an enclosed, ISS-inspired spacecraft. Off-white modules of different sizes connect to a central corridor, and a neon-lime star is visible through observation windows. This blockout is for approving room proportions, circulation and the view outside before a detailed art pass.

The exploration loop maps seven Sentient rooms to seven collectible terminal signals. The current priority is the station layout; detailed assets follow layout approval.

The room names and functions come from the existing Sentient Hub, with supporting company content and brand assets from the Sentient Website. See [the research and source mapping](docs/SENTIENT-RESEARCH.md).

## Run locally

Requires a recent Node.js version supported by Vite.

```bash
npm install
npm run dev -- --port 5173
```

Open the local URL printed by Vite.

```bash
npm run build
npm test
```

The build produces `dist/`. The navigation tests cover room access, doorways, collisions, wall sliding and saved-progress recovery.

With the dev server running and Google Chrome installed, `npm run test:browser` verifies keyboard movement, actual prop-aware room access, all terminal interactions, saved progress, the deck map and emulated touch controls. Screenshots are written to `test-results/`.

## Controls

| Action | Control |
| --- | --- |
| Move | W A S D or arrow keys |
| Look | Mouse or click and drag |
| Sprint | Shift |
| Inspect nearby terminal | E |
| Station map | M |
| Expedition logs | J |
| Pause | Esc |

Desktop keyboard and mouse controls and on-screen touch controls are supported. Discovered-room progress is saved in this browser's local storage. Explore at your own pace and scan each room's terminal to collect its signal.

The USS Sentient, its star, station architecture and scan mission are fictional. This is a purely local game with no company-service integrations or live company data. Original Sentient source projects are unchanged.
