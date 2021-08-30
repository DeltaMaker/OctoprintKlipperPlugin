from __future__ import absolute_import, division, print_function, unicode_literals
import glob
import os, time, sys

from . import util, logger
from octoprint.util import is_hidden_path
import flask
from flask_babel import gettext

def list_cfg_files(self, path: str) -> list:
    """Generate list of config files.

    Args:
        path (str): Path to the config files.

    Returns:
        list: for every file a dict with keys for name, file, size, mdate, url.
    """

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

    f_counter = 1
    for f in cfg_files:
        filesize = os.path.getsize(f)
        filemdate = time.localtime(os.path.getmtime(f))
        files.append(dict(
            name=os.path.basename(f),
            file=f,
            size=" ({:.1f} KB)".format(filesize / 1000.0),
            mdate=time.strftime("%d.%m.%Y %H:%M", filemdate),
            url= flask.url_for("index")
                + "plugin/klipper/download/"
                + os.path.basename(f),
        ))
        logger.log_debug(self, "list_cfg_files " + str(f_counter) + ": " + f)
        f_counter += 1
    return files

def get_cfg(self, file):
    """Get the content of a configuration file.

    Args:
        file (str): The name of the file to read

    Returns:
        dict:
            config (str): The configuration of the file
            text (str): The text of the error
    """

    response = {"config":"",
                "text": ""}
    if not file:
        cfg_path = os.path.expanduser(
            self._settings.get(["configuration", "configpath"])
        )
        file = os.path.join(cfg_path, "printer.cfg")
    if util.file_exist(self, file):
        logger.log_debug(self, "get_cfg_files Path: " + file)
        try:
            with open(file, "r") as f:
                response['config'] = f.read()
        except IOError as Err:
            logger.log_error(
                self,
                "Error: Klipper config file not found at: {}".format(file)
                + "\n IOError: {}".format(Err)
            )
            response['text'] = Err
            return response
        else:
            if sys.version_info[0] < 3:
                response['config'] = response.config.decode('utf-8')
            return response
        finally:
            f.close()
    else:
        response['text'] = gettext("File not found!")
        return response

def save_cfg(self, content, filename="printer.cfg"):
    """Save the configuration file to given file.

    Args:
        content (str): The content of the configuration.
        filename (str): The filename of the configuration file. Default is "printer.cfg"

    Returns:
        bool: True if the configuration file was saved successfully. Otherwise False
    """

    logger.log_debug(
        self,
        "Save klipper config"
    )

    if sys.version_info[0] < 3:
        content = content.encode('utf-8')
    check_parse = self._settings.get(["configuration", "parse_check"])
    logger.log_debug(self, "check_parse on filesave: {}".format(check_parse))
    configpath = os.path.expanduser(self._settings.get(["configuration", "configpath"]))
    filepath = os.path.join(configpath, filename)

    logger.log_debug(self, "save filepath: {}".format(filepath))

    self._settings.set(["configuration", "temp_config"], content)
    check = True
    if check_parse:
        check=check_cfg(self, content)
    if check == True:
        try:
            logger.log_debug(self, "Writing Klipper config to {}".format(filepath))
            with open(filepath, "w") as f:
                f.write(content)
        except IOError:
            logger.log_error(self, "Error: Couldn't open Klipper config file: {}".format(filepath))
            return False
        else:
            logger.log_debug(self, "Writen Klipper config to {}".format(filepath))
            return True
        finally:
            f.close()
            copy_cfg_to_backup(self, filepath)
    else:
        return False

def check_cfg(self, data):
    """Checks the given data on parsing errors.

    Args:
        data (str): Content to be validated.

    Returns:
        bool: True if the data is valid. False if it is not.
    """

    try:
        import configparser
    except ImportError:
        import ConfigParser as configparser

    try:
        dataToValidated = configparser.RawConfigParser(strict=False)
        if sys.version_info[0] < 3:
            import StringIO
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
                        if a_float:
                            pass
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
                "Config got not saved!\n\n"
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
                            "Config got not saved!\n\n"
                            + str(error))

        return False
    else:
        return True

def copy_cfg(self, file, dst):
    """Copy the config file to the destination.

    Args:
        file (str): Filepath of the config file to copy.
        dst (str): Path to copy the config file to.

    Returns:
        bool: True if the copy succeeded, False otherwise.
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
            return False
        else:
            logger.log_debug(
                self,
                "File copied: "
                + file
            )
            return True
    return False

def copy_cfg_to_backup(self, src):
    """Copy the config file to backup directory of OctoKlipper.

    Args:
        src (str): Path to the config file to copy.

    Returns:
        bool: True if the config file was copied successfully. False otherwise.
    """
    from shutil import copyfile

    if os.path.isfile(src):
        cfg_path = os.path.join(self.get_plugin_data_folder(), "configs", "")
        filename = os.path.basename(src)
        if not os.path.exists(cfg_path):
            try:
                os.mkdir(cfg_path)
            except OSError:
                logger.log_error(self, "Error: Creation of the backup directory {} failed".format(cfg_path))
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
    else:
        return False


