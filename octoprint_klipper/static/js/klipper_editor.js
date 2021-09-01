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

    self.CfgFilename = ko.observable("");
    self.CfgContent = ko.observable("");
    self.config = []

    self.header = OctoPrint.getRequestHeaders({
      "content-type": "application/json",
      "cache-control": "no-cache",
    });

    self.process = function (config) {
      self.config = config;
      self.CfgFilename(config.file);
      self.CfgContent(config.content);

      if (editor) {
        editor.session.setValue(config.content);
        editor.clearSelection();
      }
      setInterval(function () {
        if (editor) {


            var modalbodyheight = $('#klipper_editor').height();
            //$('#conf_editor').height( modalbodyheight - 135 );
            editor.resize();

        };
      }, 500);
    };

    self.checkSyntax = function () {
      if (editor.session) {
        self.klipperViewModel.consoleMessage("debug", "checkSyntax:");

        OctoPrint.plugins.klipper.checkCfg(editor.session.getValue())
          .done(function (response) {
            var msg = ""
            if (response.is_syntax_ok == true) {
              msg = gettext('Syntax OK')
            } else {
              msg = gettext('Syntax NOK')
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

        OctoPrint.plugins.klipper.saveCfg(editor.session.getValue(), self.CfgFilename())
          .done(function (response) {
            var msg = ""
            if (response.saved === true) {
              msg = gettext('File saved.')
            } else {
              msg = gettext('File not saved.')
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

      OctoPrint.plugins.klipper.getCfg(self.CfgFilename())
        .done(function (response) {
          self.klipperViewModel.consoleMessage("debug", "reloadFromFile: " + response);
          if (response.response.text != "") {
            var msg = response.response.text
            showMessageDialog(
              msg,
              {
                title: gettext("Reload File")
              }
            )
          } else {
            if (editor) {
              editor.session.setValue(response.response.config);
              editor.clearSelection();
            }
          }
        })
        .fail(function (response) {
          var msg = response
          showMessageDialog(
            msg,
            {
              title: gettext("Reload File")
            }
          )
        });
    };

    self.configBound = function (config) {
      config.withSilence = function () {
        this.notifySubscribers = function () {
          if (!this.isSilent) {
            ko.subscribable.fn.notifySubscribers.apply(this, arguments);
          }
        }

        this.silentUpdate = function (newValue) {
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

    self.onStartup = function () {
      ace.config.set("basePath", "plugin/klipper/static/js/lib/ace/");
      editor = ace.edit("plugin-klipper-config");
      editor.setTheme("ace/theme/monokai");
      editor.session.setMode("ace/mode/klipper_config");
      editor.clearSelection();

      editor.setOptions({
        hScrollBarAlwaysVisible: false,
        vScrollBarAlwaysVisible: false,
        autoScrollEditorIntoView: true,
        showPrintMargin: false,
        maxLines: "Infinity",
        minLines: 100
        //maxLines: "Infinity"
      });

      editor.session.on('change', function (delta) {
        if (obKlipperConfig) {
          obKlipperConfig.silentUpdate(editor.getValue());
          editor.resize();
        }
      });
    };
  }

  OCTOPRINT_VIEWMODELS.push({
    construct: KlipperEditorViewModel,
    dependencies: ["settingsViewModel", "klipperViewModel"],
    elements: ["#klipper_editor"],
  });
});
