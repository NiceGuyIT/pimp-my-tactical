#!/usr/bin/env python3.10
# Copyright 2023, Nice Guy IT, LLC. All rights reserved.
# SPDX-License-Identifier: MIT
# Source: https://github.com/NiceGuyIT/trmm-scripts

"""
all-task-runner will run tasks from a repo using 'task'. The tasks are downloaded into a temp directory defined by
Python, which is automatically deleted afterward. Binaries are downloaded into RUNNER_BIN_DIR. If 'task' does not
exist, it will be downloaded into RUNNER_BIN_DIR and the task 'init:all` will be run to download other necessary
binaries. Any temporary files, such as configuration files, are stored in the temporary directory, to be cleaned up
when the task is done.

Uninstallation is done by removing the binaries downloaded to RUNNER_BIN_DIR. all-task-runner does not keep track of
these binaries.

Python 3.7 or higher is required for dataclasses.
The requests module is not a base module and required.

Environmental variables
- RUNNER_LIBRARY_LOCATION is the location of the taskfiles library. This can be either a git URI (git clone), GitHub
  repo owner and name (repo to download), or file path.
  Default: 'NiceGuyIT/taskfiles'
- RUNNER_LIBRARY_TYPE is one of git, repo or filesystem.
  Default: 'repo'
  - git will 'git clone $RUNNER_TASK_LOCATION'.
  - repo will download the latest release ZIP from GitHub. Other sources are not supported.
  - filesystem will not do anything special.
- RUNNER_TASK_LOCATION is the location of *your* taskfiles to run. This can be either a git URI (git clone), GitHub
  repo owner and name (repo to download), or file path.
- RUNNER_TASK_TYPE is one of git, repo or filesystem.
  - git will 'git clone $RUNNER_TASK_LOCATION'.
  - repo will download the latest release ZIP from GitHub. Other sources are not supported.
  - filesystem will not do anything special.
- RUNNER_TASK_NAME is the name of the task to run.
- RUNNER_TASK_ARGS is the task arguments.
- RUNNER_LOG_LEVEL sets the log level.
- RUNNER_BIN_DIR is the directory to save the binaries. Taskfiles uses TASKFILE_BIN_DIR which is set from
  RUNNER_BIN_DIR.
  Default:
    Windows: 'C:\\ProgramData\\task-runner\\bin'
    *nix: '/opt/task-runner/bin'
"""
import dataclasses
import json
import logging
import os
import platform
import re
import requests
import shutil
import subprocess
import tempfile

"""
logger is the global logging instance set by get_logger().
"""
logger: logging.Logger | None = None

"""
tmp_dir is global because it references a randomly generated directory.
Note: The initial value is the system tmp directory. It's assigned a random directory in set_tmp_dir().
"""
tmp_dir: str | None = None

"""
bin_dir is the directory that holds the binaries.
"""
bin_dir: str | None = None


