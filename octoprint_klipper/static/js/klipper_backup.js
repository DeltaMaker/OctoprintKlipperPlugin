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
        "url": self.apiUrl,
        "method": "POST",
        "headers": self.header,
        "processData": false,
        "dataType": "json",
        "data": JSON.stringify({command: "listBakFiles"})
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
      var html =
         "<p>" +
         gettext(
             "This will update the following components and restart the server:"
         ) +
         "</p>";
      html +=
         "<p>" +
         gettext(
             "Be sure to read through any linked release notes, especially those for OctoPrint since they might contain important information you need to know <strong>before</strong> upgrading."
         ) +
         "</p>" +
         "<p><strong>" +
         gettext("This action may disrupt any ongoing print jobs.") +
         "</strong></p>" +
         "<p>" +
         gettext(
             "Depending on your printer's controller and general setup, restarting OctoPrint may cause your printer to be reset."
         ) +
         "</p>" +
         "<p>" +
         gettext("Are you sure you want to proceed?") +
         "</p>";
      showConfirmationDialog({
         title: gettext("Are you sure you want to update now?"),
         html: html,
         proceed: gettext("Proceed"),
         onproceed: function (file) {
            var url = PLUGIN_BASEURL + "CfgBackup/";
            var payload = {
               command: "getCfg",
               CfgFile: file.file
            };
            $.ajax({
               url: url,
               type: "POST",
               dataType: "json",
               data: JSON.stringify(payload),
               contentType: "application/json; charset=UTF-8",
               success: function (response) {
                  self.CfgContent(response.content)
               }
           });


                .getCfg({CfgFile: file.file})
                .done(function (data) {
                  self.CfgContent(data.content)
                })
                .always(function () {

                });
         },
         onclose: function () {
         }
      });

   };

   self.markRead = function () {

      $.ajax({
          url: url,
          type: "POST",
          dataType: "json",
          data: JSON.stringify(payload),
          contentType: "application/json; charset=UTF-8",
          success: function () {
              if (reload) {
                  self.retrieveData();
              }
          }
      });
  };
   /* self.showCfg = function(file) {
      var settings = {
        "crossDomain": true,
        "url": self.apiUrl,
        "method": "POST",
        "headers": self.header,
        "processData": false,
        "dataType": "json",
        "data": JSON.stringify(
           {
              command: "getCfg",
              CfgFile: file.file
           }
        )
      }

      $.ajax(settings).done(function (response) {
         self.CfgContent(response.content)
      });
   } */

   self.restoreCfg = function(file) {
      var settings = {
         "crossDomain": true,
         "url": self.apiUrl,
         "method": "POST",
         "headers": self.header,
         "processData": false,
         "dataType": "json",
         "data": JSON.stringify(
            {
               command: "restoreCfg",
               CfgFile: file.file
            }
         )
      }

      $.ajax(settings).done(function (response) {
         self.klipperViewModel.consoleMessage("debug", "restoreCfg: " + response.text)
         self.klipperViewModel.reloadConfig()
      });
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
