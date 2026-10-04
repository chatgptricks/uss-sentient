# Sentient research for USS Sentient

Local sources reviewed on October 4, 2026. These files document seven **functional zones**, not a formal HR department chart. The game preserves their names and primarily follows the internal Hub functions.

The current deliverable is a detailed, navigable ISS-inspired station developed from the user-approved layout: enclosed off-white modules, asymmetric circulation, four deck heights and a neon star visible through framed windows. Imported equipment, physical controls and department-specific instruments enrich the approved pressure-hull structure.

## Room mapping

| Zone | Internal Hub function | Supporting public website story | Fictional station adaptation |
| --- | --- | --- | --- |
| 01 · The Front Door | Accounts & Network View; Sentient Accounts | Network introduction, flagship accounts and client roster | Arrival & network; Network signal |
| 02 · The Floor | Production Tools & Utilities; Maxx Tools, visualizers, Chart Animator, Schedulr, Social Brain, Posts Production Library, Battle Giveaway, QR-generator recovery slot | Viral promotional campaigns, brand growth, private community and founder consulting | Production deck; Creation signal |
| 03 · The Archive | Intelligence & Evidence; Cortex, Tricks Dash, case studies, AI Safety Desk, BCCR FX Intelligence, Slack Link Catcher | Campaign results and client testimony | Intelligence vault; Insight signal |
| 04 · The Commons | Account Decks & Shared Rooms; a reserved Canva deck directory | Creator network across Instagram, X, LinkedIn, TikTok and YouTube | Network commons; Connection signal |
| 05 · The Forum | Use Cases & Playbooks; ChatGPT at Work, Prompt Hub and Content Formats | Mission, founders, people and presence | Strategy forum; Strategy signal |
| 06 · The Lab | Client Builds & Experiments; NEO Solutions | Strategic Setup → Content That Converts → Guaranteed Distribution → Track & Scale | Experimental systems; Innovation signal |
| 07 · The Bridge | Leadership & Portfolio; Sentient Promos CRM | Strategy intake, contact, community and legal information | Command & portfolio; Direction signal |

## Exact provenance

Primary internal sources:

- `/Users/tbnalfaro/Developer/Codex Projects/18 Sentient Hub/README.md` — describes the internal seven-zone experience.
- `/Users/tbnalfaro/Developer/Codex Projects/18 Sentient Hub/app/hub-data.ts` — canonical internal room names, functions, descriptions and project cards.
- `/Users/tbnalfaro/Developer/Codex Projects/18 Sentient Hub/PROJECT_INVENTORY.md` — room-by-room project inventory, audit date **July 16, 2026**. Its historical deployment states and account counts are not asserted as current in this game.

Supporting public sources:

- `/Users/tbnalfaro/Developer/Codex Projects/19 Sentient Website/README.md` — seven-room public story mapping and migration provenance.
- `/Users/tbnalfaro/Developer/Codex Projects/19 Sentient Website/app/hub-data.ts` — service descriptions, creator-network story, team, campaign process and strategy intake. These public-story exhibits supplement, rather than replace, the internal room functions.

## Brand

The website's `/Users/tbnalfaro/Developer/Codex Projects/19 Sentient Website/app/globals.css` defines lime `#cfff04`, soft lime `#dcff55`, near-black `#050505` and off-white `#f5f5ef`. The internal Hub has the closely related lime `#cfff1a` and soft lime `#b6dd26`. USS Sentient uses the public website palette.

The website uses Space Grotesk, configured in `19 Sentient Website/app/layout.tsx`, with local Regular, Medium, SemiBold and Bold TTFs under `/Users/tbnalfaro/Developer/Codex Projects/19 Sentient Website/app/fonts/`.

Local brand marks are under `/Users/tbnalfaro/Developer/Codex Projects/19 Sentient Website/public/site/`: `sentient-logo.svg`, `sentient-mark-green.svg` and `sentient-mark-white.svg`. Both source projects also contain `public/sentient-agency-map.png`, the original isometric room illustration.

## Fiction and factual boundaries

The USS Sentient, its orbit around a neon-lime star, station architecture, room coordinates, sci-fi designations, scan objectives and collectible signals are game fiction. The enclosed spacecraft uses off-white modules of different sizes in an asymmetric layout, with Sentient lime accents. The Front Door is a compact arrival module. The Bridge contains the principal cupola view of the star, with small portholes elsewhere. The station interprets the documented functional map; it does not represent a real facility or a verified organizational chart.

Tools listed in the game are sourced exhibits. Their inclusion does not claim a current public deployment, active integration or access to live company data. The account-deck directory and QR-generator recovery slot retain their documented placeholder nature. No July audience counts, service guarantees or dated deployment states are presented as current facts. The game does not connect to or alter company systems.

Room content is implemented in `src/rooms.js`. The original company projects were read without modification.

## Spacecraft layout references

The user selected the ISS as the primary spatial reference, with the enclosed spacecraft feel of *Ender's Game* as a secondary direction. NASA's [Destiny module](https://www.nasa.gov/international-space-station/destiny-laboratory-module/) informed the enclosed equipment-rack modules; its [Cupola](https://www.nasa.gov/international-space-station/cupola/) informed framed observation windows. The game is an original fictional layout, not an ISS reconstruction. The initial pass prioritized opaque off-white pressure hulls, asymmetric circulation and star sightlines. The later approved detail pass is documented below.


### Modular rebuild / October 4, 2026

The user supplied six visual references: enclosed off-white pressure tunnels, rounded split hatches, circular module junctions, ISS Cupola glazing, dark ribbed corridors, and a curved observation passage. These drive the updated spatial language: octagonal floor plans, a narrow usable aisle, sloping ceiling shoulders, solid hull panels, mechanical hatch frames, and small framed viewing apertures. Only the Bridge receives a larger observation view.

The [Greg Berry film-art gallery for Ender's Game](https://www.gregberry1.com/film/enders-game) was inspected before the rebuild. Its corridor stills (07 and 08) show enclosed off-white hulls, thick structural ribs and integrated conduits. We use that construction language as reference, without reproducing a film set. NASA's [Destiny laboratory overview](https://www.nasa.gov/international-space-station/destiny-laboratory-module/) provides the human-scale module reference, while the [Cupola interior](https://www.nasa.gov/image-article/interior-view-from-international-space-station-cupola/) informs thick frames and limited observation glazing.

The initial playable blockout used 5.6–6.4-metre octagonal modules and 2.25-metre-wide connector shells; the approved pass below varies these dimensions. It is a fictional, walkable adaptation, with gravity and automatic sliding hatches for gameplay. It is not a dimensional or operational reconstruction of the ISS.


### Approved layout detail and elevation pass

Following layout approval, the user requested two substantial detail passes, varied room proportions, a larger Bridge observation deck, real stair/ramp connections and collected 3D props. The layout now has unequal elongated octagonal modules: a docking vestibule, compact archive, broad production workshop, elongated laboratory, transfer junction, habitat Commons and a much larger faceted observation Bridge. Production and Lab sit 1.05 m below the main deck, Commons 0.75 m above, and the Bridge 1.50 m above. Three connectors have actual stair treads; the Commons connection slopes upward.

The original seven functional departments and sourced content remain intact. Equipment readouts, orbital telemetry and life-support hardware are fictional game scenery. Lighting and detail placement preserve readable off-white pressure hulls, dark mechanical recesses and selective Sentient lime accents.
