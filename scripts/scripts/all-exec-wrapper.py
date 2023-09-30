# The layout of scripts is as follows:
#   shebang (below)
#   Variable declarations
#   Script snippet (below)

############################## ><8 Begin shebang 8>< ##############################
# This will run RustPython on Linux/macOS. Windows uses TacticalRMM's Python distribution.
#!/opt/exec-wrapper/bin/rustpython

############################## ><8 Begin variable declarations (docs) 8>< ##############################
# Variable declarations
# There are 4 types of variables:
#   1. Exec wrapper - Prefixed with 'WRAPPER_', these alter the behavior of the exec wrapper.
#   2. Executable - Prefixed with "EXEC_" and the name of the executable, these alter the behavior of the executable.
#      "EXEC_" is used to prevent mixing with executable environmental variables. For example,
#   3. Language - Prefixed with the name of the (abbreviated) language, these alter the behavior of the language.
#   4. Script - prefixed with the name of the script, these alter the behavior of the script.
#
# Supported variables:
#   WRAPPER_BINARY - Binary to be executed. One of 'deno', 'nushell', 'rustpython'.
#   WRAPPER_BIN_DIR - Directory where the binary is downloaded to and executed from.
#   WRAPPER_DOWNLOAD_URL - Download URL for the binary.
#   WRAPPER_REMOTE_REPO - The URL of the remote repository hosting the script
#   WRAPPER_REMOTE_VERSION - The version of the remote repository, used in the URL to download the script.
#   WRAPPER_REMOTE_SCRIPT - The name of the script to be executed.
#   WRAPPER_LOG_LEVEL - Log level of the exec wrapper.
#
#   EXEC_DENO_RUN_FLAGS - Command line flags for 'deno run'.
#     See https://docs.deno.com/runtime/manual/getting_started/command_line_interface#script-arguments
#     --reload - Reload source code cache (recompile TypeScript)
#   EXEC_DENO_PERMISSION_FLAGS - Script permissions for 'deno run'.
#     See https://docs.deno.com/runtime/manual/basics/permissions
#     --allow-env - Allow environment access
#     --allow-sys - Allow access to APIs that provide information about the operating system
#     --allow-run - Allow running subprocesses
#     --allow-net - Allow network access
#     --allow-read - Allow file system read access
#     --allow-write - Allow file system write access
#
#   TS_LOG_LEVEL - Log level for TypeScript programs.
#     See https://deno.land/std/log/mod.ts?s=LogLevels
#
#   See the script for script specific environmental variables

############################## ><8 Begin Script Snippet 8>< ##############################

# Copyright 2023, Nice Guy IT, LLC. All rights reserved.
# SPDX-License-Identifier: MIT
# Source: https://github.com/NiceGuyIT/pimp-my-tactical
# Version: v0.0.4

"""
all-exec-wrapper will run a script from a URL. The binary doesn't exist, it is downloaded to WRAPPER_BIN_DIR. The
script is downloaded from the URL into a tmp file, and then the binary is executed passing the script as an argument.
Note that deno does not need to download the script as it can run it directly from the command line.

Uninstallation is done by removing the binaries downloaded to WRAPPER_BIN_DIR. all-exec-wrapper does not keep track of
the binaries.

The requests module is not a base module and required.

How to use Deno to specify remote URLs. Given the following script:
  https://raw.githubusercontent.com/NiceGuyIT/pimp-my-tactical/v0.0.1/scripts/wrapper/hello-world.ts
set the following environment variables:
  - WRAPPER_REMOTE_REPO=https://raw.githubusercontent.com/NiceGuyIT/pimp-my-tactical
  - WRAPPER_REMOTE_VERSION=main (git branch)
  OR
  - WRAPPER_REMOTE_VERSION=v0.0.1 (git tag, versioned)
  - WRAPPER_REMOTE_SCRIPT=scripts/wrapper/hello-world.ts
The final form is as follows:
  ${WRAPPER_REMOTE_REPO}/${WRAPPER_REMOTE_VERSION}/${WRAPPER_REMOTE_SCRIPT}

Environmental variables
- WRAPPER_LOG_LEVEL sets the log level.
- WRAPPER_BIN_DIR is the directory to save the binaries.
  Default:
    Windows: 'C:\\ProgramData\\exec-wrapper\\bin'
    *nix: '/opt/exec-wrapper/bin'
- WRAPPER_BINARY is the program to run.
- WRAPPER_DOWNLOAD_URL is the script to run. This is expected to be the raw URL, not an HTML url.
- WRAPPER_REMOTE_REPO is used as the base URL to compose the remote URL for Deno. Alternative to WRAPPER_DOWNLOAD_URL.
- WRAPPER_REMOTE_VERSION is used as the version to compose the remote URL for Deno. Alternative to WRAPPER_DOWNLOAD_URL.
- WRAPPER_REMOTE_SCRIPT is used as the path and script to compose the remote URL for Deno. Alternative to WRAPPER_DOWNLOAD_URL.
- EXEC_DENO_RUN_FLAGS are added to the command line for 'deno run'.
- EXEC_DENO_PERMISSION_FLAGS are added to the command line for 'deno run' to set the permissions.
  See https://deno.land/manual/basics/permissions
- All environmental variables are passed to the child process by default!
"""
import logging
import os
import platform
import re
import traceback

