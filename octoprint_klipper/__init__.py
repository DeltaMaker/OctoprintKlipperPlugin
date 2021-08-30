# <Octoprint Klipper Plugin>

# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as
# published by the Free Software Foundation, either version 3 of the
# License, or (at your option) any later version.

# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.

# You should have received a copy of the GNU Affero General Public License
# along with this program.  If not, see <https://www.gnu.org/licenses/>.

from __future__ import absolute_import, division, print_function, unicode_literals
import logging
import octoprint.plugin
import octoprint.plugin.core
import glob
import os
import time
import sys

from octoprint.server import NO_CONTENT
from octoprint.util import is_hidden_path
from octoprint.util import get_formatted_size
from . import util, cfgUtils, logger
from octoprint.util.comm import parse_firmware_line
from octoprint.access.permissions import Permissions, ADMIN_GROUP
from .modules import KlipperLogAnalyzer
from octoprint.server.util.flask import restricted_access
import flask
from flask_babel import gettext

try:
    import configparser
except ImportError:
    import ConfigParser as configparser

if sys.version_info[0] < 3:
    import StringIO

MAX_UPLOAD_SIZE = 5 * 1024 * 1024  # 5Mb

class KlipperPlugin(
        octoprint.plugin.StartupPlugin,
        octoprint.plugin.TemplatePlugin,
        octoprint.plugin.SettingsPlugin,
        octoprint.plugin.AssetPlugin,
        octoprint.plugin.SimpleApiPlugin,
        octoprint.plugin.EventHandlerPlugin,
        octoprint.plugin.BlueprintPlugin):

    _parsing_response = False
    _parsing_check_response = True
    _message = ""

    def __init__(self):
        self._logger = logging.getLogger("octoprint.plugins.klipper")
        self._octoklipper_logger = logging.getLogger("octoprint.plugins.klipper.debug")

    # -- Startup Plugin
    def on_startup(self, host, port):
        from octoprint.logging.handlers import CleaningTimedRotatingFileHandler
        octoklipper_logging_handler = CleaningTimedRotatingFileHandler(
            self._settings.get_plugin_logfile_path(postfix="debug"), when="D", backupCount=3)
        octoklipper_logging_handler.setFormatter(logging.Formatter("[%(asctime)s] %(levelname)s: %(message)s"))
        octoklipper_logging_handler.setLevel(logging.DEBUG)

        self._octoklipper_logger.addHandler(octoklipper_logging_handler)
        self._octoklipper_logger.setLevel(
            logging.DEBUG if self._settings.get_boolean(["debug_logging"]) else logging.INFO)
        self._octoklipper_logger.propagate = False

    def on_after_startup(self):
        klipper_port = self._settings.get(["connection", "port"])
        additional_ports = self._settings.global_get(
            ["serial", "additionalPorts"])

        if klipper_port not in additional_ports:
            additional_ports.append(klipper_port)
            self._settings.global_set(
                ["serial", "additionalPorts"], additional_ports)
            self._settings.save()
            logger.log_info(
                self,
                "Added klipper serial port {} to list of additional ports.".format(klipper_port)
            )

    # -- Settings Plugin

    def get_additional_permissions(self, *args, **kwargs):
        return [
            {
                "key": "CONFIG",
                "name": "Config Klipper",
                "description": gettext("Allows to config klipper"),
                "default_groups": [ADMIN_GROUP],
                "dangerous": True,
                "roles": ["admin"]
            },
            {
                "key": "MACRO",
                "name": "Use Klipper Macros",
                "description": gettext("Allows to use klipper macros"),
                "default_groups": [ADMIN_GROUP],
                "dangerous": True,
                "roles": ["admin"]
            },
        ]

    def get_settings_defaults(self):
        return dict(
            connection=dict(
                port="/tmp/printer",
                replace_connection_panel=True
            ),
            macros=[dict(
                name="E-Stop",
                macro="M112",
                sidebar=True,
                tab=True
            )],
            probe=dict(
                height=0,
                lift=5,
                speed_xy=1500,
                speed_z=500,
                points=[dict(
                    name="point-1",
                    x=0,
                    y=0
                )]
            ),
            configuration=dict(
                debug_logging=False,
                configpath="~/printer.cfg",
                old_config="",
                temp_config="",
                logpath="/tmp/klippy.log",
                reload_command="RESTART",
                shortStatus_navbar=True,
                shortStatus_sidebar=True,
                parse_check=False,
                fontsize=9
            )
        )

    def on_settings_load(self):
        data = octoprint.plugin.SettingsPlugin.on_settings_load(self)

        configpath = os.path.expanduser(
            self._settings.get(["configuration", "configpath"])
        )
        standardconfigfile = os.path.join(configpath, "printer.cfg")
        data["config"] = cfgUtils.get_cfg(self, standardconfigfile)
        util.send_message(self, "reload", "config", "", data["config"])
            # send the configdata to frontend to update ace editor
        return data

    def on_settings_save(self, data):
        if "config" in data:
            if cfgUtils.save_cfg(self, data["config"], "printer.cfg"):
                #load the reload command from changed data if it is not existing load the saved setting
                if util.key_exist(data, "configuration", "reload_command"):
                    reload_command = os.path.expanduser(
                        data["configuration"]["reload_command"]
                    )
                else:
                    reload_command = self._settings.get(["configuration", "reload_command"])

                if reload_command != "manually":
                    # Restart klippy to reload config
                    self._printer.commands(reload_command)
                    logger.log_info(self, "Restarting Klipper.")
                # we dont want to write the klipper conf to the octoprint settings
            else:
                # save not sure. saving to the octoprintconfig:
                self._settings.set(["configuration", "temp_config"], data)
            data.pop("config", None)

        # save the rest of changed settings into config.yaml of octoprint
        old_debug_logging = self._settings.get_boolean(["configuration", "debug_logging"])

        octoprint.plugin.SettingsPlugin.on_settings_save(self, data)

        new_debug_logging = self._settings.get_boolean(["configuration", "debug_logging"])
        if old_debug_logging != new_debug_logging:
            if new_debug_logging:
                self._octoklipper_logger.setLevel(logging.DEBUG)
            else:
                self._octoklipper_logger.setLevel(logging.INFO)

    def get_settings_restricted_paths(self):
        return dict(
            admin=[
                ["connection", "port"],
                ["configuration", "configpath"],
                ["configuration", "replace_connection_panel"]
            ],
            user=[
                ["macros"],
                ["probe"]
            ]
        )

    def get_settings_version(self):
        return 3

    def on_settings_migrate(self, target, current):
        if current is None:
            settings = self._settings

            if settings.has(["serialport"]):
                settings.set(["connection", "port"],
                             settings.get(["serialport"]))
                settings.remove(["serialport"])

            if settings.has(["replace_connection_panel"]):
                settings.set(
                    ["connection", "replace_connection_panel"],
                    settings.get(["replace_connection_panel"])
                )
                settings.remove(["replace_connection_panel"])

            if settings.has(["probeHeight"]):
                settings.set(["probe", "height"],
                             settings.get(["probeHeight"]))
                settings.remove(["probeHeight"])

            if settings.has(["probeLift"]):
                settings.set(["probe", "lift"], settings.get(["probeLift"]))
                settings.remove(["probeLift"])

            if settings.has(["probeSpeedXy"]):
                settings.set(["probe", "speed_xy"],
                             settings.get(["probeSpeedXy"]))
                settings.remove(["probeSpeedXy"])

            if settings.has(["probeSpeedZ"]):
                settings.set(["probe", "speed_z"],
                             settings.get(["probeSpeedZ"]))
                settings.remove(["probeSpeedZ"])

            if settings.has(["probePoints"]):
                points = settings.get(["probePoints"])
                points_new = []
                for p in points:
                    points_new.append(
                        dict(name="", x=int(p["x"]), y=int(p["y"]), z=0))
                settings.set(["probe", "points"], points_new)
                settings.remove(["probePoints"])

            if settings.has(["configPath"]):
                logger.log_info(self, "migrate setting for: configPath")
                settings.set(["config_path"], settings.get(["configPath"]))
                settings.remove(["configPath"])

        if current is not None and current < 3:
            settings = self._settings
            if settings.has(["configuration", "navbar"]):
                logger.log_info(self, "migrate setting for: configuration/navbar")
                settings.set(["configuration", "shortStatus_navbar"], settings.get(["configuration", "navbar"]))
                settings.remove(["configuration", "navbar"])

    # -- Template Plugin

    def get_template_configs(self):
        return [
            dict(type="navbar", custom_bindings=True),
            dict(type="settings", custom_bindings=True),
            dict(
                type="generic",
                name="Assisted Bed Leveling",
                template="klipper_leveling_dialog.jinja2",
                custom_bindings=True
            ),
            dict(
                type="generic",
                name="PID Tuning",
                template="klipper_pid_tuning_dialog.jinja2",
                custom_bindings=True
            ),
            dict(
                type="generic",
                name="Coordinate Offset",
                template="klipper_offset_dialog.jinja2",
                custom_bindings=True
            ),
            dict(
                type="tab",
                name="Klipper",
                template="klipper_tab_main.jinja2",
                suffix="_main",
                custom_bindings=True
            ),
            dict(type="sidebar",
                custom_bindings=True,
                icon="rocket",
                replaces="connection" if self._settings.get_boolean(
                    ["connection", "replace_connection_panel"]) else ""
            ),
            dict(
                type="generic",
                name="Performance Graph",
                template="klipper_graph_dialog.jinja2",
                custom_bindings=True
            ),
            dict(
                type="generic",
                name="Config Backups",
                template="klipper_backups_dialog.jinja2",
                custom_bindings=True
            ),
            dict(
                type="generic",
                name="Config Editor",
                template="klipper_editor.jinja2",
                custom_bindings=True
            ),
            dict(
                type="generic",
                name="Macro Dialog",
                template="klipper_param_macro_dialog.jinja2",
                custom_bindings=True
            )
        ]

    def get_template_vars(self):
        return {
            "max_upload_size": MAX_UPLOAD_SIZE,
            "max_upload_size_str": get_formatted_size(MAX_UPLOAD_SIZE),
        }

    # -- Asset Plugin

    def get_assets(self):
        return dict(
            js=["js/klipper.js",
                "js/klipper_settings.js",
                "js/klipper_leveling.js",
                "js/klipper_pid_tuning.js",
                "js/klipper_offset.js",
                "js/klipper_param_macro.js",
                "js/klipper_graph.js",
                "js/klipper_backup.js",
                "js/klipper_editor.js"
            ],
            clientjs=["clientjs/klipper.js"],
            css=["css/klipper.css"]
        )

    # -- Event Handler Plugin

    def on_event(self, event, payload):
        if "UserLoggedIn" == event:
            util.update_status(self, "info", "Klipper: Standby")
        if "Connecting" == event:
            util.update_status(self, "info", "Klipper: Connecting ...")
        elif "Connected" == event:
            util.update_status(self, "info", "Klipper: Connected to host")
            logger.log_info(
                self,
                "Connected to host via {} @{}bps".format(payload["port"], payload["baudrate"]))
        elif "Disconnected" == event:
            util.update_status(self, "info", "Klipper: Disconnected from host")
        elif "Error" == event:
            util.update_status(self, "error", "Klipper: Error")
            logger.log_error(self, payload["error"])

    # -- GCODE Hook

    def on_parse_gcode(self, comm, line, *args, **kwargs):

        if "FIRMWARE_VERSION" in line:
            printerInfo = parse_firmware_line(line)
            if "FIRMWARE_VERSION" in printerInfo:
                logger.log_info(self, "Firmware version: {}".format(
                    printerInfo["FIRMWARE_VERSION"]))
        elif "// probe" in line or "// Failed to verify BLTouch" in line:
            msg = line.strip('/')
            logger.log_info(self, msg)
            self.write_parsing_response_buffer()
        elif "//" in line:
            # add lines with // to a buffer
            self._message = self._message + line.strip('/')
            if not self._parsing_response:
                util.update_status(self, "info", self._message)
            self._parsing_response = True
        elif "!!" in line:
            msg = line.strip('!')
            util.update_status(self, "error", msg)
            logger.log_error(self, msg)
            self.write_parsing_response_buffer()
        else:
            self.write_parsing_response_buffer()
        return line

    def write_parsing_response_buffer(self):
        # write buffer with // lines after a gcode response without //
        if self._parsing_response:
            self._parsing_response = False
            logger.log_info(self, self._message)
            self._message = ""

    def get_api_commands(self):
        return dict(
            listLogFiles=[],
            getStats=["logFile"],
            reloadConfig=[],
            checkConfig=["config"]
        )

    def on_api_command(self, command, data):
        if command == "listLogFiles":
            files = []
            logpath = os.path.expanduser(
                self._settings.get(["configuration", "logpath"])
            )
            if util.file_exist(self, logpath):
                for f in glob.glob(self._settings.get(["configuration", "logpath"]) + "*"):
                    filesize = os.path.getsize(f)
                    filemdate = time.strftime("%d.%m.%Y %H:%M",time.localtime(os.path.getctime(f)))
                    files.append(dict(
                        name=os.path.basename(f) + " (" + filemdate + ")",
                        file=f,
                        size=filesize
                    ))
                return flask.jsonify(data=files)
            else:
                return flask.jsonify(data=files)
        elif command == "getStats":
            if "logFile" in data:
                log_analyzer = KlipperLogAnalyzer.KlipperLogAnalyzer(
                    data["logFile"])
                return flask.jsonify(log_analyzer.analyze())

    def is_blueprint_protected(self):
        return False

    def route_hook(self, server_routes, *args, **kwargs):
        from octoprint.server.util.tornado import LargeResponseHandler, path_validation_factory
        from octoprint.util import is_hidden_path
        configpath = os.path.expanduser(
                        self._settings.get(["configuration", "configpath"])
                    )
        bak_path = os.path.join(self.get_plugin_data_folder(), "configs", "")

        return [
            (r"/download/(.*)", LargeResponseHandler, dict(path=configpath,
                                                           as_attachment=True,
                                                           path_validation=path_validation_factory(lambda path: not is_hidden_path(path),
                                                                                                   status_code=404))),
            (r"/download/backup(.*)", LargeResponseHandler, dict(path=bak_path,
                                                           as_attachment=True,
                                                           path_validation=path_validation_factory(lambda path: not is_hidden_path(path),
                                                                                                   status_code=404)))
        ]

    # API for Backups
    # Get Content of a Backupconfig
    @octoprint.plugin.BlueprintPlugin.route("/backup/<filename>", methods=["GET"])
    @restricted_access
    @Permissions.PLUGIN_KLIPPER_CONFIG.require(403)
    def get_backup(self, filename):
        data_folder = self.get_plugin_data_folder()
        full_path = os.path.realpath(os.path.join(data_folder, "configs", filename))
        response = cfgUtils.get_cfg(self, full_path)
        return flask.jsonify(response = response)

    # Delete a Backupconfig
    @octoprint.plugin.BlueprintPlugin.route("/backup/<filename>", methods=["DELETE"])
    @restricted_access
    @Permissions.PLUGIN_KLIPPER_CONFIG.require(403)
    def delete_backup(self, filename):
        data_folder = self.get_plugin_data_folder()
        full_path = os.path.realpath(os.path.join(data_folder, "configs", filename))
        if (
            full_path.startswith(data_folder)
            and os.path.exists(full_path)
            and not is_hidden_path(full_path)
        ):
            try:
                os.remove(full_path)
            except Exception:
                self._octoklipper_logger.exception("Could not delete {}".format(filename))
                raise
        return NO_CONTENT

    # Get a list of all backuped configfiles
    @octoprint.plugin.BlueprintPlugin.route("/backup/list", methods=["GET"])
    @restricted_access
    @Permissions.PLUGIN_KLIPPER_CONFIG.require(403)
    def list_backups(self):
        files = cfgUtils.list_cfg_files(self, "backup")
        return flask.jsonify(files = files)

    # restore a backuped configfile
    @octoprint.plugin.BlueprintPlugin.route("/backup/restore/<filename>", methods=["GET"])
    @restricted_access
    @Permissions.PLUGIN_KLIPPER_CONFIG.require(403)
    def restore_backup(self, filename):
        configpath = os.path.expanduser(
                        self._settings.get(["configuration", "configpath"])
                    )
        data_folder = self.get_plugin_data_folder()
        backupfile = os.path.realpath(os.path.join(data_folder, "configs", filename))
        return flask.jsonify(restored = cfgUtils.copy_cfg(self, backupfile, configpath))

    # API for Configs
    # Get Content of a Configfile
    @octoprint.plugin.BlueprintPlugin.route("/config/<filename>", methods=["GET"])
    @restricted_access
    @Permissions.PLUGIN_KLIPPER_CONFIG.require(403)
    def get_config(self, filename):
        cfg_path = os.path.expanduser(
            self._settings.get(["configuration", "configpath"])
        )
        full_path = os.path.realpath(os.path.join(cfg_path, filename))
        response = cfgUtils.get_cfg(self, full_path)
        return flask.jsonify(response = response)

    # Delete a Configfile
    @octoprint.plugin.BlueprintPlugin.route("/config/<filename>", methods=["DELETE"])
    @restricted_access
    @Permissions.PLUGIN_KLIPPER_CONFIG.require(403)
    def delete_config(self, filename):
        cfg_path = os.path.expanduser(
            self._settings.get(["configuration", "configpath"])
        )
        full_path = os.path.realpath(os.path.join(cfg_path, filename))
        if (
            full_path.startswith(cfg_path)
            and os.path.exists(full_path)
            and not is_hidden_path(full_path)
        ):
            try:
                os.remove(full_path)
            except Exception:
                self._octoklipper_logger.exception("Could not delete {}".format(filename))
                raise
        return NO_CONTENT

    # Get a list of all configfiles
    @octoprint.plugin.BlueprintPlugin.route("/config/list", methods=["GET"])
    @restricted_access
    @Permissions.PLUGIN_KLIPPER_CONFIG.require(403)
    def list_configs(self):
        files = cfgUtils.list_cfg_files(self, "")
        return flask.jsonify(files = files, max_upload_size = MAX_UPLOAD_SIZE)

    # check syntax of a given data
    @octoprint.plugin.BlueprintPlugin.route("/config/check", methods=["POST"])
    @restricted_access
    @Permissions.PLUGIN_KLIPPER_CONFIG.require(403)
    def check_config(self):
        data = flask.request.json
        data_to_check = data.get("DataToCheck", [])
        response = cfgUtils.check_cfg(self, data_to_check)
        return flask.jsonify(is_syntax_ok = response)

    # save a configfile
    @octoprint.plugin.BlueprintPlugin.route("/config/save", methods=["POST"])
    @restricted_access
    @Permissions.PLUGIN_KLIPPER_CONFIG.require(403)
    def save_config(self):
        data = flask.request.json

        filename = data.get("filename", [])
        Filecontent = data.get("DataToSave", [])
        if filename == []:
            flask.abort(
                400,
                description="Invalid request, the filename is not set",
            )
        saved = cfgUtils.save_cfg(self, Filecontent, filename)
        if saved == True:
            util.send_message(self, "reload", "configlist", "", "")
        return flask.jsonify(saved = saved)

    # APIs end

    def get_update_information(self):
        return dict(
            klipper=dict(
                displayName=self._plugin_name,
                displayVersion=self._plugin_version,
                type="github_release",
                current=self._plugin_version,
                user="thelastWallE",
                repo="OctoprintKlipperPlugin",
                pip="https://github.com/thelastWallE/OctoprintKlipperPlugin/archive/{target_version}.zip",
                stable_branch=dict(
                    name="Stable",
                    branch="master",
                    comittish=["master"]
                ),
                prerelease_branches=[
                    dict(
                        name="Release Candidate",
                        branch="rc",
                        comittish=["rc", "master"]
                    )]
            )
        )

__plugin_name__ = "OctoKlipper"
__plugin_pythoncompat__ = ">=2.7,<4"

def __plugin_load__():
    global __plugin_implementation__
    global __plugin_hooks__
    __plugin_implementation__ = KlipperPlugin()
    __plugin_hooks__ = {
        "octoprint.server.http.routes": __plugin_implementation__.route_hook,
        "octoprint.access.permissions": __plugin_implementation__.get_additional_permissions,
        "octoprint.comm.protocol.gcode.received": __plugin_implementation__.on_parse_gcode,
        "octoprint.plugin.softwareupdate.check_config": __plugin_implementation__.get_update_information
    }
