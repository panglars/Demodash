import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

function addSwitch(group, settings, key, title, subtitle = null) {
    const row = new Adw.SwitchRow({
        title,
        subtitle,
    });

    group.add(row);
    settings.bind(key, row, 'active', Gio.SettingsBindFlags.DEFAULT);
}

function addSpin(group, settings, key, title, subtitle, lower, upper) {
    const adjustment = new Gtk.Adjustment({
        lower,
        upper,
        step_increment: 1,
    });

    const row = new Adw.SpinRow({
        title,
        subtitle,
        adjustment,
    });

    group.add(row);
    settings.bind(key, row, 'value', Gio.SettingsBindFlags.DEFAULT);
}

function addPanelBoxCombo(group, settings) {
    const model = Gtk.StringList.new([
        'Left',
        'Center',
        'Right',
    ]);
    const values = ['left', 'center', 'right'];
    const currentValue = settings.get_string('panel-box');
    let selected = values.indexOf(currentValue);

    if (selected === -1)
        selected = 0;

    const row = new Adw.ComboRow({
        title: 'Panel side',
        subtitle: 'Choose which panel box hosts the dash',
        model,
        selected,
    });

    row.connect('notify::selected', () => {
        settings.set_string('panel-box', values[row.selected] ?? 'left');
    });

    group.add(row);
}

export default class DemoDashPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        const page = new Adw.PreferencesPage({
            title: 'Demo Dash',
            icon_name: 'view-app-grid-symbolic',
        });
        window.add(page);

        const layoutGroup = new Adw.PreferencesGroup({
            title: 'Layout',
        });
        page.add(layoutGroup);

        addPanelBoxCombo(layoutGroup, settings);
        addSpin(layoutGroup, settings, 'panel-index', 'Panel index', 'Sort position inside the selected panel box', 0, 20);
        addSpin(layoutGroup, settings, 'icon-size', 'Icon size', 'Size of dash icons in pixels', 16, 64);
        addSpin(layoutGroup, settings, 'button-margin', 'Button margin', 'Horizontal margin for each app button', 0, 16);

        const behaviorGroup = new Adw.PreferencesGroup({
            title: 'Behavior',
        });
        page.add(behaviorGroup);

        addSwitch(behaviorGroup, settings, 'show-apps', 'Show app grid button');
        addSwitch(behaviorGroup, settings, 'show-running', 'Show only running apps');
        addSwitch(behaviorGroup, settings, 'smart-activate', 'Use smart click behavior', 'Click to minimize focused apps, Ctrl-click or middle-click for a new window');
        addSwitch(behaviorGroup, settings, 'cycle-windows', 'Cycle windows', 'When an app has multiple windows, repeated clicks rotate through them');
        addSwitch(behaviorGroup, settings, 'scroll-workspaces', 'Scroll to switch workspaces', 'Use the mouse wheel over the dash to move between workspaces');
        addSwitch(behaviorGroup, settings, 'show-hover-label', 'Show hover labels', 'Display the app name below the top panel when hovering an icon');

        const appearanceGroup = new Adw.PreferencesGroup({
            title: 'Appearance',
        });
        page.add(appearanceGroup);

        addSwitch(appearanceGroup, settings, 'inactive-indicator-default-color', 'Use default color for other-workspace indicators', 'When disabled, other-workspace running apps use the accent-colored indicator');
        addSpin(appearanceGroup, settings, 'inactive-icon-opacity', 'Inactive app opacity', 'Opacity for pinned apps and apps outside the current workspace', 0, 255);
    }
}
