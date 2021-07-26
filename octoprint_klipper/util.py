def poll_status(self):
    self._printer.commands("STATUS")

def update_status(self, type, status):
    send_message(self, "status", type, status, status)

def file_exist(self, filepath):
    '''
    Returns if a file exists and shows PopUp if not
    '''
    from os import path
    if not path.isfile(filepath):
        send_message(self, "PopUp", "warning", "OctoKlipper Settings",
                          "Klipper " + filepath + " does not exist!")
        return False
    else:
        return True

def key_exist(dict, key1, key2):
    try:
        dict[key1][key2]
    except KeyError:
        return False
    else:
        return True

def send_message(self, type, subtype, title, payload):
        """
        Send Message over API to FrontEnd
        """
        import datetime
        self._plugin_manager.send_plugin_message(
            self._identifier,
            dict(
                time=datetime.datetime.now().strftime("%H:%M:%S"),
                type=type,
                subtype=subtype,
                title=title,
                payload=payload
            )
        )