@dataclasses.dataclass
class GitHubRepo:
    """
    Class for GitHub repositories.
    :param name: Repo name.
    :type name: str
    :param asset_name: Asset name in the API JSON.
    :type asset_name: str
    :param asset_separator: Asset name in the API JSON.
    :type asset_separator: str
    :param asset_version: Asset name in the API JSON.
    :type asset_version: str
    :param asset_search: Asset name in the API JSON.
    :type asset_search: str
    :param asset_compress_ext: Compression extension.
    :type asset_compress_ext: str
    :param asset_exe_ext: Executable extension.
    :type asset_exe_ext: str
    :param asset_browser_url: Asset browser URL to download the release.
    :type asset_browser_url: str
    :param latest_json: Latest json downloaded from the repo.
    :type latest_json: any
    """
    name: str
    asset_name: str
    asset_os: str
    asset_arch: str
    asset_search: str
    asset_compress_ext: str = ''
    asset_exe_ext: str = ''
    asset_separator: str = '-'
    asset_version: str = dataclasses.field(init=False)
    asset_browser_url: str = dataclasses.field(init=False)
    json_name: str = dataclasses.field(init=False)
    json_tag_name: str = dataclasses.field(init=False)
    json_asset_name: str = dataclasses.field(init=False)
    json_download_url: str = dataclasses.field(init=False)
    api_url: str = dataclasses.field(init=False)
    # Python 3.10 can use | instead of Union[]
    # See https://docs.python.org/3.10/library/stdtypes.html#types-union
    latest_json: any = dataclasses.field(init=False)

    def __post_init__(self):
        self.latest_json = {}
        self.asset_version = ''
        self.asset_browser_url = ''
        self.json_name = ''
        self.json_tag_name = ''
        self.json_asset_name = ''
        self.json_download_url = ''
        self.api_url = ''

    def get_api_url(self):
        """
        Get the GitHub API URL for the repo.
        :return: GitHub API URL
        :rtype: str
        """
        self.api_url = f'https://api.github.com/repos/{self.name}/releases/latest'

    def get_latest_json(self) -> None:
        """
        get_latest_json will get the JSON for the latest release using GitHub's API.
        :return: JSON object
        :rtype: any
        """
        global logger
        if self.latest_json:
            logger.debug(f'GitHubRepo: latest_json is already downloaded.')
            return

        try:
            logger.debug(f'GitHubRepo: Downloading JSON from URL "{self.name}" for "{self.name}"')
            # Get the release JSON from GitHub's API
            self.get_api_url()
            response = requests.get(self.api_url, stream=True)
            self.latest_json = json.loads(response.content)
            if self.latest_json == '':
                logger.error(f'GitHubRepo: Failed to download JSON from GitHub API for repo "{self.name}"')
                logger.error(self.latest_json)
                raise ValueError(f'Failed to find download JSON from GitHub API for repo "{self.name}"',
                                 'repo', 'latest_json')
            self.json_name = self.latest_json['name']
            self.json_tag_name = self.latest_json['tag_name']
            # The user references "asset_version", not "json_tag_name".
            self.asset_version = self.latest_json['tag_name']
        except:
            logger.error(f'Failed to get the latest JSON from GitHub')
            raise

    def get_json_value(self, key: str) -> str:
        """
        Get the value in the latest JSON for the given key.
        :param key: The key name in the JSON.
        :type key: str
        :return: The value of the key.
        :rtype: str
        """
        global logger
        if not self.latest_json:
            logger.debug(f'GitHubRepo: self.latest_json is empty: "{self.latest_json}"')
            self.get_latest_json()
        return self.latest_json[key]

    def get_asset_basename(self) -> str:
        """
        Get the asset basename without the compression extension.
        :return: The asset basename
        :rtype: str
        """
        global logger
        if not self.latest_json:
            logger.debug(f'GitHubRepo: self.latest_json is empty: "{self.latest_json}"')
            self.get_latest_json()
        return f'{self.json_name}{self.asset_separator}{self.json_tag_name}'

    def get_download_url(self) -> None:
        """
        get_download_url will get the download URL matching the search regex.
        """
        if self.asset_search is None:
            logger.error(f'GitHubRepo: "{self.asset_search}" is not specified')
            raise ValueError(f'"{self.asset_search}" is not specified',
                             'self.asset_search')

        # Regex to search for the asset
        regex = eval(f"f'{self.asset_search}'")
        asset_regex = re.compile(regex)

        # Find the asset to download
        for asset in self.latest_json['assets']:
            if asset_regex.search(asset["name"]):
                self.json_asset_name = asset['name']
                self.json_download_url = asset['browser_download_url']
                return None

        logger.error(f'GitHubRepo: Failed to find browser_download_url for asset matching regex "{regex}" compiled from "{self.asset_search}"')
        logger.error(self.latest_json)
        raise ValueError(f'Failed to find browser_download_url for asset matching regex "{self.asset_search}"',
                         'asset_url',
                         'search_regexp')

    def download_latest(self, dest_dir=None) -> str:
        """
        download_latest will download the latest release that matches the search_regexp.
        :param dest_dir: Full path to the directory to save the asset
        :type dest_dir: str
        :return: archive_file
        :rtype: str
        """
        try:
            # Find the asset to download
            if not self.latest_json:
                logger.debug(f'GitHubRepo: Calling get_latest_json for "{self.name}" to download into dest_dir "{dest_dir}"')
                self.get_latest_json()
            self.get_download_url()
            logger.debug(f'GitHubRepo: asset_url: {self.json_download_url}')
            logger.debug(f'GitHubRepo: asset_name: {self.json_asset_name}')

            # Download the compressed file
            archive_file = os.path.join(dest_dir, self.json_asset_name)
            self.get_download(archive_file)
            return archive_file
        except:
            logger.error(f'Failed to download latest from URL "{self.json_download_url}" into dest_dir "{dest_dir}"')
            raise

    def get_download(self, filename=None):
        """
        get_download will download a file from a URL.

        :param filename: Filename (full path) to save the download
        :type filename: str
        """
        if not self.json_download_url:
            logger.error(f'GitHubRepo: URL is not empty. json_download_url: "{self.json_download_url}"')
            raise ValueError(f'URL is not empty. json_download_url: "{self.json_download_url}"')

        try:
            logger.debug(f'GitHubRepo: Downloading JSON from URL "{self.json_download_url}" to file "{filename}"')
            response = requests.get(self.json_download_url, stream=True)
            file = open(filename, 'wb')
            file.write(response.content)
            file.close()
            response.close()
        except:
            logger.error(f'GitHubRepo: Failed to download JSON from URL "{self.json_download_url}"')
            raise


