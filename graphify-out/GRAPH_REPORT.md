# Graph Report - Lunar-Site-Landing  (2026-11-15)

## Corpus Check
- 89 files · ~75,007 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 31 file(s) not represented in the graph (top: .css 21, (none) 6, .csv 2)
- WARNING: 31 of 120 files seen (26%) have no supported extractor and are missing from this graph entirely. It may look complete while representing only part of the codebase.

## Summary
- 548 nodes · 1141 edges · 26 communities (21 shown, 5 thin omitted)
- Extraction: 95% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 49 edges (avg confidence: 0.83)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Aplicación Oddity (React)
- Datos LOLA y superficie Cesium
- Servicio lunar (API Python)
- Planificación y visibilidad
- Dependencias del proyecto
- Globo y luna de alta calidad
- CLI lunar_navigator
- Informes y documentación
- Microrrelieve sintético
- Explorador MOON (App)
- Cámara de primera persona
- Imagen base lunar (foto3)
- Escena Luna 3D
- PDF del plan de misión
- Render módulo HLS (foto2)
- Render módulo lunar (foto4)
- Informe de validación Apollo
- Foto amerizaje Apollo
- Foto módulo lunar Apollo
- Render lander (foto1)
- Foto exploración lunar
- Lanzamiento Saturn V
- Logo Oddity

## God Nodes (most connected - your core abstractions)
1. `PlanningPanel()` - 23 edges
2. `react` - 22 edges
3. `DetailImageryProvider` - 21 edges
4. `FirstPersonController` - 18 edges
5. `evaluate_terrain()` - 16 edges
6. `MoonSurface()` - 16 edges
7. `App()` - 15 edges
8. `MatrixHeading()` - 15 edges
9. `command_compare_periods()` - 14 edges
10. `lucide-react` - 13 edges

## Surprising Connections (you probably didn't know these)
- `Oddity app shell (index.html)` --references--> `Favicon SVG`  [EXTRACTED]
  index.html → public/favicon.svg
- `Lunar Atlas NASA Trek page (moon/index.html)` --references--> `Favicon SVG`  [EXTRACTED]
  moon/index.html → public/favicon.svg
- `query_scene()` --indirect_call--> `query_horizons()`  [INFERRED]
  lunar_api.py → scripts/precompute_apollo_scenes.py
- `SurfaceScreen()` --calls--> `useSurfaceExplorer()`  [EXTRACTED]
  src/componentes/superficie/SurfaceScreen.jsx → moon/src/surface/useSurfaceExplorer.jsx
- `Landing-Site-Simulator README` --references--> `/pds same-origin proxy to PDS geosciences`  [EXTRACTED]
  README.md → moon/README.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Apollo landing validation records** — data_validation_report_apollo_11, data_validation_report_apollo_12, data_validation_report_apollo_14, data_validation_report_nssdca [INFERRED 0.75]
- **MOON first-person surface stack** — moon_readme_first_person_view, moon_readme_cesium, moon_readme_lola_elevation, moon_readme_pds_proxy, moon_readme_microrelief [INFERRED 0.75]
- **Site visibility computation pipeline** — readme_visibility_day_api, readme_nasa_jpl_horizons, readme_lola_terrain, data_visibility_report_terrain_horizon, data_visibility_report [INFERRED 0.75]
- **Apollo splashdown recovery scene** — public_images_timeline_apollo_splashdown_command_module, public_images_timeline_apollo_splashdown_flotation_collar, public_images_timeline_apollo_splashdown_recovery_raft, public_images_timeline_apollo_splashdown_recovery_crew [INFERRED 0.85]
- **Crewed lunar landing scene: lander, astronauts and surface equipment** — src_foto2_hls_lander, src_foto2_astronauts, src_foto2_surface_equipment [INFERRED 0.75]
- **Lunar base infrastructure ensemble** — src_foto3_habitat_modules, src_foto3_lander_vehicle, src_foto3_pressurized_rover, src_foto3_solar_array, src_foto3_comms_antenna, src_foto3_landing_pad [INFERRED 0.85]

## Communities (26 total, 5 thin omitted)

### Community 0 - "Aplicación Oddity (React)"
Cohesion: 0.05
Nodes (47): framer-motion, lucide-react, react, App(), OddityLogo(), PanelActions(), StarField(), CreditosScreen() (+39 more)

