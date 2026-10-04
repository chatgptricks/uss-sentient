# Sentient research for USS Sentient

Local sources reviewed on October 4, 2026. These files document seven **functional zones**, not a formal HR department chart. The game preserves their names and primarily follows the internal Hub functions.

The current deliverable is a navigable, ISS-inspired layout blockout for approval: enclosed off-white modules, an asymmetric floor plan and a star visible through windows. Room proportions and circulation are the focus. A detailed asset pass follows layout approval.

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

The USS Sentient, its orbit around a neon-lime star, station architecture, room coordinates, sci-fi designations, scan objectives and collectible signals are game fiction. The enclosed spacecraft uses off-white modules of different sizes in an asymmetric layout, with Sentient lime accents. The Front Door occupies an observation deck, with the star visible through windows. The station interprets the documented functional map; it does not represent a real facility or a verified organizational chart.

Tools listed in the game are sourced exhibits. Their inclusion does not claim a current public deployment, active integration or access to live company data. The account-deck directory and QR-generator recovery slot retain their documented placeholder nature. No July audience counts, service guarantees or dated deployment states are presented as current facts. The game does not connect to or alter company systems.

Room content is implemented in `src/rooms.js`. The original company projects were read without modification.

## Spacecraft layout references

The user selected the ISS as the primary spatial reference, with the enclosed spacecraft feel of *Ender's Game* as a secondary direction. NASA's [Destiny module](https://www.nasa.gov/international-space-station/destiny-laboratory-module/) informed the enclosed equipment-rack modules; its [Cupola](https://www.nasa.gov/international-space-station/cupola/) informed framed observation windows. The game is an original fictional layout, not an ISS reconstruction. The current pass prioritizes opaque off-white pressure hulls, asymmetric circulation and star sightlines. Detailed art and surface treatment await the user's layout approval.