@dataclasses.dataclass
class Decompress:
    """
    Class to decompress ZIP and tar.gz files.
    :param archive: Archive filename
    :type archive: str
    """
    archive: str

    def extract_to(self, dest_dir: str):
        """
        extract_to will extract the archive in the given dest_dir.
        :param dest_dir: Destination directory to extract the archive.
        :type dest_dir: str
        """
        global logger
        if self.archive == '':
            logger.error(f'Decompress: Archive file "{self.archive}" is not specified')
            raise ValueError(f'Archive file "{self.archive}" is not specified',
                             'self.archive')
        if dest_dir == '':
            logger.error(f'Decompress: Destination dir "{dest_dir}" is not specified')
            raise ValueError(f'Destination dir "{dest_dir}" is not specified',
                             'dest_dir')

        if self.archive.endswith('.zip'):
            logger.debug(f'Decompress: Importing zipfile module')
            import zipfile
            logger.debug(f'Decompress: Extracting files from "{self.archive}" into dir "{dest_dir}"')
            with zipfile.ZipFile(self.archive, 'r') as zip_file:
                zip_file.extractall(dest_dir)

        elif self.archive.endswith('.tar.gz') or self.archive.endswith('.tgz'):
            logger.debug(f'Decompress: Importing tarfile module')
            import tarfile
            logger.debug(f'Decompress: Extracting files from "{self.archive}" into dir "{dest_dir}"')
            tar = tarfile.open(self.archive, "r:gz")
            tar.extractall(dest_dir)
            tar.close()

        else:
            logger.info(f'Decompress: Archive file "{self.archive}" does not end with ".zip" or ".tar.gz"')
            raise ValueError(f'Archive file "{self.archive}" does not end with ".zip" or ".tar.gz"',
                             'self.archive')


