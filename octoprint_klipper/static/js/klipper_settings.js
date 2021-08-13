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
   $("#klipper-settings a:first").tab("show");
   function KlipperSettingsViewModel(parameters) {
      var self = this;
      var obKlipperConfig = null;
      var editor = null;

      self.settings = parameters[0];
      self.klipperViewModel = parameters[1];
      self.access = parameters[2];

      self.header = OctoPrint.getRequestHeaders({
         "content-type": "application/json",
         "cache-control": "no-cache",
      });

      self.markedForFileRemove = ko.observableArray([]);

      self.currentConfig = ko.observable("");
      self.CfgFilename = ko.observable();
      
      self.klipperEditorDialog = undefined;

      self.onStartup = function () {
         self.klipperEditorDialog = $("#klipper_EditorDialog");
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

      // initialize list helper
      self.configs = new ItemListHelper(
         "klipperCfgFiles",
         {
            name: function (a, b) {
               // sorts ascending
               if (a["name"].toLocaleLowerCase() < b["name"].toLocaleLowerCase())
                  return -1;
               if (a["name"].toLocaleLowerCase() > b["name"].toLocaleLowerCase())
                  return 1;
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
            },
         },
         {},
         "name",
         [],
         [],
         15
      );

      self.onStartup = function() {
         self.EditorDialog = $("#klipper_editor");
      }

      self.onStartupComplete = function() {
         self.listCfgFiles();
      };

      self.listCfgFiles = function () {
         self.klipperViewModel.consoleMessage("debug", "listCfgFiles:");

         OctoPrint.plugins.klipper.listCfg().done(function (response) {
            self.klipperViewModel.consoleMessage("debug", "listCfgFiles: " + response);
            self.configs.updateItems(response.files);
            self.configs.resetPage();
         });
      };

      self.removeCfg = function (config) {
         if (!self.klipperViewModel.hasRight("CONFIG")) return;

         var perform = function () {
            OctoPrint.plugins.klipper.deleteCfg(config)
               .done(function () {
                  self.listCfgFiles();
               })
               .fail(function (response) {
                  var html =
                     "<p>" +
                     _.sprintf(
                        gettext(
                           "Failed to remove config %(name)s.</p><p>Please consult octoprint.log for details.</p>"
                        ),
                        { name: _.escape(config) }
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
                     hide: false,
                  });
               });
         };

         showConfirmationDialog(
            _.sprintf(gettext('You are about to delete config file "%(name)s".'), {
               name: _.escape(config),
            }),
            perform
         );
      };

      self.markFilesOnPage = function () {
         self.markedForFileRemove(
            _.uniq(
               self
                  .markedForFileRemove()
                  .concat(_.map(self.configs.paginatedItems(), "file"))
            )
         );
      };

      self.markAllFiles = function () {
         self.markedForFileRemove(_.map(self.configs.allItems, "file"));
      };

      self.clearMarkedFiles = function () {
         self.markedForFileRemove.removeAll();
      };

      self.removeMarkedFiles = function () {
         var perform = function () {
            self._bulkRemove(self.markedForFileRemove()).done(function () {
               self.markedForFileRemove.removeAll();
            });
         };

         showConfirmationDialog(
            _.sprintf(gettext("You are about to delete %(count)d config files."), {
               count: self.markedForFileRemove().length,
            }),
            perform
         );
      };

      self._bulkRemove = function (files) {
         var title, message, handler;

         title = gettext("Deleting config files");
         message = _.sprintf(gettext("Deleting %(count)d config files..."), {
            count: files.length,
         });

         handler = function (filename) {
            return OctoPrint.plugins.klipper
               .deleteCfg(filename)
               .done(function () {
                  deferred.notify(
                     _.sprintf(gettext("Deleted %(filename)s..."), {
                        filename: _.escape(filename),
                     }),
                     true
                  );
                  self.markedForFileRemove.remove(function (item) {
                     return item.name == filename;
                  });
               })
               .fail(function () {
                  deferred.notify(
                     _.sprintf(
                        gettext("Deleting of %(filename)s failed, continuing..."),
                        { filename: _.escape(filename) }
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
            output: true,
         };
         showProgressModal(options, promise);

         var requests = [];
         _.each(files, function (filename) {
            var request = handler(filename);
            requests.push(request);
         });

         $.when.apply($, _.map(requests, wrapPromiseWithAlways)).done(function () {
            deferred.resolve();
            self.listCfgFiles();
         });

         return promise;
      };

      self.showBackupsDialog = function () {
         self.klipperViewModel.consoleMessage("debug", "showBackupsDialog:");

         var dialog = $("#klipper_backups_dialog");
         dialog.modal({
            show: "true",
            minHeight: "600px",
         });
      };



      self.showEditUserDialog = function (file) {
         if (!self.klipperViewModel.hasRight("CONFIG")) return;

         var process = function (config) {
            self.currentConfig(config);

            $(
               'ul.nav-pills a[data-toggle="tab"]:first',
               self.klipperEditorDialog
            ).tab("show");
            self.klipperEditorDialog
               .modal({
                  minHeight: function () {
                     return Math.max(
                        $.fn.modal.defaults.maxHeight() - 80,
                        250
                     );
                  }
               })
               .css({
                  "width": "auto",
                  "margin-left": function () {
                     return -($(this).width() / 2);
                  }
               });
         };

         OctoPrint.plugins.klipper.getCfg(file)
            .done(function (response) {
               process(response.content);
            });

      };

      self.addMacro = function () {
         self.settings.settings.plugins.klipper.macros.push({
            name: "Macro",
            macro: "",
            sidebar: true,
            tab: true,
         });
      };

      self.removeMacro = function (macro) {
         self.settings.settings.plugins.klipper.macros.remove(macro);
      };

      self.moveMacroUp = function (macro) {
         self.moveItemUp(self.settings.settings.plugins.klipper.macros, macro);
      };

      self.moveMacroDown = function (macro) {
         self.moveItemDown(self.settings.settings.plugins.klipper.macros, macro);
      };

      self.addProbePoint = function () {
         self.settings.settings.plugins.klipper.probe.points.push({
            name: "point-#",
            x: 0,
            y: 0,
            z: 0,
         });
      };

      self.removeProbePoint = function (point) {
         self.settings.settings.plugins.klipper.probe.points.remove(point);
      };

      self.moveProbePointUp = function (macro) {
         self.moveItemUp(self.settings.settings.plugins.klipper.probe.points, macro);
      };

      self.moveProbePointDown = function (macro) {
         self.moveItemDown(self.settings.settings.plugins.klipper.probe.points, macro);
      };

      self.moveItemDown = function (list, item) {
         var i = list().indexOf(item);
         if (i < list().length - 1) {
            var rawList = list();
            list.splice(i, 2, rawList[i + 1], rawList[i]);
         }
      };

      self.moveItemUp = function (list, item) {
         var i = list().indexOf(item);
         if (i > 0) {
            var rawList = list();
            list.splice(i - 1, 2, rawList[i], rawList[i - 1]);
         }
      };

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
   }

   OCTOPRINT_VIEWMODELS.push({
      construct: KlipperSettingsViewModel,
      dependencies: ["settingsViewModel", "klipperViewModel"],
      elements: ["#settings_plugin_klipper", "#klipper_editor"],
   });
});
