# DemoDash

## Scope
- GNOME Shell 49+ extension.
- Reuses native `Dash.Dash` and mounts it into the top panel.
- Does not take over existing panel items.

## Main Files
- [`extension.js`](/home/lan/.local/share/gnome-shell/extensions/demodash@panglars/extension.js): dash host, panel mounting, state sync, click behavior, hover label positioning.
- [`prefs.js`](/home/lan/.local/share/gnome-shell/extensions/demodash@panglars/prefs.js): libadwaita preferences UI.
- [`schemas/org.gnome.shell.extensions.demodash.gschema.xml`](/home/lan/.local/share/gnome-shell/extensions/demodash@panglars/schemas/org.gnome.shell.extensions.demodash.gschema.xml): gsettings schema.
- [`stylesheet.css`](/home/lan/.local/share/gnome-shell/extensions/demodash@panglars/stylesheet.css): basic icon, app grid button, and hover label styles.

## Current Behavior
- Keeps native dash ordering. No custom reordering of favorites vs running apps.
- Uses a custom bottom indicator plus icon opacity for app state:
- running on active workspace: accent-colored indicator + full opacity
- running on other workspaces: default-color or accent-colored indicator + `inactive-icon-opacity`
- pinned but stopped: no indicator + `inactive-icon-opacity`
- Force-hides native `_dot`.
- Optional behaviors:
- show app grid button
- show only running apps
- smart activate / minimize
- cycle app windows
- scroll over dash to switch workspaces
- show hover labels below the top panel

## Maintenance Notes
- Recompile schemas after schema edits:
  - `glib-compile-schemas schemas`
- The extension hides native `_dot` and renders its own indicator actor in the same visual area.
- Avoid taking over panel layout or mutating unrelated shell UI.