@dataclasses.dataclass
class TaskRunner:
    """
    Class for task files to be run.
    :param location: Location of the taskfiles. This is one of:
        - a git URI (git clone)
        - GitHub repo owner and name (repo to download)
        - absolute file path
    :type location: str
    :param type: Type of taskfiles corresponding to the location. This is one of:
        - git will 'git clone $RUNNER_TASK_LOCATION'.
        - repo will download the latest release ZIP from GitHub. Other sources are not supported.
        - filesystem will not do anything special.
    :type type: str
    :param tmp_dir: Temporary directory to use to download files.
    :type tmp_dir: str
    """
    name: str
    location: str
    type: str
    tmp_dir: str = dataclasses.field(init=False)
    taskfile_dir: str = dataclasses.field(init=False)

    def __post_init__(self):
        self.taskfile_dir = ''

    def set_tmp_dir(self):
        """
        Create a working directory in tmp_dir based on the name
        """
        global tmp_dir
        self.tmp_dir = os.path.join(tmp_dir, self.name)
        if self.name is not None and not os.path.isdir(self.tmp_dir):
            os.makedirs(self.tmp_dir)


    def download_repo(self) -> str:
        """
        Download the taskfiles and extract them to the temporary directory.
        :return: The asset directory is returned.
        :rtype: str
        """
        global logger

        if self.type != 'repo':
            logger.info(f'TaskRunner: Location type is not repo. Skipping. type="{self.type}" location="{self.location}"')
            self.taskfile_dir = self.location
            # The asset directory is the location of the taskfiles.
            return self.location

        asset_dir = ''
        asset_name = ''
        try:
            (_, asset_name) = self.location.split('/')
            logger.debug(f'TaskRunner: Creating new GitHubRepo: name: "{self.location}"; asset_name: {asset_name}')
            github_repo = GitHubRepo(**{
                'name': self.location,
                'asset_name': asset_name,
                'asset_os': '',
                'asset_arch': '',
                'asset_separator': '-',
                'asset_search': '{self.asset_name}{self.asset_separator}{self.asset_version}{self.asset_compress_ext}',
                'asset_exe_ext': '',
                'asset_compress_ext': get_compress_ext(),
            })
            logger.debug(f'TaskRunner: GitHubRepo created')
        except:
            logger.error(f'TaskRunner: Failed to create GitHubRepo: asset_name: "{asset_name}", name: "{self.location}"')
            raise

        try:
            asset_basename = github_repo.get_asset_basename()
            logger.debug(f'TaskRunner: download_latest(): asset_basename: "{asset_basename}')
            archive_file = github_repo.download_latest(self.tmp_dir)
            logger.debug(f'TaskRunner: download_latest(): archive_file: "{archive_file}')
        except:
            logger.error(f'TaskRunner: Failed to download the latest release')
            raise

        try:
            # Extract the latest release for taskfiles
            os_name = get_os_name()
            (asset_dir, _) = os.path.splitext(archive_file)
            if os_name == 'linux' or os_name == 'darwin':
                decompress = Decompress(archive_file)
                decompress.extract_to(self.tmp_dir)
                # Need to remove one more extension for the '.tar' in .tar.gz
                (asset_dir, _) = os.path.splitext(asset_dir)
            elif os_name == 'windows':
                decompress = Decompress(archive_file)
                decompress.extract_to(self.tmp_dir)
            else:
                logger.error(f'TaskRunner: Unsupported OS: "{os_name}"')
                raise ValueError(f'Unsupported OS: "{os_name}"', 'os_name')
        except:
            logger.error(f'TaskRunner: Failed to extract the archive')
            raise

        try:
            self.taskfile_dir = os.path.join(self.tmp_dir, asset_dir)
            if not os.path.isdir(self.taskfile_dir):
                logger.error(f'TaskRunner: Failed to extract files from latest release download')
                logger.error(f'TaskRunner: tmp_dir: "{self.tmp_dir}"')
                logger.error(f'TaskRunner: asset_dir: "{asset_dir}"')
                logger.error(f'TaskRunner: asset_dir: "{asset_name}"')
                raise ValueError(f'Failed to extract files from latest_json download',
                                 f'tmp_dir: {self.tmp_dir}',
                                 f'asset_dir: {asset_dir}',
                                 f'asset_name: {asset_name}')
            return asset_dir
        except:
            logger.error(f'TaskRunner: Failed to download repository of type "{self.type}" from "{self.location}"')
            raise

    def run_task(self, task_name: str, task_args=None) -> str:
        """
        run_task will run the 'task_name' task in the 'self.taskfile_dir' directory providing the 'task_args' as
        arguments. The output from the task is returned.
        :param task_name: Task name to run
        :type task_name: str
        :param task_args: Task arguments
        :type task_args: str
        :return: Output (STDOUT) from the task
        :rtype: str
        """
        global bin_dir, logger

        if self.taskfile_dir == '':
            logger.warning(f'TaskRunner: taskfile_dir "{self.taskfile_dir}" is not set. This should be set in the calling function.')
            raise ValueError(f'taskfile_dir "{self.taskfile_dir}" is not set. This should be set in the calling function.',
                             'taskfile_dir')

        if task_name == '':
            logger.warning(f'TaskRunner: task_name "{task_name}" is not set. This should be set in the calling function.')
            raise ValueError(f'task_name "{task_name}" is not set. This should be set in the calling function.',
                             'task_name')

        try:
            os.chdir(self.taskfile_dir)
            exe_ext = get_exe_ext()
            task_bin = os.path.join(bin_dir, f'task{exe_ext}')
            # TASKFILE_BIN_DIR is used as BIN_DIR in NiceGuyIT/Taskfiles
            os.environ['TASKFILE_BIN_DIR'] = bin_dir

            args = set()
            if task_args is not None:
                args = set(task_args)
            command = [
                task_bin, '--verbose', task_name, *args
            ]
            logger.info(f'TaskRunner: Executing task "{task_name}" with command "{command}"')
            output = subprocess.check_output(command, universal_newlines=True)
            logger.info(f'TaskRunner: Output from task "{task_name}":')
            print(output)
            return output
        except subprocess.CalledProcessError as err2:
            logger.error(f'TaskRunner: Failed to exec task: {task_name}')
            # logger.error(traceback.format_exc())
            logger.error(err2)
            raise