import requests
import subprocess
import sys
import tempfile

"""
logger is the global logging instance set by get_logger().
"""
# logger: logging.Logger | None = None
logger: logging.Logger = None

"""
config is the global configuration dict.
"""
config: dict = {
    # variables are used by the exec wrapper (this program).
    "wrapper": {},

    # variables that alter the commands line options for the executable.
    "exec": {},

    # tmp_dir references a randomly generated directory.
    # The initial value is the system tmp directory. It's assigned a random directory in set_tmp_dir().
    "tmp_dir": None,

    # tmp_file references a randomly generated directory.
    # Note: The initial value is the system tmp directory. It's assigned a random file in set_tmp_file().
    "tmp_file": None,

    # bin_dir is the directory that holds the binaries.
    "bin_dir": None,

    # bin_file is the full path to the binary.
    "bin_file": None,
}

def download_binary(binary_name: str) -> None:
    """
    Download the binary and copy it to bin_file.
    """
    global logger, config

    url = get_download_url(binary_name)
    if url is None:
        return None

    try:
        logger.debug(f'Downloading binary from URL "{url}" to file "{config["bin_file"]}"')
        response = requests.get(url, stream=True)
        logger.debug(f"Status code: {response.status_code}")
        file = open(config["bin_file"], "wb")
        file.write(response.content)
        file.close()
        response.close()
        os.chmod(config["bin_file"], 0o755)
    except PermissionError as err2:
        logger.error(f'PermissionError({err2.errno}): "{err2.strerror}" writing to file "{config["bin_file"]}"')
        raise
    except:
        logger.error(f'Failed to download binary from URL "{url}"')
        logger.error(traceback.format_exc())
        logger.error(sys.exc_info()[0])
        raise


def download_script(url: str) -> str:
    """
    Download the script to tmp_file.
    """
    global logger, config

    try:
        logger.debug(f'Downloading script from URL "{url}" to file "{config["tmp_file"]}"')
        response = requests.get(url, stream=True)
        logger.debug(f"Status code: {response.status_code}")
        file = open(config["tmp_file"], "wb")
        file.write(response.content)
        file.close()
        response.close()
        return config["tmp_file"]
    except:
        logger.error(f'Failed to download binary from URL "{url}"')
        raise


def exec_script(script: str) -> str:
    """
    Execute the script as a parameter to the binary.
    :param script: Script to pass to the binary.
    :type script: str
    :return: Script output.
    :rtype: str
    """
    global logger, config
    # Run the script as a parameter to the binary.
    # Note: binary is used to determine which binary to execute while bin_file is the full path to the binary that was
    # determined earlier.
    if config["wrapper"]["WRAPPER_BINARY"] == "rustpython":
        command = [config["bin_file"], script]
    elif config["wrapper"]["WRAPPER_BINARY"] == "deno":
        command = [
            config["bin_file"],
            # Don't display the download progress output.
            "--quiet",
            "run",
        ]
        # Use EXEC_DENO_RUN_FLAGS=--reload to bypass the cache for development.
        # For production, the version tag will force a new version to be downloaded.
        if "EXEC_DENO_RUN_FLAGS" in config["exec"]:
            command.extend(config["exec"]["EXEC_DENO_RUN_FLAGS"].split())
        # Add deno run permission flags.
        if "EXEC_DENO_PERMISSION_FLAGS" in config["exec"]:
            command.extend(config["exec"]["EXEC_DENO_PERMISSION_FLAGS"].split())
        command.append(script)
    elif config["wrapper"]["WRAPPER_BINARY"] == "nushell":
        command = [config["bin_file"], script]
    else:
        logger.error(f'Unknown binary "{config["wrapper"]["WRAPPER_BINARY"]}"')
        raise ValueError(f'Unknown binary "{config["wrapper"]["WRAPPER_BINARY"]}"')

    try:
        logger.info(f'Executing "{command}"')
        # FIXME: Capture stderr in addition to stdout.
        output = subprocess.check_output(
            command, stderr=subprocess.STDOUT, universal_newlines=True
        )
        logger.info(f"Output from script:")
        print(output)
        return output
    except subprocess.CalledProcessError as err2:
        logger.error(f"Failed to exec: {command}")
        logger.error(f"Return code: {err2.returncode}")
        logger.error(f"Output: {err2.output}")
        logger.error(traceback.format_exc())
        logger.error(err2)
        raise


