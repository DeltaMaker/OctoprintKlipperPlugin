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
    function KlipperEditorViewModel(parameters) {
        var self = this;
        var editor = null;
        var obKlipperConfig = null;

        self.settings = parameters[0];
        self.klipperViewModel = parameters[1];

        self.CfgFilename = ko.observable();

        self.header = OctoPrint.getRequestHeaders({
            "content-type": "application/json",
            "cache-control": "no-cache"
        });

        self.apiUrl = OctoPrint.getSimpleApiUrl("klipper");
        self.Url = OctoPrint.getBlueprintUrl("klipper");

        self.checkSyntax = function () {
            if (editor.session) {
                self.klipperViewModel.consoleMessage("debug", "onSettingsBeforeSave:")
                var settings = {
                    "crossDomain": true,
                    "url": self.Url + "Cfg",
                    "method": "POST",
                    "headers": self.header,
                    "processData": false,
                    "dataType": "json",
                    "data": JSON.stringify({
                        command: "check",
                        CfgFilecontent: editor.session.getValue()
                    })
                }

                $.ajax(settings).done(function (response) {
                    return response;
                });
            }
        };

        self.saveEditor = function () {
            if (editor.session) {
                self.klipperViewModel.consoleMessage("debug", "Save:")
                var settings = {
                    "crossDomain": true,
                    "url": self.Url + "Cfg",
                    "method": "POST",
                    "headers": self.header,
                    "processData": false,
                    "dataType": "json",
                    "data": JSON.stringify({
                        command: "save",
                        CfgFilecontent: editor.session.getValue(),
                        CfgFilename: self.CfgFilename()
                    })
                }

                $.ajax(settings).done(function (response) {
                });
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
        construct: KlipperEditorViewModel,
        dependencies: [
                "settingsViewModel",
                "klipperViewModel"
                ],
        elements: ["#klipper_editor"]
    });
});