def download_task():
    """
    Download the task binary and copy it to bin_dir.
    """
    global tmp_dir, bin_dir, logger

    os_name = get_os_name()
    exe_ext = get_exe_ext()
    github_repo = GitHubRepo(**{
        'name': 'go-task/task',
        'asset_name': 'task',
        'asset_os': os_name,
        'asset_arch': get_arch_name(1),
        'asset_separator': '_',
        # asset_search is the format string to search for an asset from the API JSON.
        'asset_search': '{self.asset_name}{self.asset_separator}{self.asset_os}{self.asset_separator}{self.asset_arch}{self.asset_compress_ext}',
        'asset_exe_ext': exe_ext,
        'asset_compress_ext': get_compress_ext(),
    })

    archive_file = github_repo.download_latest(tmp_dir)
    logger.debug(f'archive_file: {archive_file}')
    logger.debug(f'github_repo.json_asset_name: {github_repo.json_asset_name}')

    # Extract the latest release for task
    if os_name == 'linux' or os_name == 'darwin':
        (archive_name, _) = os.path.splitext(github_repo.json_asset_name)
        (asset_dir, _) = os.path.splitext(archive_name)
        asset_dir = os.path.join(tmp_dir, asset_dir)
        decompress = Decompress(archive_file)
        decompress.extract_to(asset_dir)
    elif os_name == 'windows':
        (asset_dir, _) = os.path.splitext(github_repo.json_asset_name)
        asset_dir = os.path.join(tmp_dir, asset_dir)
        decompress = Decompress(archive_file)
        decompress.extract_to(tmp_dir)
    else:
        logger.error(f'Unsupported OS: "{os_name}"')
        raise ValueError(f'Unsupported OS: "{os_name}"', 'os_name')

    asset_exe = os.path.join(asset_dir, f'task{exe_ext}')
    logger.debug(f'asset_exe: {asset_exe}')
    if not os.path.isfile(asset_exe):
        logger.error(f'Failed to extract files from latest_json download')
        logger.error(f'tmp_dir: "{tmp_dir}"')
        logger.error(f'asset_dir: "{asset_dir}"')
        logger.error(f'asset_exe: "{asset_exe}"')
        logger.error(f'github_repo.asset_name: "{github_repo.json_asset_name}"')
        raise ValueError(f'Failed to extract files from latest_json download',
                         f'tmp_dir: {tmp_dir}',
                         f'asset_dir: {asset_dir}',
                         f'github_repo.asset_name: {github_repo.json_asset_name}')

    # Copy the binary to the bin_dir
    shutil.copy(asset_exe, os.path.join(bin_dir, f'task{exe_ext}'))
    # TODO: Is chmod necessary?


def is_installed(bin_name: str) -> bool:
    """
    Check if the necessary task files have been installed. The alternative is to run 'task init:all --status' and check
    the output. This is faster and more succinct.

    :param bin_name: Filename to test if installed.
    :type bin_name: str
    :return: True if the task binary file exists (i.e. installed) in bin_dir; False otherwise
    :rtype: bool
    """
    global bin_dir, logger
    exe_ext = get_exe_ext()
    if not os.path.isfile(os.path.join(bin_dir, f'{bin_name}{exe_ext}')):
        logger.info(f'{bin_name}{exe_ext} is not installed in {bin_dir}')
        return False

    return True


