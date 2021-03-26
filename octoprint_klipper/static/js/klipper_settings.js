// <Octoprint Klipper Plugin>

// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as
// published by the Free Software Foundation, either version 3 of the
// License, or (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.

// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

$(function() {
    $('#klipper-settings a:first').tab('show');
    function KlipperSettingsViewModel(parameters) {
        var self = this;
        var obKlipperConfig = null;
        var editor = null;

        self.settings = parameters[0];

        self.header = OctoPrint.getRequestHeaders({
            "content-type": "application/json",
            "cache-control": "no-cache"
        });

        self.apiUrl = OctoPrint.getSimpleApiUrl("klipper");

        self.addMacro = function() {
            self.settings.settings.plugins.klipper.macros.push({
                name: 'Macro',
                macro: '',
                sidebar: true,
                tab: true
            });
        }

        self.removeMacro = function(macro) {
            self.settings.settings.plugins.klipper.macros.remove(macro);
        }

        self.moveMacroUp = function(macro) {
            self.moveItemUp(self.settings.settings.plugins.klipper.macros, macro)
        }

        self.moveMacroDown = function(macro) {
            self.moveItemDown(self.settings.settings.plugins.klipper.macros, macro)
        }

        self.addProbePoint = function() {
            self.settings.settings.plugins.klipper.probe.points.push(
                {
                    name: 'point-#',
                    x:0, y:0, z:0
                }
            );
        }

        self.removeProbePoint = function(point) {
            self.settings.settings.plugins.klipper.probe.points.remove(point);
        }

        self.moveProbePointUp = function(macro) {
            self.moveItemUp(self.settings.settings.plugins.klipper.probe.points, macro)
        }

        self.moveProbePointDown = function(macro) {
            self.moveItemDown(self.settings.settings.plugins.klipper.probe.points, macro)
        }

        self.moveItemDown = function(list, item) {
            var i = list().indexOf(item);
            if (i < list().length - 1) {
                var rawList = list();
                list.splice(i, 2, rawList[i + 1], rawList[i]);
            }
        }

        self.moveItemUp = function(list, item) {
            var i = list().indexOf(item);
            if (i > 0) {
                var rawList = list();
                list.splice(i-1, 2, rawList[i], rawList[i-1]);
            }
        }

        self.configBound = function (config) {
            config.withSilence = function() {
                this.notifySubscribers = function() {
                    if (!this.isSilent) {
                        ko.subscribable.fn.notifySubscribers.apply(this, arguments);
                    }
                }

                this.silentUpdate = function(newValue) {
                    this.isSilent = true;
                    this(newValue);
                    this.isSilent = false;
                };

                return this;
            }

            obKlipperConfig = config.withSilence();
            if (editor) {
                editor.setValue(obKlipperConfig());
                editor.clearSelection();
            }
            return obKlipperConfig;
        }

        ace.config.set("basePath", "plugin/klipper/static/js/lib/ace/");
        editor = ace.edit("plugin-klipper-config");
        editor.setTheme("ace/theme/monokai");
        editor.session.setMode("ace/mode/klipper_config");
        editor.setOptions({
          autoScrollEditorIntoView: true,
          maxLines: "Infinity"
        })

        editor.session.on('change', function(delta) {
            if (obKlipperConfig) {
                obKlipperConfig.silentUpdate(editor.getValue());
            }
        });

        // Uncomment this if not using maxLines: "Infinity"...
        // setInterval(function(){ editor.resize(); }, 500);
        self.onDataUpdaterPluginMessage = function(plugin, data) {
            if(plugin == "klipper") {
                if ("reload" == data.type){
                    if ("config" == data.subtype){
                        if (editor.session) {
                                editor.session.setValue(data.payload);
                                editor.clearSelection();
                        }
                    }
                    return
                }
            }
        }
    }

    OCTOPRINT_VIEWMODELS.push({
        construct: KlipperSettingsViewModel,
        dependencies: ["settingsViewModel"],
        elements: ["#settings_plugin_klipper"]
    });
});
