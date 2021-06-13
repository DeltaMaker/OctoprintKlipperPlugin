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
        self.klipperViewModel = parameters[1];

        self.header = OctoPrint.getRequestHeaders({
            "content-type": "application/json",
            "cache-control": "no-cache"
        });

        self.apiUrl = OctoPrint.getSimpleApiUrl("klipper");

        self.onSettingsBeforeSave = function () {
            if (editor.session) {
                self.klipperViewModel.consoleMessage("debug", "onSettingsBeforeSave:")
                var settings = {
                    "crossDomain": true,
                    "url": self.apiUrl,
                    "method": "POST",
                    "headers": self.header,
                    "processData": false,
                    "dataType": "json",
                    "data": JSON.stringify({command: "checkConfig",
                                            config: editor.session.getValue()})
                }

                $.ajax(settings).done(function (response) {
                });
            }
        }

        self.showBackupsDialog = function () {
            self.klipperViewModel.consoleMessage("debug", "showBackupsDialog:")
            var dialog = $("#klipper_backups_dialog");
            dialog.modal({
                show: "true",
                minHeight: "500px",
                maxHeight: "600px"
            });
        }

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

        self.minusFontsize = function () {
            self.settings.settings.plugins.klipper.configuration.fontsize(self.settings.settings.plugins.klipper.configuration.fontsize() - 1);
            if (self.settings.settings.plugins.klipper.configuration.fontsize() < 9) {
                self.settings.settings.plugins.klipper.configuration.fontsize(9);
            }
            if (editor) {
                editor.setFontSize(self.settings.settings.plugins.klipper.configuration.fontsize());
                editor.resize();
            }
        }

        self.plusFontsize = function () {
            self.settings.settings.plugins.klipper.configuration.fontsize(self.settings.settings.plugins.klipper.configuration.fontsize() + 1);
            if (self.settings.settings.plugins.klipper.configuration.fontsize() > 20) {
                self.settings.settings.plugins.klipper.configuration.fontsize(20);
            }
            if (editor) {
                editor.setFontSize(self.settings.settings.plugins.klipper.configuration.fontsize());
                editor.resize();
            }
        }

        self.loadLastSession = function () {
            if (self.settings.settings.plugins.klipper.configuration.old_config() != "") {
                self.klipperViewModel.consoleMessage("info","lastSession:" + self.settings.settings.plugins.klipper.configuration.old_config())
                if (editor.session) {
                    editor.session.setValue(self.settings.settings.plugins.klipper.configuration.old_config());
                    editor.clearSelection();
                }
            }
        }

        self.reloadFromFile = function () {
            self.klipperViewModel.reloadConfig();
        }

        self.loadCfgBackup = function () {
            if (editor.session) {
                var settings = {
                    "crossDomain": true,
                    "url": self.apiUrl,
                    "method": "POST",
                    "headers": self.header,
                    "processData": false,
                    "dataType": "json",
                    "data": JSON.stringify({command: "reloadCfgBackup"})
                }

                $.ajax(settings).done(function (response) {
                    if (editor.session) {
                        editor.session.setValue(response["data"]);
                        editor.clearSelection();
                    }
                });
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
                editor.setFontSize(self.settings.settings.plugins.klipper.configuration.fontsize());
                editor.resize();
                editor.clearSelection();
            }
            return obKlipperConfig;
        }

        ace.config.set("basePath", "plugin/klipper/static/js/lib/ace/");
        editor = ace.edit("plugin-klipper-config");
        editor.setTheme("ace/theme/monokai");
        editor.session.setMode("ace/mode/klipper_config");
        editor.setOptions({
            hScrollBarAlwaysVisible: false,
            vScrollBarAlwaysVisible: false,
            autoScrollEditorIntoView: true,
            showPrintMargin: false,
            //maxLines: "Infinity"
        })

        editor.session.on('change', function(delta) {
            if (obKlipperConfig) {
                obKlipperConfig.silentUpdate(editor.getValue());
                editor.resize();
            }
        });

        // Uncomment this if not using maxLines: "Infinity"...
        setInterval(function() { editor.resize(); }, 500);
        self.onDataUpdaterPluginMessage = function(plugin, data) {
            if (plugin == "klipper" &&
              data.type == "reload" &&
              data.subtype == "config" &&
              editor.session) {
                self.klipperViewModel.consoleMessage("debug", "onDataUpdaterPluginMessage klipper reload config")
                editor.session.setValue(data.payload);
                editor.clearSelection();
              }
        }
    }

    OCTOPRINT_VIEWMODELS.push({
        construct: KlipperSettingsViewModel,
        dependencies: [
                "settingsViewModel",
                "klipperViewModel"
                ],
        elements: ["#settings_plugin_klipper"]
    });
});