def is_installed(binary_name: str) -> bool:
    """
    Check if the binary is installed in bin_dir.
    :param binary_name: Filename to test if installed.
    :type binary_name: str
    :return: True if the binary file exists (i.e. installed) in bin_dir; False otherwise
    :rtype: bool
    """
    global logger, config
    exe_ext = get_exe_ext()
    file_path = os.path.join(config["bin_dir"], f"{binary_name}{exe_ext}")
    if not os.path.isfile(file_path):
        logger.info(f'{binary_name}{exe_ext} is not installed in {config["bin_dir"]}')
        return False

    # Zero byte files represent failed downloads. Delete the file and report not installed to download again.
    if os.path.isfile(file_path) and os.path.getsize(file_path) == 0:
        logger.info(f'Deleting zero byte file to force download: "{file_path}"')
        os.remove(file_path)
        return False

    return True


def get_exe_ext() -> str:
    """
    get_exe_ext will return the executable extension. Needed only for Windows.
    :return: The exe extension is returned.
    :rtype: str
    """
    os_name = get_os_name()
    exe_ext = ""
    exe_ext_map = {
        "windows": ".exe",
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
    compress_ext = ""
    compress_ext_map = {
        "linux": ".tar.gz",
        "darwin": ".tar.gz",
        "windows": ".zip",
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
        if arch_name == "x86_64":
            arch_name = "amd64"

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
    set_bin_dir will set the bin directory (BIN_DIR). The env variable WRAPPER_BIN_DIR will be used if defined.
    :return: Nothing is returned.
    :rtype: None
    """
    global config
    if "WRAPPER_BIN_DIR" in config["wrapper"] and config["wrapper"]["WRAPPER_BIN_DIR"] != "":
        config["bin_dir"] = os.path.normpath(config["wrapper"]["WRAPPER_BIN_DIR"])
    else:
        os_name = get_os_name()
        bin_dir_map = {
            "linux": "/opt/exec-wrapper/bin",
            "darwin": "/opt/exec-wrapper/bin",
            "windows": "C:/ProgramData/exec-wrapper/bin",
        }
        if os_name in bin_dir_map:
            config["bin_dir"] = os.path.normpath(bin_dir_map[os_name])
        else:
            # Use the tmp directory as a fallback.
            set_tmp_dir()
            config["bin_dir"] = os.path.normpath(config["tmp_dir"])


def set_bin_file() -> None:
    """
    set_bin_file will set the full path to the binary.
    """
    global config
    exe_ext = get_exe_ext()
    config["bin_file"] = os.path.join(config["bin_dir"], f'{config["wrapper"]["WRAPPER_BINARY"]}{exe_ext}')
    logger.debug(f'bin_file: "{config["bin_file"]}"')


def set_tmp_dir(cleanup: bool = True):
    """
    set_tmp_dir will set the temporary directory used to store downloaded files.
    :param cleanup: Should the tmp directory be automatically cleaned up?
    :type cleanup: bool
    """
    global config
    if config["tmp_dir"] is None or config["tmp_dir"] == "":
        # tmp_dir has not been assigned yet.
        if cleanup:
            # TemporaryDirectory() will delete the directory afterward. This is used for production.
            config["tmp_dir"] = tempfile.TemporaryDirectory().name
        else:
            # mkdtemp() does not delete the directory. This is used for testing purposes.
            config["tmp_dir"] = tempfile.mkdtemp()


def set_tmp_file(cleanup: bool = True):
    """
    set_tmp_file will set the temporary file used to store the script.
    :param cleanup: Should the tmp directory be automatically cleaned up?
    :type cleanup: bool
    """
    global logger, config
    suffix = ""
    if config["wrapper"]["WRAPPER_BINARY"] == "rustpython":
        suffix = ".py"
    elif config["wrapper"]["WRAPPER_BINARY"] == "deno":
        suffix = ".ts"
    elif config["wrapper"]["WRAPPER_BINARY"] == "nushell":
        suffix = ".nu"

    if config["tmp_file"] is None or config["tmp_file"] == "":
        # tmp_file has not been assigned yet.
        if cleanup:
            # TemporaryFile() will delete the file afterward. This is used for production.
            config["tmp_file"] = tempfile.TemporaryFile(suffix=suffix).name
        else:
            # mkstemp() does not delete the file. This is used for testing purposes.
            #   mkstemp() returns a tuple containing an OS-level handle to an open file (as would be returned by
            #   os.open()) and the absolute pathname of that file, in that order.
            (_, config["tmp_file"]) = tempfile.mkstemp(suffix=suffix)


def get_logger() -> logging.Logger:
    """
    get_logger will return a logger to the global logging instance.
    :return: The logger instance.
    :rtype: logging.Logger
    """
    global logger
    if logger is None:
        # Check if WRAPPER_LOG_LEVEL is in the global namespace.
        # Global namespace takes precedence over environment variables.
        global_vars = globals()
        if "WRAPPER_LOG_LEVEL" in global_vars.keys():
            log_level = global_vars["WRAPPER_LOG_LEVEL"].upper()
        else:
            log_level = os.getenv("WRAPPER_LOG_LEVEL", "INFO").upper()
        log_format = "%(asctime)s %(levelname)s %(funcName)s(%(lineno)d): %(message)s"
        logging.basicConfig(format=log_format, level=log_level)
        logger = logging.getLogger()
        logger.setLevel(log_level)
        logger.info(f"Logger initialized with level: {log_level}")
    return logger


def get_download_url(binary_name: str) -> str:
    """
    Get the download URL for the binary.
    :param binary_name: Name of the binary.
    :type binary_name: str
    :return: The URL to download the binary.
    :rtype: str
    """
    global logger
    os_name = get_os_name()
    arch_name = get_arch_name()
    base_url = "https://niceguyit.biz/exec-wrapper/"
    url_map = {
        "linux": {
            "x86_64": {
                "deno": "deno-x86_64-unknown-linux-gnu",
                "nushell": "nu-x86_64-unknown-linux-musl",
                "rustpython": "rustpython-x86_64-unknown-linux-gnu",
            }
        },
        "darwin": {
            "arm64": {
                "deno": "deno-aarch64-apple-darwin",
                "nushell": "nu-aarch64-apple-darwin",
                "rustpython": "rustpython-aarch64-apple-darwin",
            },
        },
        "windows": {
            "amd64": {
                "deno": "deno-x86_64-pc-windows-msvc.exe",
                "nushell": "nu-x86_64-pc-windows-msvc.exe",
                "rustpython": "rustpython-x86_64-pc-windows-gnu.exe",
            }
        },
    }
    if (
        os_name in url_map
        and arch_name in url_map[os_name]
        and binary_name in url_map[os_name][arch_name]
    ):
        bin_url = f"{base_url}{url_map[os_name][arch_name][binary_name]}"
        logger.debug(f"get_download_url: URL: {bin_url}")
        return bin_url
    else:
        logger.error(f'Unsupported OS "{os_name}" or architecture "{arch_name}"')
        raise ValueError(f'Unsupported OS "{os_name}" or architecture "{arch_name}"')


def get_config() -> None:
    """
    get_config will process 4 different types of keys. The keys are in the global namespace or environment
    variables. All variables are uppercase and contain only letters and underscores. "wrapper" and "executable"
    variables are pulled from the environmental variables into the config. "language" and "script" variables are
    exported to the environment for use by the script. The global namespace takes precedence over the environment
    variables.

    The config dict has two keys:
      'wrapper' variables are used by the exec wrapper (this program).
      'executable' variables alter the commands line options for the executable.
    """
    global config
    global_vars = globals()
    regex = re.compile(r'^([A-Z_]+)$')
    for key in global_vars.keys():
        if re.match(regex, key):
            if key.startswith("WRAPPER_"):
                config["wrapper"][key] = global_vars[key]
                if key.startswith("WRAPPER_REMOTE_"):
                    # Export WRAPPER_REMOTE_* variables to the environment for use by the script.
                    os.environ[key] = global_vars[key]
            elif key.startswith("EXEC_"):
                config["exec"][key] = global_vars[key]
                if key.startswith("EXEC_DENO_"):
                    # Export EXEC_DENO_* variables to the environment for use by Deno.
                    os.environ[key] = global_vars[key]
            else:
                if key in os.environ:
                    logger.warning(f"Not overwriting existing environmental variable '{key}'")
                else:
                    logger.debug(f"Exporting variable to the environment: '{key}'")
                    os.environ[key] = global_vars[key]

    for key in os.environ:
        if re.match(regex, key):
            if key.startswith("WRAPPER_"):
                config["wrapper"][key] = os.environ[key]
            elif key.startswith("EXEC_"):
                config["exec"][key] = os.environ[key]

    logger.info(f"get_config globals keys: {config}")


def main():
    """
    The main function is to download the binary and script, and then run the binary passing the script as an argument.
    """
    global logger, config

    # Get the configuration from the environment and global variables.
    get_config()

    if "WRAPPER_BINARY" not in config["wrapper"] or config["wrapper"]["WRAPPER_BINARY"] == "":
        logger.error("WRAPPER_BINARY variable is not defined")
        raise ValueError("WRAPPER_BINARY variable is not defined")

    set_tmp_file(False)
    set_bin_dir()
    logger.debug(f'tmp_file: {config["tmp_file"]}')
    logger.debug(f'bin_dir: {config["bin_dir"]}')

    if not os.path.isdir(config["bin_dir"]):
        # Create bin_dir and all parent directories
        os.makedirs(config["bin_dir"])

    set_bin_file()
    logger.debug(f'bin_file: {config["bin_file"]}')

    try:
        # Download the binary
        if not is_installed(config["wrapper"]["WRAPPER_BINARY"]):
            download_binary(config["wrapper"]["WRAPPER_BINARY"])
    except:
        logger.error(f'Failed to download the binary "{config["wrapper"]["WRAPPER_BINARY"]}"')
        raise ValueError(f'Failed to download the binary "{config["wrapper"]["WRAPPER_BINARY"]}"')

    if config["wrapper"]["WRAPPER_BINARY"] == "deno" and "WRAPPER_DOWNLOAD_URL" not in config["wrapper"]:
        # Run Deno with a remote URL.
        if (
            "WRAPPER_REMOTE_REPO" not in config["wrapper"]
            or "WRAPPER_REMOTE_VERSION" not in config["wrapper"]
            or "WRAPPER_REMOTE_SCRIPT" not in config["wrapper"]
        ):
            logger.error(
                f"WRAPPER_REMOTE_REPO, WRAPPER_REMOTE_VERSION, and WRAPPER_REMOTE_SCRIPT variables are not defined"
            )
            raise ValueError(
                f"WRAPPER_REMOTE_REPO, WRAPPER_REMOTE_VERSION, and WRAPPER_REMOTE_SCRIPT variables are not defined"
            )

        remote_url = config["wrapper"]["WRAPPER_REMOTE_REPO"]
        remote_version = config["wrapper"]["WRAPPER_REMOTE_VERSION"]
        remote_script = config["wrapper"]["WRAPPER_REMOTE_SCRIPT"]
        script_download_url = f'{remote_url}/{remote_version}/{remote_script}'
        try:
            exec_script(script_download_url)
        except:
            logger.error(
                f'Failed to run the script "{script_download_url}" with the binary "{config["bin_file"]}"'
            )
            raise ValueError(
                f'Failed to run the script "{script_download_url}" with the binary "{config["bin_file"]}"'
            )
    else:
        script_download_url = None
        if "WRAPPER_DOWNLOAD_URL" in os.environ:
            script_download_url = os.getenv("WRAPPER_DOWNLOAD_URL")
        else:
            logger.error("WRAPPER_DOWNLOAD_URL variable is not defined")
            raise ValueError("WRAPPER_DOWNLOAD_URL variable is not defined")

        script = None
        try:
            # Download the script
            script = download_script(script_download_url)
        except:
            logger.error(
                f'Failed to download the script from URL "{script_download_url}"'
            )
            raise ValueError(
                f'Failed to download the script from URL "{script_download_url}"'
            )

        try:
            exec_script(config["tmp_file"])
        except:
            logger.error(
                f'Failed to run the script "{config["tmp_file"]}" with the binary "{config["bin_file"]}"'
            )
            raise ValueError(
                f'Failed to run the script "{config["tmp_file"]}" with the binary "{config["bin_file"]}"'
            )

    # Move out of the temporary directory, so we don't prevent it from being deleted.
    os.chdir(config["bin_dir"])

    return


# Main entrance here...
if __name__ == "__main__":
    # Get the logging instance
    logger = get_logger()

    try:
        main()
    except ValueError as err:
        logging.error(f"Failed to finish successfully")
        logging.error(f"Received error: {err}")
        exit(1)

    exit(0)
