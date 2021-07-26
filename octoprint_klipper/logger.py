from . import util

def log_info(self, message):
    self._octoklipper_logger.info(message)
    util.send_message(self, "log", "info", message, message)

def log_debug(self, message):
    self._octoklipper_logger.debug(message)
    self._logger.info(message)
    # sends a message to frontend(in klipper.js -> self.onDataUpdaterPluginMessage) and write it to the console.
    # _mtype, subtype=debug/info, title of message, message)
    util.send_message(self, "console", "debug", message, message)

def log_error(self, error):
    self._octoklipper_logger.error(error)
    self._logger.error(error)
    util.send_message(self, "log", "error", error, error)