### Community 1 - "Datos LOLA y superficie Cesium"
Cohesion: 0.06
Nodes (37): cachedWindows, distanceKm(), findPart(), indexOfHeaderEnd(), latLabel(), loadLolaWindow(), loadLolaWindowCached(), pad() (+29 more)

### Community 2 - "Servicio lunar (API Python)"
Cohesion: 0.09
Nodes (28): cache_key(), cached_scene(), find_alternative_dates(), find_alternative_locations(), make_scene(), NavigatorHandler, parse_request(), query_horizons_range() (+20 more)

### Community 3 - "Planificación y visibilidad"
Cohesion: 0.08
Nodes (46): MatrixHeading(), MatrixTitleText(), horizonsLongitude(), parseVisibilityDay(), PlanningPanel(), areaRadii, ChoiceGroup(), CrewStep() (+38 more)

### Community 4 - "Dependencias del proyecto"
Cohesion: 0.07
Nodes (34): dependencies, cesium@^1.147.0, framer-motion@^11.11.17, jspdf@^4.2.1, lucide-react@^0.468.0, react@^18.3.1, react-dom@^18.3.1, @react-three/drei@^9.122.0 (+26 more)

### Community 5 - "Globo y luna de alta calidad"
Cohesion: 0.12
Nodes (31): createTerrainGeometry(), directionFromLatLon(), elevationLayer, GLOBE_RADIUS, GLOBE_ROTATION, imageryLayer, latLonFromDirection(), cachedProgress (+23 more)

### Community 6 - "CLI lunar_navigator"
Cohesion: 0.16
Nodes (19): check_range(), clipped_segments(), command_catalog(), command_compare_periods(), command_compare_sites(), iso(), joint_visible_seconds(), load_catalog() (+11 more)

### Community 7 - "Informes y documentación"
Cohesion: 0.10
Nodes (28): Lunar visibility report for Site 04 center, Earth visibility (no visible samples), Horizons ephemeris and MOON_ME observer frame, LOLA 5 m polar DEM Site04, Shackleton edge Site 04 center, Sun visible windows Nov 2026 to Feb 2027, Terrain horizon profile (5000 m radius, 1 degree azimuth), Oddity app shell (index.html) (+20 more)

### Community 8 - "Microrrelieve sintético"
Cohesion: 0.17
Nodes (14): CRATER_DIAMETERS, CRATER_PROBABILITY, createMicroRelief(), albedoNoise(), height(), FBM_WAVELENGTHS, hash2(), quintic() (+6 more)

### Community 9 - "Explorador MOON (App)"
Cohesion: 0.20
Nodes (11): App(), Icon(), initialProgress, MoonScene, nacSites, qualityOptions, SurfaceExplorer(), WalkButton() (+3 more)

### Community 11 - "Imagen base lunar (foto3)"
Cohesion: 0.22
Nodes (13): NASA Artemis lunar program (concept), Two astronauts in spacesuits, Cargo crates and storage containers, Communications dish antenna on mast, Earth visible in lunar sky, Pressurized habitat modules, White crewed lander on landing pad, Paved landing pad with circular markings (+5 more)

### Community 12 - "Escena Luna 3D"
Cohesion: 0.33
Nodes (10): HighQualityMoon(), Lighting(), SunLight(), CustomMarker(), getMoonPosition(), MissionMarker(), Moon(), MoonModel() (+2 more)

### Community 13 - "PDF del plan de misión"
Cohesion: 0.40
Nodes (9): COLORS, downloadMissionPlanPdf(), drawBackground(), drawContinuationHeader(), drawField(), drawVisibility(), getFieldLayout(), loadImageData() (+1 more)

### Community 14 - "Render módulo HLS (foto2)"
Cohesion: 0.36
Nodes (8): Two spacesuited astronauts on the surface, Earth seen from the Moon, HLS lunar lander (Human Landing System), Lunar lander and astronauts render (foto2.jpeg), Lunar surface (regolith, craters, ridges), NASA logo (meatball), SpaceX logo, Surface equipment (tripod cameras, cases, cables)

