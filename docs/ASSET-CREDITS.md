# External 3D asset credits

Retrieved October 4, 2026 from the original creator, **Kenney**. These models are included locally; the game does not request an external asset host at runtime.

## Space Station Kit

- Creator and source: [Kenney — Space Station Kit](https://kenney.nl/assets/space-station-kit).
- Official download: [Space Station Kit ZIP](https://kenney.nl/media/pages/assets/space-station-kit/6475288f2e-1712749919/kenney_space-station-kit.zip).
- Included license identifies **Space Station Kit 1.0**, creation date April 10, 2024.
- License: [Creative Commons CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). Original license preserved at `public/models/kenney-space-station/LICENSE.txt`.
- Selected original GLB files: `computer`, `computer-screen`, `computer-system`, `computer-wide`, `display-wall`, `display-wall-wide`, `container`, `container-flat`, `container-flat-open`, `container-wide`, `container-tall`.
- Their required `Textures/colormap.png` is preserved alongside the models.

## Space Kit

- Creator and source: [Kenney — Space Kit](https://kenney.nl/assets/space-kit).
- Official download: [Space Kit ZIP](https://kenney.nl/media/pages/assets/space-kit/20874c75ac-1677698978/kenney_space-kit.zip).
- Included license identifies **Space Kit 2.0**, creation date August 27, 2020.
- License: [Creative Commons CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). Original license preserved at `public/models/kenney-space/LICENSE.txt`.
- Selected original GLB files: `desk_computer`, `desk_computerCorner`, `desk_computerScreen`, `machine_generator`, `machine_generatorLarge`, `machine_wireless`, `machine_barrel`, `barrel`.
- These selected files use material colors and require no external textures.

## Adaptation in USS Sentient

`src/imported-props.js` loads the 19 original GLB files with Three.js `GLTFLoader`. Original geometry and shapes are preserved. Models are centered, scaled uniformly, oriented, and instanced into the station. Raised computers receive original game-authored cabinet supports within their collision footprints. Render-time material substitutions use off-white structural surfaces, graphite trim and lime instrument accents. The Space Station Kit palette texture remains unmodified; a shader recolors it and adds instrument strokes to the original display surfaces.

Placements are fictional station hardware: computers, control consoles, monitors, secured cargo, communications units, generators and resource cartridges. Model names do not establish real Sentient products or operational data. Floor-mounted props receive physical collision bounds; high wall-mounted readouts preserve the walking routes. Kenney does not endorse or sponsor this project.

Only the selected models, their one required texture and license texts are copied into the project. Source archives and unused pack content are not included in the shipped game.

## Optional path tracing

The still-view renderer uses [three-gpu-pathtracer 0.0.24](https://github.com/gkjohnson/three-gpu-pathtracer/tree/v0.0.24) and [three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh), by Garrett Johnson, under the MIT license. Exact dependency versions are retained in the lockfile. The renderer is loaded only when requested; its scene snapshots convert instanced equipment to static geometry and bake the existing Sentient palette and star shader into compatible materials. This is progressive WebGL path tracing, not a claim of dedicated hardware RT acceleration.

Plant geometry, laboratory instruments, strategy furniture, EVA gear and department-specific hatch treatments are authored procedurally for this game. They reuse station materials and batched geometry; they require no external 3D service.

## Habitation materials and modeled fittings

The six-seat conference furniture, vacuum sanitation fittings, machinery rack, pressure-window shutters and secured personal equipment are original procedural meshes. The fabric packs use two CC0 normal/roughness maps from Rob Tuytel's Poly Haven Fabric Pattern 07; [the material provenance record](habitation-asset-credit.md) lists the original source, license, exact files and checksums. All files ship locally under the GitHub Pages base path.
