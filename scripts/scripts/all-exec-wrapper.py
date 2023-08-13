#!/usr/bin/env python3.10
# Copyright 2023, Nice Guy IT, LLC. All rights reserved.
# SPDX-License-Identifier: MIT
# Source: https://github.com/NiceGuyIT/pimp-my-tactical

"""
all-exec-wrapper will run a script from a URL. The binary is downloaded to EXEC_BIN_DIR if it doesn't exist. The
script is downloaded from the URL into a tmp file, and then the binary is executed passing the script as an argument.

Uninstallation is done by removing the binaries downloaded to EXEC_BIN_DIR. all-exec-wrapper does not keep track of
the binaries.

The requests module is not a base module and required.

Environmental variables
- EXEC_PROGRAM is the program to run.
- EXEC_LOG_LEVEL sets the log level.
- EXEC_BIN_DIR is the directory to save the binaries.
  Default:
    Windows: 'C:\\ProgramData\\exec-wrapper\\bin'
    *nix: '/opt/exec-wrapper/bin'
"""
import logging
import os
import platform
import requests
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


def download_binary(binary: str) -> None:
    """
    Download the binary and copy it to bin_dir.
    """
    global tmp_dir, bin_dir, logger

    url = get_download_url(binary)
    if url is None:
        return None

    exe_ext = get_exe_ext()
    filename = os.path.join(bin_dir, f'{binary}{exe_ext}')

    try:
        logger.debug(f'Downloading binary from URL "{url}" to file "{filename}"')
        response = requests.get(url, stream=True)
        logger.debug(f'Status code: {response.status_code}')
        file = open(filename, 'wb')
        file.write(response.content)
        file.close()
        response.close()
        os.chmod(filename, 0o755)
    except:
        logger.error(f'Failed to download binary from URL "{url}"')
        raise


def download_script(url: str) -> str:
    """
    Download the script to tmp_dir.
    """
    global tmp_dir, bin_dir, logger

    # exe_ext = get_exe_ext()
    # filename = os.path.join(tmp_dir, tempfile.TemporaryFile())
    filename = tmp_dir

    try:
        logger.debug(f'Downloading script from URL "{url}" to file "{filename}"')
        response = requests.get(url, stream=True)
        logger.debug(f'Status code: {response.status_code}')
        file = open(filename, 'wb')
        file.write(response.content)
        file.close()
        response.close()
        return filename
    except:
        logger.error(f'Failed to download binary from URL "{url}"')
        raise


def exec_script(binary: str, script: str) -> str:
    """
    Execute the script as a parameter to the binary.
    :param binary: Binary to execute.
    :type binary: str
    :param script: Script to pass to the binary.
    :type script: str
    :return: Script output.
    :rtype: str
    """
    # Run the script as a parameter to the binary.
    if binary == 'rustpython':
        command = [
            binary, '-c', script
        ]
    elif binary == 'deno':
        command = [
            binary, '-c', script
        ]
    elif binary == 'nushell':
        command = [
            binary, '-c', script
        ]
    else:
        logger.error(f'Unknown binary "{binary}"')
        raise ValueError(f'Unknown binary "{binary}"')

    try:
        logger.info(f'Executing "{command}"')
        output = subprocess.check_output(command, universal_newlines=True)
        logger.info(f'Output from script:')
        print(output)
        return output
    except subprocess.CalledProcessError as err2:
        logger.error(f'Failed to exec: {command}')
        # logger.error(traceback.format_exc())
        logger.error(err2)
        raise


def is_installed(binary: str) -> bool:
    """
    Check if the binary is installed in bin_dir.
    :param binary: Filename to test if installed.
    :type binary: str
    :return: True if the binary file exists (i.e. installed) in bin_dir; False otherwise
    :rtype: bool
    """
    global bin_dir, logger
    exe_ext = get_exe_ext()
    if not os.path.isfile(os.path.join(bin_dir, f'{binary}{exe_ext}')):
        logger.info(f'{binary}{exe_ext} is not installed in {bin_dir}')
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


