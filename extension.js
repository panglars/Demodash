import Clutter from "gi://Clutter";
import GLib from "gi://GLib";
import GObject from "gi://GObject";
import Shell from "gi://Shell";
import St from "gi://St";

import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import * as Dash from "resource:///org/gnome/shell/ui/dash.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";

const PANEL_BOXES = new Set(["left", "center", "right"]);

function getPanelIndex(settings) {
    const index = settings.get_int("panel-index");

    return Math.max(0, index);
}

function getPanelBox(settings) {
    const box = settings.get_string("panel-box");

    if (PANEL_BOXES.has(box)) return box;

    return "left";
}

function isCtrlPressed(modifiers) {
    return (modifiers & Clutter.ModifierType.CONTROL_MASK) !== 0;
}

function getOpacity(settings, key, fallback) {
    const value = settings.get_int(key);

    return Math.max(0, Math.min(255, value ?? fallback));
}

const DashPanel = GObject.registerClass(
    class DashPanel extends Dash.Dash {
        _init(settings) {
            super._init();

            this._settings = settings;

            this.remove_child(this._dashContainer);

            this._box.connectObject(
                "child-added",
                (_box, item) => {
                    this._ensureItem(item);
                    this._syncItem(item);
                },
                this,
            );

            global.workspace_manager.connectObject(
                "active-workspace-changed",
                () => this._syncVisualState(),
                this,
            );

            this._syncSettings();
        }

        _getItems() {
            return this._box?.get_children() ?? [];
        }

        _ensureItem(item) {
            if (!item?.child?._dot) return;

            if (item._demodashInitialized) {
                this._ensureIndicator(item);
                this._applyItemStyle(item);
                this._syncIndicator(item);
                this._syncItemHoverLabel(item);
                return;
            }

            item._demodashInitialized = true;

            item.child.add_style_class_name("demodash-icon");
            item.label?.add_style_class_name("demodash-hover-label");

            this._ensureIndicator(item);
            this._applyItemStyle(item);

            if (this._settings.get_boolean("smart-activate"))
                item.child.activate = (button) =>
                    this._handleActivate(button, item);

            item.child.app?.connectObject(
                "notify::state",
                () => {
                    this._syncItem(item);
                },
                this,
            );

            item.child._dot?.connectObject(
                "notify::visible",
                () => this._hideItemDot(item),
                this,
            );
            item.label?.connectObject(
                "notify::visible",
                () => this._syncItemHoverLabel(item),
                this,
            );
        }

        _ensureIndicator(item) {
            const dot = item?.child?._dot;
            const dotParent = dot?.get_parent();

            if (!dot || !dotParent) return;

            if (item._demodashIndicator?.get_parent() === dotParent) return;

            item._demodashIndicator?.destroy();

            const indicator = new St.Widget({
                reactive: false,
                can_focus: false,
                visible: false,
                x_expand: true,
                y_expand: true,
                x_align: Clutter.ActorAlign.CENTER,
                y_align: Clutter.ActorAlign.END,
                style_class: "app-grid-running-dot demodash-indicator",
            });

            dotParent.insert_child_above(indicator, dot);
            item._demodashIndicator = indicator;
        }

        _applyItemStyle(item) {
            const margin = this._settings.get_int("button-margin");

            item.child.set_style(
                `margin-left: ${margin}px; margin-right: ${margin}px;`,
            );
            this._syncIndicatorLayout(item);
            this._hideItemDot(item);
        }

        _syncSettings() {
            this.iconSize = this._settings.get_int("icon-size");
            this._syncShowAppsButton();

            for (const item of this._getItems()) {
                this._ensureItem(item);
                this._syncItem(item);
            }

            this._queueRedisplay();
        }

        _syncShowAppsButton() {
            this.showAppsButton.track_hover = true;
            this.showAppsButton.add_style_class_name(
                "demodash-show-apps-button",
            );
            this._showAppsIcon.icon.setIconSize(this.iconSize);
            this._dashContainer.set_child_at_index(
                this.showAppsButton.get_parent(),
                0,
            );

            if (this._settings.get_boolean("show-apps")) {
                this.showAppsButton.show();
                this.showAppsButton.connectObject(
                    "notify::checked",
                    () => {
                        if (Main.overview.visible) Main.overview.hide();
                        else Main.overview.showApps();
                    },
                    this,
                );
            } else {
                this.showAppsButton.hide();
            }
        }

        _syncItem(item) {
            this._syncItemVisibility(item);
            this._syncItemOpacity(item);
            this._syncIndicator(item);
            this._syncItemHoverLabel(item);
        }

        _syncVisualState() {
            for (const item of this._getItems()) {
                this._syncItemVisibility(item);
                this._syncItemOpacity(item);
                this._syncIndicator(item);
            }
        }

        _syncItemVisibility(item) {
            if (!item?.child?.app) return;

            const onlyRunning = this._settings.get_boolean("show-running");
            item.visible =
                !onlyRunning || item.child.app.state === Shell.AppState.RUNNING;
        }

        _syncItemOpacity(item) {
            if (!item?.child?.app) return;

            const app = item.child.app;
            const activeWorkspace =
                global.workspace_manager.get_active_workspace();
            const isRunning = app.state === Shell.AppState.RUNNING;
            const isOnActiveWorkspace =
                isRunning && app.is_on_workspace(activeWorkspace);

            this._hideItemDot(item);

            if (isRunning && isOnActiveWorkspace) {
                item.child.set_opacity(255);
                return;
            }

            item.child.set_opacity(
                getOpacity(this._settings, "inactive-icon-opacity", 255),
            );
        }

        _syncIndicator(item) {
            const indicator = item?._demodashIndicator;
            const app = item?.child?.app;

            if (!indicator || !app) return;

            this._syncIndicatorLayout(item);

            const activeWorkspace =
                global.workspace_manager.get_active_workspace();
            const isRunning = app.state === Shell.AppState.RUNNING;
            const isOnActiveWorkspace =
                isRunning && app.is_on_workspace(activeWorkspace);

            indicator.remove_style_class_name("demodash-indicator-active");

            if (!isRunning) {
                indicator.set_style(this._getIndicatorLayoutStyle());
                indicator.hide();
                return;
            }

            if (isOnActiveWorkspace) {
                indicator.set_style(this._getIndicatorLayoutStyle());
                indicator.add_style_class_name("demodash-indicator-active");
            } else {
                indicator.set_style(this._getInactiveIndicatorStyle(item));

                if (
                    !this._settings.get_boolean(
                        "inactive-indicator-default-color",
                    )
                )
                    indicator.add_style_class_name("demodash-indicator-active");
            }

            indicator.show();
        }

        _syncIndicatorLayout(item) {
            const indicator = item?._demodashIndicator;

            if (!indicator) return;

            const width = Math.max(8, Math.round(this.iconSize));
            const height = Math.max(3, Math.round(this.iconSize / 6));

            indicator.set_size(width, height);
            indicator.translation_y = 2;
        }

        _getInactiveIndicatorStyle(item) {
            if (!this._settings.get_boolean("inactive-indicator-default-color"))
                return this._getIndicatorLayoutStyle();

            const color = item?.child?._dot
                ?.get_theme_node()
                ?.get_background_color();

            if (!color) return this._getIndicatorLayoutStyle();

            return `${this._getIndicatorLayoutStyle()} background-color: rgba(${color.red}, ${color.green}, ${color.blue}, ${color.alpha / 255});`;
        }

        _getIndicatorLayoutStyle() {
            const width = Math.max(8, Math.round(this.iconSize));
            const height = Math.max(3, Math.round(this.iconSize / 6));
            const radius = Math.round(height);

            return `width: ${width}px; height: ${height}px; border-radius: ${radius}px ${radius}px 0 0;`;
        }

        _hideItemDot(item) {
            if (!item?.child?._dot) return;

            item.child._dot.set_opacity(0);
            item.child._dot.hide();
        }

        _syncItemHoverLabel(item) {
            if (!item?.label) return;

            if (!this._settings.get_boolean("show-hover-label")) {
                this._clearLabelTimeout(item);
                item.label.translation_y = 0;

                if (item.label.visible) item.label.hide();

                return;
            }

            if (item.label.visible) this._queueLabelPosition(item);
        }

        _queueLabelPosition(item) {
            this._clearLabelTimeout(item);

            item._demodashLabelTimeoutId = GLib.idle_add(
                GLib.PRIORITY_DEFAULT_IDLE,
                () => {
                    item._demodashLabelTimeoutId = null;
                    this._positionLabel(item);

                    return GLib.SOURCE_REMOVE;
                },
            );
        }

        _clearLabelTimeout(item) {
            if (!item?._demodashLabelTimeoutId) return;

            GLib.Source.remove(item._demodashLabelTimeoutId);
            item._demodashLabelTimeoutId = null;
        }

        _positionLabel(item) {
            if (!item?.label?.visible) return;

            const label = item.label;
            const scaleFactor = global.display.get_monitor_scale(
                global.display.get_primary_monitor(),
            );
            const yOffset = label.get_theme_node().get_length("-y-offset");

            label.translation_y =
                2 * label.height +
                2 * yOffset +
                (Main.panel.height - 32) / scaleFactor;
        }

        _handleActivate(button, item) {
            const app = item?.child?.app;

            if (!app) return;

            const event = Clutter.get_current_event();
            const modifiers = event ? event.get_state() : 0;
            const openNewWindow =
                app.can_open_new_window() &&
                app.state === Shell.AppState.RUNNING &&
                (button === Clutter.BUTTON_MIDDLE || isCtrlPressed(modifiers));

            if (app.state === Shell.AppState.STOPPED || openNewWindow)
                item.child.animateLaunch();

            if (openNewWindow) {
                app.open_new_window(-1);
                Main.overview.hide();
                return;
            }

            if (this._settings.get_boolean("cycle-windows"))
                this._cycleAppWindows(app);
            else this._activateOrMinimizeApp(app);

            Main.overview.hide();
        }

        _activateOrMinimizeApp(app) {
            const focusedApp = Shell.WindowTracker.get_default().focus_app;
            const focusedWindow = global.display.focus_window;

            if (focusedApp === app && focusedWindow?.can_minimize()) {
                focusedWindow.minimize();
                return;
            }

            app.activate();
        }

        _cycleAppWindows(app) {
            const activeWorkspace =
                global.workspace_manager.get_active_workspace();
            const windows = app
                .get_windows()
                .filter(
                    (window) =>
                        !window.is_override_redirect() &&
                        !window.is_attached_dialog() &&
                        window.located_on_workspace(activeWorkspace),
                )
                .sort(
                    (windowA, windowB) => windowA.get_id() - windowB.get_id(),
                );

            if (windows.length === 0) {
                app.activate();
                return;
            }

            if (windows.length === 1) {
                const [window] = windows;

                if (window.has_focus() && window.can_minimize())
                    window.minimize();
                else window.activate(global.get_current_time());

                return;
            }

            const focusedIndex = windows.findIndex((window) =>
                window.has_focus(),
            );

            if (focusedIndex === -1) {
                app.activate();
                return;
            }

            const nextIndex = (focusedIndex + 1) % windows.length;
            app.activate_window(windows[nextIndex], global.get_current_time());
        }

        getContainer() {
            return this._dashContainer;
        }

        destroy() {
            for (const item of this._getItems()) {
                this._clearLabelTimeout(item);
                item._demodashIndicator?.destroy();
                item._demodashIndicator = null;
                item.child?.disconnectObject(this);
                item.child?.app?.disconnectObject(this);
                item.child?._dot?.disconnectObject(this);
                item.label?.disconnectObject(this);
            }

            global.workspace_manager.disconnectObject(this);
            this._box?.disconnectObject(this);
            this.showAppsButton.disconnectObject(this);

            super.destroy();
        }
    },
);

