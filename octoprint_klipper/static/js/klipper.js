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
  function KlipperViewModel(parameters) {
    var self = this;

    self.header = OctoPrint.getRequestHeaders({
      "content-type": "application/json",
      "cache-control": "no-cache",
    });

    self.apiUrl = OctoPrint.getSimpleApiUrl("klipper");
    self.Url = OctoPrint.getBlueprintUrl("klipper");

    self.settings = parameters[0];
    self.loginState = parameters[1];
    self.connectionState = parameters[2];
    self.levelingViewModel = parameters[3];
    self.paramMacroViewModel = parameters[4];
    self.access = parameters[5];

    self.shortStatus_navbar = ko.observable();
    self.shortStatus_sidebar = ko.observable();
    self.logMessages = ko.observableArray();

    self.showPopUp = function (popupType, popupTitle, message) {
      var title = popupType.toUpperCase() + ":  " + popupTitle;
      new PNotify({
        title: title,
        text: message,
        type: popupType,
        hide: false,
        icon: true
      });
    };

    self.showEditorDialog = function () {
      if (!self.hasRight("CONFIG")) return;
      var editorDialog = $("#klipper_editor");
      editorDialog.modal({
        show: "true",
        backdrop: "static",
      });
    }

    self.showLevelingDialog = function () {
      var dialog = $("#klipper_leveling_dialog");
      dialog.modal({
        show: "true",
        backdrop: "static",
        keyboard: false,
      });
      self.levelingViewModel.initView();
    };

    self.showPidTuningDialog = function () {
      var dialog = $("#klipper_pid_tuning_dialog");
      dialog.modal({
        show: "true",
        backdrop: "static",
        keyboard: false,
      });
    };

    self.showOffsetDialog = function () {
      var dialog = $("#klipper_offset_dialog");
      dialog.modal({
        show: "true",
        backdrop: "static",
      });
    };

    self.showGraphDialog = function () {
      var dialog = $("#klipper_graph_dialog");
      dialog.modal({
        show: "true",
        minHeight: "500px",
        maxHeight: "600px",
      });
    };

    self.executeMacro = function (macro) {
      var paramObjRegex = /{(.*?)}/g;

      if (!self.hasRight("MACRO")) return;

      if (macro.macro().match(paramObjRegex) == null) {
        OctoPrint.control.sendGcode(
          // Use .split to create an array of strings which is sent to
          // OctoPrint.control.sendGcode instead of a single string.
          macro.macro().split(/\r\n|\r|\n/)
        );
      } else {
        self.paramMacroViewModel.process(macro);

        var dialog = $("#klipper_macro_dialog");
        dialog.modal({
          show: "true",
          backdrop: "static",
        });
      }
    };

    self.navbarClicked = function () {
      $("#tab_plugin_klipper_main_link").find("a").click();
    };

    self.onGetStatus = function () {
      OctoPrint.control.sendGcode("Status");
    };

    self.onRestartFirmware = function () {
      OctoPrint.control.sendGcode("FIRMWARE_RESTART");
    };

    self.onRestartHost = function () {
      OctoPrint.control.sendGcode("RESTART");
    };

    self.onAfterBinding = function () {
      self.connectionState.selectedPort(
        self.settings.settings.plugins.klipper.connection.port()
      );
    };

    self.onDataUpdaterPluginMessage = function (plugin, data) {
      if (plugin == "klipper") {
        switch (data.type) {
          case "PopUp":
            self.showPopUp(data.subtype, data.title, data.payload);
            break;
          case "reload":
            break;
          case "console":
            self.consoleMessage(data.subtype, data.payload);
            break;
          case "status":
            if (data.payload.length > 36) {
              var shortText = data.payload.substring(0, 31) + " [..]";
              self.shortStatus_navbar(shortText);
            } else {
              self.shortStatus_navbar(data.payload);
            }
            self.shortStatus_sidebar(data.payload);
            break;
          default:
            self.logMessage(data.time, data.subtype, data.payload);
            self.consoleMessage(data.subtype, data.payload);
        }
      }
    };

    self.logMessage = function (timestamp, type = "info", message) {
      if (!timestamp) {
        var today = new Date();
        var timestamp =
          today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
      }
      self.logMessages.push({
        time: timestamp,
        type: type,
        msg: message.replace(/\n/gi, "<br />"),
      });
    };

    self.consoleMessage = function (type, message) {
      if (
        self.settings.settings.plugins.klipper.configuration.debug_logging() === true
      ) {
        if (type == "info") {
          console.info("OctoKlipper : " + message);
        } else if (type == "debug") {
          console.debug("OctoKlipper : " + message);
        } else {
          console.error("OctoKlipper : " + message);
        }
      }
      return;
    };

    self.onClearLog = function () {
      self.logMessages.removeAll();
    };

    self.isActive = function () {
      return self.connectionState.isOperational();
    };

    self.hasRight = function (right_role) {
      //if (self.loginState.isAdmin) return true;
      if (right_role == "CONFIG") {
        return self.loginState.hasPermission(
          self.access.permissions.PLUGIN_KLIPPER_CONFIG
        );
      } else if (right_role == "MACRO") {
        return self.loginState.hasPermission(
          self.access.permissions.PLUGIN_KLIPPER_MACRO
        );
      }
    };

    self.hasRightKo = function (right_role) {
      //if (self.loginState.isAdmin) return true;
      if (right_role == "CONFIG") {
        return self.loginState.hasPermissionKo(
          self.access.permissions.PLUGIN_KLIPPER_CONFIG
        );
      } else if (right_role == "MACRO") {
        return self.loginState.hasPermissionKo(
          self.access.permissions.PLUGIN_KLIPPER_MACRO
        );
      }
    };

    // OctoKlipper settings link
    self.openOctoKlipperSettings = function (profile_type) {
      if (!self.hasRight("CONFIG")) return;

      $("a#navbar_show_settings").click();
      $("li#settings_plugin_klipper_link a").click();
      if (profile_type) {
        var query = "#klipper-settings a[data-profile-type='" + profile_type + "']";
        $(query).click();
      }
    };
  }

  OCTOPRINT_VIEWMODELS.push({
    construct: KlipperViewModel,
    dependencies: [
      "settingsViewModel",
      "loginStateViewModel",
      "connectionViewModel",
      "klipperLevelingViewModel",
      "klipperMacroDialogViewModel",
      "accessViewModel",
    ],
    elements: [
      "#tab_plugin_klipper_main",
      "#sidebar_plugin_klipper",
      "#navbar_plugin_klipper",
    ],
  });
});
