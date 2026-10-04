# USS Sentient

A Three.js exploration game inside an enclosed, ISS-inspired spacecraft. Seven Sentient departments occupy distinct off-white pressure modules, joined by narrow tubes, fourteen automatic rounded hatches, three stair corridors and a sloping habitat connection. The expanded Bridge is an elevated observation deck with three angled viewing bays overlooking a neon-lime star.

The approved modular layout has developed into a detailed interior: structural ribs, service trays, pipe bundles, equipment cabinets, fasteners, instruments and department-specific screens. Distant stars use an infinite background without walking parallax; observation glass does not reflect cabin lamps as false nearby stars.

The exploration loop maps seven Sentient rooms to seven collectible terminal signals. The live map shows actual module footprints, stairs, elevations and a route to the chosen terminal.

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

The build produces `dist/`. The navigation tests cover polygonal hull boundaries, all department routes, hatch collisions, stair and ramp elevations, wall sliding and saved-progress recovery. A shared metre-scale plan in `src/layout.js` drives the world, collision and both maps.

With the dev server running and Google Chrome installed, `npm run test:browser` verifies keyboard movement, automatic hatch opening and closing, physical stair/ramp traversal in both directions, camera height, room access, all terminal interactions, saved progress, the deck map and emulated touch controls. Screenshots are written to `test-results/`.

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

## Imported props

Nineteen original Kenney GLB models supply computers, consoles, cargo cases, generators and communications equipment. A further 27 instrument screens, 220 physical controls and 22 gauges are built into the pressure hull. Selected reusable 3D assets are stored locally under `public/models/`, with licenses and provenance in [ASSET-CREDITS.md](docs/ASSET-CREDITS.md). Original files are kept small and load before exploration begins.
