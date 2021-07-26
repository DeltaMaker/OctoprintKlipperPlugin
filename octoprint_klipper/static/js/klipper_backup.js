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

      //self.availableBakFiles = ko.observableArray();
      self.markedForFileRestore = ko.observableArray([]);
      self.CfgContent = ko.observableArray();

      self.onStartupComplete = function() {
         if(self.loginState.loggedIn()) {
            self.listBakFiles();
         }
      };

      // initialize list helper
      self.listHelper = new ItemListHelper(
         "klipperBakFiles",
         {
            name: function (a, b) {
               // sorts ascending
               if (a["name"].toLocaleLowerCase() < b["name"].toLocaleLowerCase()) return -1;
               if (a["name"].toLocaleLowerCase() > b["name"].toLocaleLowerCase()) return 1;
               return 0;
            },
            date: function (a, b) {
               // sorts descending
               if (a["date"] > b["date"]) return -1;
               if (a["date"] < b["date"]) return 1;
               return 0;
            },
            size: function (a, b) {
               // sorts descending
               if (a["bytes"] > b["bytes"]) return -1;
               if (a["bytes"] < b["bytes"]) return 1;
               return 0;
            }
         },
         {},
         "name",
         [],
         [],
         5
      );

      self.listBakFiles = function() {
         self.klipperViewModel.consoleMessage("debug", "listBakFiles:");
         var settings = {
            "crossDomain": true,
            "url": self.Url + "CfgBackup",
            "method": "POST",
            "headers": self.header,
            "processData": false,
            "dataType": "json",
            "data": JSON.stringify({command: "list"})
         }
         self.klipperViewModel.consoleMessage("debug", "listBakFiles:"+ settings);

         $.ajax(settings).done(function (response) {
            self.klipperViewModel.consoleMessage("debug", "listBakFilesdone: " + response);
            self.listHelper.updateItems(response.files);
            self.listHelper.resetPage();
         });
      };

      self.showCfg = function (file) {
         if (!self.loginState.hasPermission(self.access.permissions.PLUGIN_KLIPPER_CONFIG)) return;

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
      };

      self.removeCfg = function (file) {
         if (!self.loginState.hasPermission(self.access.permissions.PLUGIN_KLIPPER_CONFIG)) return;

         var perform = function () {
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
                     command: "remove",
                     CfgFile: file.file
                  }
               )
            }

            $.ajax(settings)
               .done(function (response) {
                  //we will get an updated directory list back after deletion
                  self.listHelper.updateItems(response.files);
                  self.listHelper.resetPage();
               })
               .fail(function (response) {
                  var html =
                     "<p>" +
                     _.sprintf(
                        gettext(
                              "Failed to remove config %(name)s.</p><p>Please consult octoprint.log for details.</p>"
                        ),
                        {name: _.escape(file)}
                     );
                  html += pnotifyAdditionalInfo(
                     '<pre style="overflow: auto">' +
                        _.escape(response.responseText) +
                        "</pre>"
                  );
                  new PNotify({
                     title: gettext("Could not remove config"),
                     text: html,
                     type: "error",
                     hide: false
                  });
            });
         };

         showConfirmationDialog(
            _.sprintf(gettext('You are about to delete config file "%(name)s".'), {
               name: _.escape(file)
            }),
            perform
         );
      };

      self.restoreCfg = function(file) {
         if (!self.loginState.hasPermission(self.access.permissions.PLUGIN_KLIPPER_CONFIG)) return;

         var restore = function () {
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
            });
         };


         var html =
            "<p>"
            + gettext("This will overwrite any file with the same name on the configpath.")
            + "</p>"
            + "<p>"
            + file.name
            + "</p>";

         showConfirmationDialog({
            title: gettext("Are you sure you want to restore now?"),
            html: html,
            proceed: gettext("Proceed"),
            onproceed: restore()
         })
      };

      self.markFilesOnPage = function () {
         self.markedForFileRestore(
            _.uniq(
               self
                  .markedForFileRestore()
                  .concat(_.map(self.listHelper.paginatedItems(), "file"))
            )
         );
      };

      self.markAllFiles = function () {
         self.markedForFileRestore(_.map(self.listHelper.allItems, "file"));
      };

      self.clearMarkedFiles = function () {
         self.markedForFileRestore.removeAll();
      };

      self.restoreMarkedFiles = function () {

         var perform = function () {
            self._bulkRestore(self.markedForFileRestore()).done(function () {
               self.markedForFileRestore.removeAll();
            });
         };

         showConfirmationDialog(
            _.sprintf(gettext("You are about to restore %(count)d config files."), {
               count: self.markedForFileRestore().length
            }),
            perform
         );
      };

      self._bulkRestore = function (files) {
         var title, message, handler;

         title = gettext("Restoring klipper files");
         self.klipperViewModel.consoleMessage("debug", title);
         message = _.sprintf(gettext("Restoring %(count)d backup files..."), {
            count: files.length
         });

         handler = function (filename) {

            var opts = {};
            opts.headers = self.header;
            opts.method = "POST";
            opts.dataType = "json";
            opts.contentType = "application/json; charset=UTF-8";
            var url = self.Url + "CfgBackup";
            var data = JSON.stringify(
               {
                  command: "restore",
                  CfgFile: filename
               }
            );

            /* var settings = {
               "crossDomain": true,
               "processData": false,
            }; */

            return OctoPrint.post(url, data, opts)
               .done(function (response) {
                  deferred.notify(
                     _.sprintf(gettext("Restored %(filename)s..."), {
                        filename: _.escape(filename)
                     }),
                     true
                  );
                  self.klipperViewModel.consoleMessage("debug", "restoreCfg: " + response.text)
               })
               .fail(function () {
                  deferred.notify(
                     _.sprintf(
                           gettext(
                              "Restoring of %(filename)s failed, continuing..."
                           ),
                           {filename: _.escape(filename)}
                     ),
                     false
                  );
               });
         };

         var deferred = $.Deferred();

         var promise = deferred.promise();

         var options = {
             title: title,
             message: message,
             max: files.length,
             output: true
         };
         showProgressModal(options, promise);

         var requests = [];

         _.each(files, function (filename) {
            var request = handler(filename);
            requests.push(request);
         });

         $.when.apply($, _.map(requests, wrapPromiseWithAlways)).done(function () {
            deferred.resolve();
         });

         return promise;
      };
   }

   OCTOPRINT_VIEWMODELS.push({
         construct: KlipperBackupViewModel,
         dependencies: ["loginStateViewModel",
                        "klipperViewModel",
                        "accessViewModel"],
         elements: ["#klipper_backups_dialog"]
   });
});