def set_bin_dir() -> None:
    """
    set_bin_dir will set the bin directory (BIN_DIR). The env variable EXEC_BIN_DIR will be used if defined.
    :return: The full path to the bin directory is returned.
    :rtype: str
    """
    global bin_dir, tmp_dir
    bin_dir = ''
    if "EXEC_BIN_DIR" in os.environ:
        bin_dir = os.path.normpath(os.getenv('EXEC_BIN_DIR'))
    else:
        os_name = get_os_name()
        bin_dir_map = {
            'linux': '/opt/exec-wrapper/bin',
            'darwin': '/opt/exec-wrapper/bin',
            'windows': 'C:/ProgramData/exec-wrapper/bin',
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
    :type cleanup: bool
    """
    global tmp_dir
    if tmp_dir is None:
        # tmp_dir has not been assigned yet.
        if cleanup:
            # TemporaryDirectory() will delete the directory afterward. This is used for production.
            # tmp_dir = tempfile.TemporaryDirectory().name
            tmp_dir = tempfile.TemporaryFile().name
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
        log_level = os.getenv('EXEC_LOG_LEVEL', 'INFO').upper()
        log_format = '%(asctime)s %(levelname)s %(funcName)s(%(lineno)d): %(message)s'
        logging.basicConfig(format=log_format, level=log_level)
        logger = logging.getLogger()
        logger.setLevel(log_level)
    return logger


def get_download_url(binary: str) -> str:
    """
    Get the download URL for the binary.
    :param binary: Name of the binary.
    :type binary: str
    :return: The URL to download the binary.
    :rtype: str
    """
    global logger
    os_name = get_os_name()
    arch_name = get_arch_name()
    url_map = {
        'linux': {
            'x86_64': {
                'deno': 'https://github.com/NiceGuyIT/binaries/raw/main/deno/deno-x86_64-unknown-linux-gnu',
                'nushell': 'https://github.com/NiceGuyIT/binaries/raw/main/nushell/nu-x86_64-unknown-linux-musl',
                'rustpython': 'https://github.com/NiceGuyIT/binaries/raw/main/rustpython/rustpython-x86_64-unknown-linux-gnu',
            }
        },
        'darwin': {
            'aarm64': {
                'deno': 'https://github.com/NiceGuyIT/binaries/raw/main/deno/deno-aarch64-apple-darwin',
                'nushell': 'https://github.com/NiceGuyIT/binaries/raw/main/nushell/nu-aarch64-apple-darwin',
                'rustpython': 'https://github.com/NiceGuyIT/binaries/raw/main/rustpython/rustpython-aarch64-apple-darwin',
            },
        },
        'windows': {
            'x86_64': {
                'deno': 'https://github.com/NiceGuyIT/binaries/raw/main/deno/deno-x86_64-pc-windows-msvc.exe',
                'nushell': 'https://github.com/NiceGuyIT/binaries/raw/main/nushell/nu-x86_64-pc-windows-msvc.exe',
                'rustpython': 'https://github.com/NiceGuyIT/binaries/raw/main/rustpython/rustpython-x86_64-pc-windows-gnu.exe',
            }
        },
    }
    if os_name in url_map and arch_name in url_map[os_name] and binary in url_map[os_name][arch_name]:
        bin_url = url_map[os_name][arch_name][binary]
        logger.debug(f'get_download_url: URL: {bin_url}')
        return url_map[os_name][arch_name][binary]
    else:
        logger.error(f'Unsupported OS "{os_name}" or architecture "{arch_name}"')
        raise ValueError(f'Unsupported OS "{os_name}" or architecture "{arch_name}"')


def main():
    """
    The main function is to download the binary and script, and then run the binary passing the script as an argument.
    """
    global bin_dir, tmp_dir, logger

    set_tmp_dir(False)
    set_bin_dir()
    logger.debug(f'tmp_dir: {tmp_dir}')
    logger.debug(f'bin_dir: {bin_dir}')

    if not os.path.isdir(bin_dir):
        # Create bin_dir and all parent directories
        os.makedirs(bin_dir)

    binary = None
    if "EXEC_BINARY" in os.environ:
        binary = os.getenv('EXEC_BINARY')
    else:
        logger.error('EXEC_BINARY environment variable is not defined')
        raise ValueError('EXEC_BINARY environment variable is not defined')

    try:
        # Download the binary
        if not is_installed(binary):
            download_binary(binary)
    except:
        logger.error(f'Failed to download the binary "{binary}"')
        raise ValueError(f'Failed to download the binary "{binary}"')

    script_url = None
    if "EXEC_SCRIPT_URL" in os.environ:
        script_url = os.getenv('EXEC_SCRIPT_URL')
    else:
        logger.error('EXEC_SCRIPT_URL environment variable is not defined')
        raise ValueError('EXEC_SCRIPT_URL environment variable is not defined')

    script = None
    try:
        # Download the script
        script = download_script(script_url)
    except:
        logger.error(f'Failed to download the script from URL "{script_url}"')
        raise ValueError(f'Failed to download the script from URL "{script_url}"')

    try:
        exec_script(binary, script)
    except:
        logger.error(f'Failed to run the script "{script_url}" with the binary "{binary}"')
        raise ValueError(f'Failed to run the script "{script_url}" with the binary "{binary}"')

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
