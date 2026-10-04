# USS Sentient

[Play the game](https://chatgptricks.github.io/uss-sentient/) · [GitHub repository](https://github.com/chatgptricks/uss-sentient)

A Three.js exploration game inside an enclosed, ISS-inspired spacecraft. Seven Sentient departments occupy distinct off-white pressure modules, joined by narrow tubes, fourteen automatic rounded hatches, three stair corridors and a sloping habitat connection. The expanded Bridge is an elevated observation deck with three angled viewing bays overlooking a neon-lime star.

The approved modular layout has developed into a detailed interior: structural ribs, service trays, pipe bundles, equipment cabinets, fasteners, instruments and department-specific screens. Distant stars use an infinite background without walking parallax; observation glass does not reflect cabin lamps as false nearby stars.

Each quarter has its own equipment: Arrival has stowed EVA gear and supply lockers; the Floor has a fabrication arm; the Archive has data towers; the Commons grows plants in hydroponic racks; the Forum has a shared tactical display and folding meeting station; the Lab contains a microscope, centrifuge and specimens; and the Bridge has restrained pilot seats behind its consoles. Equipment stays outside the main walking routes.

Performance is the default quality on desktop and mobile. It renders directly without shadow maps, ambient occlusion or bloom, using six nearby practical lamps and two screen lights. Balanced and High are optional settings that add local shadows, window sunlight, contact shading and bloom with a bounded shadow budget. Distinct surface roughness brings out seams, equipment depth and metal edges in every mode.

Hatches have seven mechanical identities: padded cargo leaves, segmented archive vaults, braced fabrication doors, glazed laboratory portholes, botanical relief, communications panels and double-collar command airlocks. Both entrances on the Bridge connection carry dark segmented armor and oversized 07 markings; every door retains automatic opening and its clear walking aperture.

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

`npm run test:lighting` checks lighting quality settings and captures matched room views. `node tests/doors.mjs` captures all seven closed hatch designs in the default Performance mode. `npm run test:quarters` verifies department equipment, collision bounds and all 49 department routes, then captures the plants, instruments, meeting station, fabrication arm, pilot seats and other props.

## Controls

| Action | Control |
| --- | --- |
| Move | W A S D or arrow keys |
| Look | Mouse or click and drag |
| Sprint | Shift |
| Inspect nearby terminal | E |
| Station map | M |
| Expedition logs | J |
| Ray-traced still view | R |
| Pause | Esc |

Desktop keyboard and mouse controls and on-screen touch controls are supported. Discovered-room progress is saved in this browser's local storage. Explore at your own pace and scan each room's terminal to collect its signal. Hatches open automatically from either side. Press M and select a department to highlight its route on the map and activate the direction arrow.

The optional ray-traced still view progressively accumulates samples from a fixed camera. Movement pauses while the image converges; press Esc to return to exploration. The first samples are grainy and refine over time. This browser rendering mode does not imply dedicated hardware ray-tracing support or real-time ray-traced movement. `npm run test:raytrace` verifies real sample accumulation, cancellation, repeated entry, and resumed exploration.

The USS Sentient, its star, station architecture and scan mission are fictional. This is a standalone static game with no company-service integrations or live company data. Original Sentient source projects are unchanged.

## Imported props

Nineteen original Kenney GLB models supply computers, consoles, cargo cases, generators and communications equipment. A further 27 instrument screens, 220 physical controls and 22 gauges are built into the pressure hull. Selected reusable 3D assets are stored locally under `public/models/`, with licenses and provenance in [ASSET-CREDITS.md](docs/ASSET-CREDITS.md). Original files are kept small and load before exploration begins.

## GitHub Pages deployment

Pushes to `main` run the navigation tests, build with the Pages base path and publish `dist/` through `.github/workflows/pages.yml`. The workflow can also be run manually from GitHub Actions. The repository is public because this account’s plan requires a public repository for Pages.

Local development still uses `/`. To reproduce the project-site build locally:

```bash
VITE_BASE_PATH=/uss-sentient/ npm run build
VITE_BASE_PATH=/uss-sentient/ npm run preview -- --port 4183
GAME_URL=http://127.0.0.1:4183/uss-sentient/ npm run test:deployment
```

The deployment smoke test uses the public UI rather than development-only helpers. It checks local models and fonts, actual walking through a hatch, map guidance, the default Performance setting, and the lazy ray-tracing worker.
