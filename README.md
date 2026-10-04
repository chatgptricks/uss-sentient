# USS Sentient

A navigable Three.js layout prototype for an enclosed, ISS-inspired spacecraft. Seven compact octagonal modules connect through 2.25-metre pressure tunnels in an asymmetric loop. Rounded automatic hatches separate the modules. Opaque off-white hulls, sloping shoulders and structural ribs enclose the player; the Bridge has a framed cupola view of the neon-lime star. This blockout is for approving room proportions, circulation and the view outside before a detailed art pass.

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

The build produces `dist/`. The navigation tests cover polygonal hull boundaries, all department routes, hatch collisions, wall sliding and saved-progress recovery. A shared metre-scale plan in `src/layout.js` drives the world, collision and both maps.

With the dev server running and Google Chrome installed, `npm run test:browser` verifies keyboard movement, automatic hatch opening and closing, room access, all terminal interactions, saved progress, the deck map and emulated touch controls. Screenshots are written to `test-results/`.

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

Desktop keyboard and mouse controls and on-screen touch controls are supported. Discovered-room progress is saved in this browser's local storage. Explore at your own pace and scan each room's terminal to collect its signal. Hatches open automatically from either side. Press M and select a department to highlight its route on the map and activate the direction arrow.

The USS Sentient, its star, station architecture and scan mission are fictional. This is a purely local game with no company-service integrations or live company data. Original Sentient source projects are unchanged.
