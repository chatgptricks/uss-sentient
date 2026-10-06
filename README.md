# USS Sentient

[Play the game](https://chatgptricks.github.io/uss-sentient/) · [GitHub repository](https://github.com/chatgptricks/uss-sentient)

A Three.js exploration game inside an enclosed, ISS-inspired spacecraft. Seven Sentient departments occupy distinct off-white pressure modules, joined by narrow tubes, fourteen automatic rounded hatches, three stair corridors and a sloping habitat connection. The expanded Bridge is an elevated observation deck with an offset, faceted panoramic prow overlooking a neon-lime star.

The approved modular layout has developed into a detailed interior: structural ribs, service trays, pipe bundles, equipment cabinets, fasteners, instruments and department-specific screens. Distant stars use an infinite background without walking parallax; observation glass does not reflect cabin lamps as false nearby stars.

Each quarter has its own equipment: Arrival has stowed EVA gear and supply lockers; the Floor has a fabrication arm and machinery annex; the Archive has data towers; the Commons grows plants in hydroponic racks and has a washroom; the Forum has a six-seat strategy chamber; the Lab contains a microscope, centrifuge and specimens; and the Bridge has restrained pilot seats behind its consoles. Equipment stays outside the main walking routes. The physical hulls differ beyond their proportions: Arrival has an offset docking nose, Archive a stepped data vault, Floor an L-shaped fabrication bay, Lab a specimen lobe, Forum a diagonal strategy annex, Commons a crescent habitat and Bridge a flared observation prow. The same asymmetric polygons drive the floors, walls, roofs, walking bounds and map; equipment follows semantic wall faces rather than assuming eight vertices.

Connecting tubes carry distinct service equipment: oxygen canisters, rescue packs, closed maintenance tables, cartridge racks, inspection recesses, avionics cassettes and shared-atlas diagnostic maps. Wall additions stay within 15 cm of the hull; stair treads and hatch clearances remain free.

Four transfer tubes now have small pressure-glass windows into the real exterior. Each has a framed seal, retaining handles, an operating panel and a two-leaf protective shutter. Window openings replace opaque wall sections; cabinets and service packs respect the same reserved apertures.

## Habitation and working equipment

- **Forum / briefing room:** a larger irregular chamber contains a shaped conference table, six molded seats with cushions, armrests, restraints and footrests, six embedded screens, tablets, cups and secured briefing notes. The table control cycles three synchronized presentations on the main display and seat screens. A supported pendant matches the pooled overhead lamp.
- **Commons / bathroom:** a separate rounded sliding privacy door opens to a compact washroom with basin, faucet, polished-metal mirror, dispenser, towel, vacuum toilet, suction hose and foot restraints. Controls work from both sides of the door. The door holds open around an occupied sill; the partition blocks interaction through its walls. Washing produces a timed water stream and recovered-water readout. Flushing seals the lid, transfers the contents and purges the system before reopening.
- **Floor / machinery bay:** twin compressors, pumps, hand valves, heat-exchanger fins, visible fans, coolant lines and return ducts occupy a larger service alcove. The plant console switches between standby, cabin cooling and filter purge.
- **Every module:** restrained fabric packs, seams, straps, carabiners, handrails, personal items and safety equipment add a lived-in layer. The Bridge has a working ventilation impeller and a sliding filter cassette. Two locally shipped CC0 fabric maps add woven normal and roughness detail; [asset provenance](docs/habitation-asset-credit.md) records their author and license.

The deck directory includes briefing, bathroom and machinery destinations. Local guidance avoids real furniture on entry and exit. These are fictional ship amenities, separate from the seven sourced Sentient knowledge signals. Eleven new controls use E or an aimed click. Three new fixture positions reuse the existing six active lights; the default graphics budget is unchanged.

`npm run test:habitation` checks the eleven controls, physical window/shutter occlusion, bathroom entry/exit, timed wash and flush cycles, briefing synchronization, ventilation, asset loading and furniture-aware navigation. Unit tests also cover privacy-door safety, fixture bounds, interaction occlusion and service-state transitions.

Performance is the default quality on desktop and mobile. It renders directly without shadow maps, ambient occlusion or bloom, using six nearby practical lamps and two screen lights. Balanced and High are optional settings that add local shadows, window sunlight, contact shading and bloom with a bounded shadow budget. Distinct surface roughness brings out seams, equipment depth and metal edges in every mode.

Hatches have seven mechanical identities: padded cargo leaves, segmented archive vaults, braced fabrication doors, glazed laboratory portholes, botanical relief, communications panels and double-collar command airlocks. Both entrances on the Bridge connection carry dark segmented armor and oversized 07 markings; every door retains automatic opening and its clear walking aperture.

The exploration loop maps seven Sentient rooms to seven collectible terminal signals. The live map shows actual module footprints, stairs, elevations and a route to the chosen terminal.

The room names and functions come from the existing Sentient Hub, with supporting company content and brand assets from the Sentient Website. See [the research and source mapping](docs/SENTIENT-RESEARCH.md).

## Living station expansion

Audio starts after entering the station. Footsteps follow actual walking distance, doors and controls emit spatial cues, and machinery sits under a procedural musical score. Seven department motifs share a harmonic palette and crossfade as you change rooms. Airlock, exterior helmet audio and the cupola have their own profiles. The sound button mutes everything and remembers the choice. Audio uses a fixed pool of voices with no network audio files.

Seven operable department panels control a suit test, archive core, fabrication carriage, specimen scanner, tactical model, hydroponic cycle and orbital tracker. Aim at a screen and click, or approach and press E. The visible instruments, indicator lights and screens react. These are fictional local simulations.

- **Arrival → A1 airlock:** the east hatch leads to the suit bay. Operate the pressure console, wait for depressurization, then walk through the exterior hatch. The outer and inner hatches are interlocked. Return to the bay and cycle again to restore cabin pressure.
- **EVA gantry:** magnetic boots keep movement on the gold-railed exterior catwalk. Explore solar wings, radiator assemblies, thermal panels and a wider lookout platform; return by the same route.
- **Forum 05 → lower cupola:** press E beside the round floor hatch. It opens for an animated ladder descent to a spherical glass observation deck 4.8 metres below Forum. A transparent nadir floor overlooks the alien mineral planet Pelagia. Eight tapered pressure arches, glazing gaskets, an overhead service ring, restrained perch seats and a supported survey console frame the view. Click the survey screen to cycle mineral, thermal and atmospheric channels, or use the ladder control to climb back.

The map includes all three destinations and shows the lower deck under Forum. A translation-independent sky contains 15,600 distant stars. Pelagia has violet mineral plates, copper terraces, luminous canyon faults, mineral haze, a solar terminator and a tilted dusty ring. Its surface is baked once; the planet adds no dynamic lamps. The planetary orbit is represented in the station's reference frame, rather than simulated orbital dynamics. New extension lamps reuse the same six-light pool; Performance still allocates no shadow/AO/bloom buffers.

`npm run test:expansion` verifies the real two-way airlock journey, cupola descent/ascent, all seven clickable panels, map destinations, room audio and rendering. `npm run test:audio` runs standalone real Web Audio tests (gesture unlocking, audible output, spatial cues, profile changes, fixed allocations, muting and disposal). Set `AUDIO_GAME_URL=http://127.0.0.1:5173` to include mute preference persistence in the game UI.

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

`npm run test:architecture` checks physical access into every new hull extension with actual furniture bounds and captures all seven room profiles, connecting halls and map.

`npm run test:lighting` checks lighting quality settings and captures matched room views. `node tests/doors.mjs` captures all seven closed hatch designs in the default Performance mode. `npm run test:quarters` verifies department equipment, collision bounds and all 49 department routes, then captures the plants, instruments, meeting station, fabrication arm, pilot seats and other props.

## Controls

| Action | Control |
| --- | --- |
| Move | W A S D or arrow keys |
| Look | Mouse or click and drag |
| Sprint | Shift |
| Operate control / scan terminal / use hatch | E |
| Operate an aimed screen | Left click |
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