def get_exe_ext() -> str:
    """
    get_exe_ext will return the executable extension. Needed only for Windows.
    :return: The exe extension is returned.
    :rtype: str
    """
    os_name = get_os_name()
    exe_ext = ''
    exe_ext_map = {
        'windows': '.exe',
    }
    if os_name in exe_ext_map:
        exe_ext = exe_ext_map[os_name]
    return exe_ext


def get_compress_ext() -> str:
    """
    get_compress_ext will return the compression extension for the given OS.
    :return: The compression extension is returned.
    :rtype: str
    """
    os_name = get_os_name()
    compress_ext = ''
    compress_ext_map = {
        'linux': '.tar.gz',
        'darwin': '.tar.gz',
        'windows': '.zip',
    }
    if os_name in compress_ext_map:
        compress_ext = compress_ext_map[os_name]
    return compress_ext


def get_arch_name(option: int = 0) -> str:
    """
    get_arch_name will return the architecture name that is optionally mapped to different architectures. This is
    mostly used to map architecture names used in one language to architecture names used in another language.

    :param option: Option to map architecture name to another architecture name.
    :type option: int
    :return: The architecture name is returned.
    :rtype: str
    """
    arch_name = platform.machine().lower()
    if option == 0:
        return arch_name

    if option == 1:
        if arch_name == 'x86_64':
            arch_name = 'amd64'

    return arch_name


def get_os_name() -> str:
    """
    get_os_name will return the OS name in lowercase.

    :return: The operating system name is returned.
    :rtype: str
    """
    return platform.system().lower()


def set_bin_dir():
    """
    set_bin_dir will set the bin directory (BIN_DIR) used by Task in taskfiles. The env variable RUNNER_BIN_DIR will be
    used if defined.
    :return: The full path to the bin directory is returned.
    :rtype: str
    """
    global bin_dir, tmp_dir
    bin_dir = ''
    if "RUNNER_BIN_DIR" in os.environ:
        bin_dir = os.path.normpath(os.getenv('RUNNER_BIN_DIR'))
    else:
        os_name = get_os_name()
        bin_dir_map = {
            'linux': '/opt/task-runner/bin',
            'darwin': '/opt/task-runner/bin',
            'windows': 'C:/ProgramData/task-runner/bin',
        }
        if os_name in bin_dir_map:
            bin_dir = os.path.normpath(bin_dir_map[os_name])
        else:
            # Use the tmp directory as a fallback.
            set_tmp_dir()
            bin_dir = os.path.normpath(tmp_dir)


def set_tmp_dir(cleanup: bool = True):
    """
    set_tmp_dir will set the temporary directory used to store downloaded files.
    :param cleanup: Should the tmp directory be automatically cleaned up?
    :type cleanup: str
    """
    global tmp_dir
    if tmp_dir is None:
        # tmp_dir has not been assigned yet.
        if cleanup:
            # TemporaryDirectory() will delete the directory afterward. This is used for production.
            tmp_dir = tempfile.TemporaryDirectory().name
        else:
            # mkdtemp() does not delete the directory. This is used for testing purposes.
            tmp_dir = tempfile.mkdtemp()


def get_logger() -> logging.Logger:
    """
    get_logger will return a logger to the global logging instance.
    :return: The logger instance.
    :rtype: logging.Logger
    """
    global logger
    if logger is None:
        log_level = os.getenv('RUNNER_LOG_LEVEL', 'INFO').upper()
        log_format = '%(asctime)s %(levelname)s %(funcName)s(%(lineno)d): %(message)s'
        logging.basicConfig(format=log_format, level=log_level)
        logger = logging.getLogger()
        logger.setLevel(log_level)
    return logger