### Community 15 - "Render módulo lunar (foto4)"
Cohesion: 0.38
Nodes (7): Communications antenna mast, Hovering cylindrical module with engine plume, Boarding ladder/ramp of the lander, Crewed lunar lander on the surface, Lunar landing scene (CGI render), Wheeled lunar rover with camera mast, Lunar regolith surface with rocks

### Community 16 - "Informe de validación Apollo"
Cohesion: 0.53
Nodes (6): Documentary validation report, Apollo 11 landing record (adopted NSSDCA 20:17:40 UT over NASA 20:17:39 GMT), Apollo 12 landing record, Apollo 14 landing record, NASA Apollo 11 historical summary, NSSDCA mission sheets and lunar module coordinate table

### Community 17 - "Foto amerizaje Apollo"
Cohesion: 0.47
Nodes (6): Apollo Command Module (floating after splashdown), Inflatable flotation collar, Apollo splashdown recovery photo, Recovery crew and astronauts in raft, Inflatable recovery raft, Stabilization bags (likely uprighting bags)

### Community 18 - "Foto módulo lunar Apollo"
Cohesion: 0.40
Nodes (6): Lunar module surface photo, Astronaut in white spacesuit, Monochrome halftone scan or TV-still look, Lunar module (spacecraft structure), Round window or hatch on lunar module, Vertical strut or leg structure

### Community 19 - "Render lander (foto1)"
Cohesion: 0.40
Nodes (6): Lunar lander render (foto1), Earth visible in starry sky, Intuitive Machines lunar lander, Lander landing legs with blue-tipped struts, Cratered lunar surface, Gold propellant tank

### Community 20 - "Foto exploración lunar"
Cohesion: 0.83
Nodes (4): Lunar exploration timeline photo, Astronaut in white spacesuit on lunar surface, Lunar lander landing leg with footpad, Lunar regolith surface with footprints

### Community 21 - "Lanzamiento Saturn V"
Cohesion: 0.67
Nodes (3): Saturn V launch photograph (black and white), Large white exhaust plume trailing the rocket, Saturn V-class rocket ascending (identified from filename)

## Ambiguous Edges - Review These
- `Apollo Command Module (floating after splashdown)` → `Stabilization bags (likely uprighting bags)`  [AMBIGUOUS]
  public/images/timeline/apollo-splashdown.jpg · relation: references
- `Lunar module surface photo` → `Monochrome halftone scan or TV-still look`  [AMBIGUOUS]
  public/images/timeline/lunar-module-surface.jpg · relation: references
- `Crewed lunar lander on the surface` → `Hovering cylindrical module with engine plume`  [AMBIGUOUS]
  src/foto4.jpeg · relation: conceptually_related_to

## Knowledge Gaps
- **31 isolated node(s):** `data/apollo_scenes.json precomputed Apollo evaluations`, `lunar_navigator.py console CLI`, `Site 04`, `Vite /api proxy to 127.0.0.1:8000`, `NASA Apollo 11 historical summary` (+26 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 148 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `Aplicación Oddity (React)` to `Datos LOLA y superficie Cesium`, `Planificación y visibilidad`, `Dependencias del proyecto`, `Globo y luna de alta calidad`, `Explorador MOON (App)`, `Escena Luna 3D`?**
  _High betweenness centrality (0.225) - this node is a cross-community bridge._
- **What connects `data/apollo_scenes.json precomputed Apollo evaluations`, `lunar_navigator.py console CLI`, `Site 04` to the rest of the system?**
  _31 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Aplicación Oddity (React)` be split into smaller, more focused modules?**
  _Cohesion score 0.05220883534136546 - nodes in this community are weakly interconnected._
- **Why does `FirstPersonController` connect `Cámara de primera persona` to `Datos LOLA y superficie Cesium`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **Should `Datos LOLA y superficie Cesium` be split into smaller, more focused modules?**
  _Cohesion score 0.0579476861167002 - nodes in this community are weakly interconnected._

### Low-confidence Hints
_AMBIGUOUS edges — the extractor was unsure. Verify before acting on these._

- **What is the exact relationship between `Apollo Command Module (floating after splashdown)` and `Stabilization bags (likely uprighting bags)`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `Lunar module surface photo` and `Monochrome halftone scan or TV-still look`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._