const DashButton = GObject.registerClass(
    class DashButton extends PanelMenu.Button {
        _init(settings) {
            super._init(0.0, "Demo Dash", false);

            this.reactive = false;
            this.can_focus = false;
            this.track_hover = false;

            this._dash = new DashPanel(settings);
            this._dashContainer = this._dash.getContainer();
            this.add_child(this._dashContainer);

            if (settings.get_boolean("scroll-workspaces")) {
                this._dashContainer.reactive = true;
                this._dashContainer.connectObject(
                    "scroll-event",
                    (_actor, event) => {
                        return Main.wm.handleWorkspaceScroll(event);
                    },
                    this,
                );
            }
        }

        destroy() {
            this._dashContainer?.disconnectObject(this);
            this._dashContainer = null;

            this._dash?.destroy();
            this._dash = null;

            super.destroy();
        }
    },
);

export default class DemoDashExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._createDashButton();

        this._settings.connectObject(
            "changed",
            () => this._reloadDashButton(),
            this,
        );
        Main.layoutManager.connectObject(
            "monitors-changed",
            () => this._reloadDashButton(),
            this,
        );
    }

    _createDashButton() {
        this._dashButton = new DashButton(this._settings);
        Main.panel.addToStatusArea(
            this.uuid,
            this._dashButton,
            getPanelIndex(this._settings),
            getPanelBox(this._settings),
        );
    }

    _reloadDashButton() {
        this._dashButton?.destroy();
        this._createDashButton();
    }

    disable() {
        this._settings?.disconnectObject(this);
        Main.layoutManager.disconnectObject(this);

        this._dashButton?.destroy();
        this._dashButton = null;
        this._settings = null;
    }
}
