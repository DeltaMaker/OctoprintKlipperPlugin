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

function KlipperBackupViewModel(parameters) {
   var self = this;
   self.loginState = parameters[0];
   self.klipperViewModel = parameters[1];
   self.access = parameters[2];

   self.header = OctoPrint.getRequestHeaders({
      "content-type": "application/json",
      "cache-control": "no-cache"
   });

   self.apiUrl = OctoPrint.getSimpleApiUrl("klipper");
   self.Url = OctoPrint.getBlueprintUrl("klipper");

   self.availableBakFiles = ko.observableArray();
   self.CfgContent = ko.observableArray();

   self.onStartup = function() {
      if(self.loginState.loggedIn()) {
         self.listBakFiles();
      }
   }

   self.onUserLoggedIn = function(user) {
      self.listBakFiles();
   }

   self.listBakFiles = function() {
      var settings = {
        "crossDomain": true,
        "url": self.Url + "CfgBackup",
        "method": "POST",
        "headers": self.header,
        "processData": false,
        "dataType": "json",
        "data": JSON.stringify({command: "list"})
      }

      $.ajax(settings).done(function (response) {
         self.availableBakFiles.removeAll();
         self.availableBakFiles(response["data"]);
      });
   }

   self.showCfg = function (file) {
      if (
         !self.loginState.hasPermission(
             self.access.permissions.PLUGIN_KLIPPER_CONFIG
         )
      )
         return;

      var settings = {
         "crossDomain": true,
         "url": self.Url + "CfgBackup",
         "type": "POST",
         "headers": self.header,
         "processData": false,
         "dataType": "json",
         "contentType": "application/json; charset=UTF-8",
         "data": JSON.stringify(
            {
               command: "read",
               CfgFile: file.file
            }
         )
      }

      $.ajax(settings).done(function (response) {
         self.CfgContent(response.content)
      })
   }

   self.restoreCfg = function(file) {
      var html =
         "<p>" +
         gettext(
             "This will overwrite any file with the same name on the configpath."
         ) +
         "</p>";
      html +=
         "<p>" +
         file.name +
         "</p>";
      showConfirmationDialog({
         title: gettext("Are you sure you want to restore now?"),
         html: html,
         proceed: gettext("Proceed"),
         onproceed: function () {
            var settings = {
               "crossDomain": true,
               "url": self.Url + "CfgBackup",
               "type": "POST",
               "headers": self.header,
               "processData": false,
               "dataType": "json",
               "contentType": "application/json; charset=UTF-8",
               "data": JSON.stringify(
                  {
                     command: "restore",
                     CfgFile: file.file
                  }
               )
            }

            $.ajax(settings).done(function (response) {
               self.klipperViewModel.consoleMessage("debug", "restoreCfg: " + response.text)
               self.klipperViewModel.reloadConfig()
            });
         }
      })
   }
}

OCTOPRINT_VIEWMODELS.push({
      construct: KlipperBackupViewModel,
      dependencies: ["loginStateViewModel",
                     "klipperViewModel",
                     "accessViewModel"],
      elements: ["#klipper_backups_dialog"]
   });
});
