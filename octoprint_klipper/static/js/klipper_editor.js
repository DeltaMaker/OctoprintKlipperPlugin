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

$(function () {
   function KlipperEditorViewModel(parameters) {
      var self = this;
      var obKlipperConfig = null;
      var editor = null;

      self.settings = parameters[0];
      self.klipperViewModel = parameters[1];
      self.klipperSettingsViewModel = parameters[2];

      self.header = OctoPrint.getRequestHeaders({
         "content-type": "application/json",
         "cache-control": "no-cache",
      });

      self.Cfgeditor = {
         filename: ko.observable(undefined),
         config: ko.observable(undefined),
         header: ko.observable(undefined),

         new: ko.observable(true),
         confirm: undefined,
         valid: ko.pureComputed(function () {
            return (
               self.Cfgeditor.name() &&
               self.Cfgeditor.name().trim() &&
               (!self.Cfgeditor.new() ||
                  (self.Cfgeditor.password() &&
                     self.Cfgeditor.password().trim() &&
                     !self.Cfgeditor.passwordMismatch()))
            );
         })
      };


      self.checkSyntax = function () {
         if (editor.session) {
            self.klipperViewModel.consoleMessage("debug", "checkSyntax:");

            OctoPrint.plugins.klipper.checkCfg(editor.session.getValue())
               .done(function (response) {
                  var msg = ""
                  if (response.check == "OK") {
                     msg = _.gettext('Syntax OK')
                  } else {
                     msg = _.gettext('Syntax NOK')
                  }
                  showMessageDialog(
                     msg,
                     {
                        title: gettext("SyntaxCheck")
                     }
                  )
               });
         };
      };

      self.saveCfg = function () {
         if (editor.session) {
            self.klipperViewModel.consoleMessage("debug", "Save:");

            OctoPrint.plugins.klipper.saveCfg(editor.session.getValue(), self.CfgFilename)
               .done(function (response) {
                  var msg = ""
                  if (response.saved === true) {
                     msg = _.gettext('File saved.')
                  } else {
                     msg = _.gettext('File not saved.')
                  }
                  showMessageDialog(
                     msg,
                     {
                        title: gettext("Save File")
                     }
                  )
               });
         }
      };

      self.minusFontsize = function () {
         self.settings.settings.plugins.klipper.configuration.fontsize(
            self.settings.settings.plugins.klipper.configuration.fontsize() - 1
         );
         if (self.settings.settings.plugins.klipper.configuration.fontsize() < 9) {
            self.settings.settings.plugins.klipper.configuration.fontsize(9);
         }
         if (editor) {
            editor.setFontSize(
               self.settings.settings.plugins.klipper.configuration.fontsize()
            );
            editor.resize();
         }
      };

      self.plusFontsize = function () {
         self.settings.settings.plugins.klipper.configuration.fontsize(
            self.settings.settings.plugins.klipper.configuration.fontsize() + 1
         );
         if (self.settings.settings.plugins.klipper.configuration.fontsize() > 20) {
            self.settings.settings.plugins.klipper.configuration.fontsize(20);
         }
         if (editor) {
            editor.setFontSize(
               self.settings.settings.plugins.klipper.configuration.fontsize()
            );
            editor.resize();
         }
      };

      self.loadLastSession = function () {
         if (self.settings.settings.plugins.klipper.configuration.temp_config() != "") {
            self.klipperViewModel.consoleMessage(
               "info",
               "lastSession:" +
                  self.settings.settings.plugins.klipper.configuration.temp_config()
            );
            if (editor.session) {
               editor.session.setValue(
                  self.settings.settings.plugins.klipper.configuration.temp_config()
               );
               editor.clearSelection();
            }
         }
      };

      self.reloadFromFile = function () {

         OctoPrint.plugins.klipper.getCfg(self.klipperSettingsViewModel.CfgFilename())
            .done(function (response) {
               if (editor) {
                  editor.session.setValue(response.content);
                  editor.clearSelection();
               }
            });
      };

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
      };

      self.onStartup = function() {
         ace.config.set("basePath", "plugin/klipper/static/js/lib/ace/");
         editor = ace.edit("plugin-klipper-config");
         editor.setTheme("ace/theme/monokai");
         editor.session.setMode("ace/mode/klipper_config");
         editor.setFontSize(
            self.settings.settings.plugins.klipper.configuration.fontsize()
         );
         editor.setValue(self.klipperSettingsViewModel.CfgContent());
         editor.clearSelection();

         editor.setOptions({
            hScrollBarAlwaysVisible: false,
            vScrollBarAlwaysVisible: false,
            autoScrollEditorIntoView: true,
            showPrintMargin: false,
            //maxLines: "Infinity"
         });

         editor.session.on('change', function(delta) {
            if (obKlipperConfig) {
                obKlipperConfig.silentUpdate(editor.getValue());
                editor.resize();
            }
         });
      };

      // Uncomment this if not using maxLines: "Infinity"...
      setInterval(function () {
         if (editor) {
            editor.resize();
         };
      }, 1000);

   }

   OCTOPRINT_VIEWMODELS.push({
      construct: KlipperEditorViewModel,
      dependencies: ["settingsViewModel", "klipperViewModel", "klipperSettingsViewModel"],
      elements: ["#klipper_editor"],
   });
});
