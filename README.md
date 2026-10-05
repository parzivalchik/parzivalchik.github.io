# parzivalchik.github.io

Personal portfolio of Amiraly Bekturganov: FTC robotics software, Platapus Pathing, and other projects.

Live at https://parzivalchik.github.io

## Structure

```
index.html            page content
css/style.css         all styles (one dark theme, tokens at the top)
js/main.js            entry point, imports the modules below
js/util.js            shared helpers: element lookup, theme colours, reduced-motion flag
js/trophies.js        trophy list, toast and counter
js/ui.js              menu, copy-email button, heading decode effect
js/background.js      ASCII field background: steering robots, cursor trail, waypoints, live status panel
js/turret-demo.js     field-locked turret demo (same maths as the DECODE TeleOp)
```

Plain HTML, CSS and ES modules, no build step. To preview locally, serve the folder
(for example `python3 -m http.server`) rather than opening the file directly, because
browsers block ES modules on `file://`.
