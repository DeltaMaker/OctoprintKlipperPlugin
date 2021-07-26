from __future__ import absolute_import, division, print_function, unicode_literals
import glob
import os, time, sys

from . import util, logger

def list_cfg_files(self, path):
    files = []
    if path=="backup":
        cfg_path = os.path.join(self.get_plugin_data_folder(), "configs", "*")
    else:
        cfg_path = os.path.expanduser(
            self._settings.get(["configuration", "configpath"])
        )
        cfg_path = os.path.join(cfg_path, "*.cfg")
    cfg_files = glob.glob(cfg_path)
    logger.log_debug(self, "list_cfg_files Path: " + cfg_path)

    for f in cfg_files:
        filesize = os.path.getsize(f)
        filemdate = time.localtime(os.path.getmtime(f))
        files.append(dict(
            name=os.path.basename(f),
            file=f,
            size=" ({:.1f} KB)".format(filesize / 1000.0),
            mdate=time.strftime("%d.%m.%Y %H:%M", filemdate)
        ))
        logger.log_debug(self, "list_cfg_files " + f)
    return files

def get_cfg(self, file):
    if not file:
        cfg_path = os.path.expanduser(
            self._settings.get(["configuration", "configpath"])
        )
        file = os.path.join(cfg_path, "printer.cfg")
    if util.file_exist(self, file):
        logger.log_debug(self, "get_cfg_files Path: " + file)
        try:
            with open(file, "r") as f:
                config = f.read()
        except IOError:
            logger.log_error(
                self,
                "Error: Klipper config file not found at: {}".format(
                    file)
            )
        else:
            if sys.version_info[0] < 3:
                config = config.decode('utf-8')
            return config
        finally:
            f.close()

def save_cfg(self, data, file="printer.cfg"):
    '''
    Saves the cfg file to the configpath
    '''
    logger.log_debug(
        self,
        "Save klipper config"
    )

    check_parse = self._settings.get(["configuration", "parse_check"])
    logger.log_debug(self, "check_parse: {}".format(check_parse))

    if sys.version_info[0] < 3:
        data["config"] = data["config"].encode('utf-8')

    # check for configpath if it was changed during changing of the configfile
    if util.key_exist(data, "configuration", "configpath"):
        configpath = os.path.expanduser(
            data["configuration"]["configpath"]
        )
    else:
        configpath = os.path.expanduser(
            self._settings.get(["configuration", "configpath"])
        )
    filename = os.path.basename(file)
    filepath = os.path.join(configpath, file)
    self._settings.set(["configuration", "temp_config"], data)
    if copy_cfg_to_backup(self, filepath):
        if self._parsing_check_response or not check_parse:
            try:
                logger.log_debug(self, "Writing Klipper config to {}".format(filepath))
                with open(filepath, "w") as f:
                    f.write(data)
            except IOError:
                logger.log_error(self, "Error: Couldn't open Klipper config file: {}".format(filepath))
                return False
            else:
                logger.log_debug(self, "Writen Klipper config to {}".format(filepath))
                return True
            finally:
                f.close()

def check_cfg(self, data):
    '''
    --->SyntaxCheck for a given data<----
    '''
    try:
        import configparser
    except ImportError:
        import ConfigParser as configparser

    try:
        dataToValidated = configparser.RawConfigParser(strict=False)
        #
        if sys.version_info[0] < 3:
            buf = StringIO.StringIO(data)
            dataToValidated.readfp(buf)
        else:
            dataToValidated.read_string(data)

        sections_search_list = ["bltouch",
                                "probe"]
        value_search_list = [   "x_offset",
                                "y_offset",
                                "z_offset"]
        try:
            # cycle through sections and then values
            for y in sections_search_list:
                for x in value_search_list:
                    if dataToValidated.has_option(y, x):
                        a_float = dataToValidated.getfloat(y, x)
        except ValueError as error:
            logger.log_error(
                self,
                "Error: Invalid Value for <b>"+x+"</b> in Section: <b>"+y+"</b>\n"
                + "{}".format(str(error))
            )
            util.send_message(
                self,
                "PopUp",
                "warning",
                "OctoKlipper: Invalid Config\n",
                "Config got not saved!\n"
                + "You can reload your last changes\n"
                + "on the 'Klipper Configuration' tab.\n\n"
                + "Invalid Value for <b>"+x+"</b> in Section: <b>"+y+"</b>\n"
                + "{}".format(str(error))
            )
            return False
    except configparser.Error as error:
        if sys.version_info[0] < 3:
            error.message = error.message.replace("\\n","")
            error.message = error.message.replace("file: u","Klipper Configuration", 1)
            error.message = error.message.replace("'","", 2)
            error.message = error.message.replace("u'","'", 1)

        else:
            error.message = error.message.replace("\\n","")
            error.message = error.message.replace("file:","Klipper Configuration", 1)
            error.message = error.message.replace("'","", 2)
        logger.log_error(
            self,
            "Error: Invalid Klipper config file:\n"
            + "{}".format(str(error))
        )
        util.send_message(self, "PopUp", "warning", "OctoKlipper: Invalid Config data\n",
                            "Config got not saved!\n"
                            + "You can reload your last changes\n"
                            + "on the 'Klipper Configuration' tab.\n\n"
                            + str(error))
        return False
    else:
        return True

def copy_cfg(self, file, dst):
    """
    Copy the file from src aka file to dst
    """
    from shutil import copy

    if os.path.isfile(file):
        try:
            copy(file, dst)
        except IOError:
            logger.log_error(
                self,
                "Error: Klipper config file not found at: {}".format(file)
            )
            return "False"
        else:
            logger.log_debug(
                self,
                "File copied: "
                + file
            )
            return "True"
    return "False"

def copy_cfg_to_backup(self, src):
    """
    Copy the config file to the data folder of OctoKlipper
    returns boolean
    """
    from shutil import copyfile
    if os.path.isfile(src):
        cfg_path = os.path.join(self.get_plugin_data_folder(), "configs", "")
        filename = os.path.basename(src)
        if not os.path.exists(cfg_path):
            try:
                os.mkdir(cfg_path)
            except OSError:
                logger.log_error(self, "Error: Creation of the directory {} failed".format(cfg_path))
                return False
            else:
                logger.log_debug(self, "Directory {} created".format(cfg_path))

        dst = os.path.join(cfg_path, filename)
        logger.log_debug(self, "copy_cfg_to_backup:" + src + " to " + dst)
        if not src == dst:
            try:
                copyfile(src, dst)
            except IOError:
                logger.log_error(
                    self,
                    "Error: Couldn't copy Klipper config file to {}".format(dst)
                )
                return False
            else:
                logger.log_debug(self, "CfgBackup " + dst + " writen")
                return True
    else:
        return False

def remove_cfg(self, file):

    if util.file_exist(self, file):
        filepath = os.path.split(file)
        try:
            os.remove(file)
        except IOError:
            logger.log_error(
                self,
                "Error: Klipper config file not found at: {}".format(
                    file)
            )
            responseText = "Error: Klipper config file not found at: {}".format(file)
            return responseText
        else:
            return "OK"