def main():
    """
    The main function is to download the task files, perform a few checks, install some binaries if necessary, and then
    run the task.
    """
    global bin_dir, tmp_dir, logger

    set_tmp_dir(False)
    set_bin_dir()
    logger.debug(f'tmp_dir: {tmp_dir}')
    logger.debug(f'bin_dir: {bin_dir}')

    if not os.path.isdir(bin_dir):
        # Create parent directories as well as bin_dir
        os.makedirs(bin_dir)

    if not is_installed('task'):
        download_task()

    # Task Runner library
    task_library = {
        'location': 'NiceGuyIT/taskfiles',
        'type': 'repo',
    }
    if "RUNNER_LIBRARY_LOCATION" in os.environ:
        task_library['location'] = os.getenv('RUNNER_LIBRARY_LOCATION')
    if "RUNNER_LIBRARY_TYPE" in os.environ:
        task_library['type'] = os.getenv('RUNNER_LIBRARY_TYPE')
    library = TaskRunner(**{
        'name': 'library',
        'location': task_library['location'],
        'type': task_library['type'],
    })
    library.set_tmp_dir()

    # Main Task Runner
    task_runner = {
        'location': None,
        'type': None,
    }
    if "RUNNER_TASK_LOCATION" in os.environ:
        task_runner['location'] = os.getenv('RUNNER_TASK_LOCATION')
    else:
        logger.warning(f'RUNNER_TASK_LOCATION is not defined. Please set the RUNNER_TASK_LOCATION env var.')
        raise ValueError(f'RUNNER_TASK_LOCATION is not defined. Please set the RUNNER_TASK_LOCATION env var.',
                         'RUNNER_TASK_LOCATION')
    if "RUNNER_TASK_TYPE" in os.environ:
        task_runner['type'] = os.getenv('RUNNER_TASK_TYPE')
    else:
        logger.warning(f'RUNNER_TASK_TYPE is not defined. Please set the RUNNER_TASK_TYPE env var.')
        raise ValueError(f'RUNNER_TASK_TYPE is not defined. Please set the RUNNER_TASK_TYPE env var.',
                         'RUNNER_TASK_TYPE')
    runner = TaskRunner(**{
        'name': 'runner',
        'location': task_runner['location'],
        'type': task_runner['type'],
    })
    runner.set_tmp_dir()

    task_dir = ''
    try:
        # Download the taskfiles and extract them to a temp directory
        task_dir = library.download_repo()
    except:
        logger.error(f'Failed to download the library repository "{library.name}"')
        raise

    # TODO: Debugging only
    # task_dir = os.path.normpath('C:/Users/dev/projects/taskfiles')

    # Make sure the necessary binaries are installed
    task_name = 'init:all'
    try:
        _ = library.run_task(**{
            'task_name': task_name,
        })
    except subprocess.CalledProcessError as err2:
        logger.error(f'Failed to exec task: {task_name}')
        # logger.error(traceback.format_exc())
        logger.error(err2)
        # Move out of the temporary directory, so we don't prevent it from being deleted.
        os.chdir(bin_dir)
        raise

    # Task name is required
    if "RUNNER_TASK_NAME" not in os.environ:
        logger.warning(f'RUNNER_TASK_NAME env var is not set. What task should be run?')
        # Move out of the temporary directory, so we don't prevent it from being deleted.
        os.chdir(bin_dir)
        raise ValueError(f'RUNNER_TASK_NAME env var is not set. What task should be run?')
    task_name = os.environ['RUNNER_TASK_NAME']

    # Task args is optional
    task_args = ''
    if "RUNNER_TASK_ARGS" in os.environ:
        task_args = os.environ['RUNNER_TASK_ARGS']

    try:
        logger.debug(f'Attempting to run task "{task_name}" with args "{task_args}"')
        _ = runner.run_task(**{
            'task_name': task_name,
            'task_args': task_args,
        })
    except subprocess.CalledProcessError as err2:
        logger.error(f'Failed to exec task: {task_name}')
        # logger.error(traceback.format_exc())
        logger.error(err2)
        # Move out of the temporary directory, so we don't prevent it from being deleted.
        os.chdir(bin_dir)
        raise ValueError(f'Failed to run task "{task_name}" with args "{task_args}"')

    # Move out of the temporary directory, so we don't prevent it from being deleted.
    os.chdir(bin_dir)

    return


# Main entrance here...
if __name__ == '__main__':
    # Get the logging instance
    logger = get_logger()

    try:
        main()
    except ValueError as err:
        logging.error(f'Failed to finish successfully')
        logging.error(f'Received error: {err}')
        exit(1)

    exit(0)
