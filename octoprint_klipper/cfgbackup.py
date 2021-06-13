def list_bak_files(self):
    files = []
    bak_config_path = os.path.join(self.get_plugin_data_folder(), "configs", "*")
    cfg_files = glob.glob(bak_config_path)
    self.log_debug("list_bak_files Path: " + bak_config_path)
    for f in cfg_files:
        filesize = os.path.getsize(f)
        filemdate = time.localtime(os.path.getmtime(f))
        files.append(dict(
            name=os.path.basename(f),
            file=f,
            size=" ({:.1f} KB)".format(filesize / 1000.0),
            mdate=time.strftime("%d.%m.%Y %H:%M", filemdate)
        ))
        self.log_debug("list_bak_files " + f)
    return dict(data = files)

def restore_cfg_from_backup(self, file, dst):
    """
    Copy the file from src aka file to dst
    """
    from shutil import copy

    if os.path.isfile(file):
        try:
            copy(file, dst)
        except IOError:
            self.log_error(
                "Error: Klipper config file not found at: {}".format(
                    file)
            )
        else:
            self.log_debug("File copied: " + file)
            return dict(text = True)
    return dict(text = False)

def copy_cfg_to_backup(self, src):
    """
    Copy the config file to the data folder of OctoKlipper
    """
    from shutil import copyfile
    if self.file_exist(src):
        cfg_path = os.path.join(self.get_plugin_data_folder(), "configs", "")
        filename = os.path.basename(src)
        if not os.path.exists(cfg_path):
            try:
                os.mkdir(cfg_path)
            except OSError:
                self.log_error("Error: Creation of the directory {} failed".format(cfg_path))
            else:
                self.log_debug("Directory {} created".format(cfg_path))

        dst = os.path.join(cfg_path, filename)
        self.log_debug("copy_cfg_to_backup:" + src + " to " + dst)
        if not src == dst:
            try:
                copyfile(src, dst)
            except IOError:
                self.log_error(
                    "Error: Couldn't copy Klipper config file to {}".format(
                        dst)
                )
            else:
                self.log_debug("CfgBackup " + dst + " writen")
