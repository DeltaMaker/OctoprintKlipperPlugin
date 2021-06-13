

def file_exist(self, filepath):
    if not os.path.isfile(filepath):
        self.send_message("PopUp", "warning", "OctoKlipper Settings",
                          "Klipper " + filepath + " does not exist!")
        return False
    else:
        return True

def key_exist(self, dict, key1, key2):
    try:
        dict[key1][key2]
    except KeyError:
        return False
    else:
        return True
