import * as colors from "https://deno.land/std@0.201.0/fmt/colors.ts";
import * as datetime from "https://deno.land/std@0.201.0/datetime/mod.ts";
import * as fmt from "https://deno.land/std@0.201.0/fmt/printf.ts";
import * as log from "https://deno.land/std@0.201.0/log/mod.ts";
// @deno-types="npm:@types/diff@3.5.0"
import jsdiff from "npm:diff@3.5.0";
// JetBrains doesn't import the NPM specifier types in a way that can provide type-hints in the IDE.
// This provides the explicit type hints.
import jsdiffType from "https://github.com/DefinitelyTyped/DefinitelyTyped/raw/master/types/diff/index.d.ts";

/**
 * Configure the logging to use a format handler to pretty-print objects.
 * @see https://deno.land/std/log/mod.ts
 * @param {Deno.env} TS_LOG_LEVEL - Environmental variable TS_LOG_LEVEL indicating the log level. Default: WARNING
 * @type {log.LogConfig}
 */
export const MyLogConfig: log.LogConfig = {
    // Define handlers
    handlers: {
        console: new log.handlers.ConsoleHandler("DEBUG", {
            formatter: (logRecord: log.LogRecord) => {
                const timestamp = datetime.format(logRecord.datetime, "yyyy-MM-dd HH:mm:ss.SSS");
                let msg = `${timestamp} [${logRecord.levelName}] ${logRecord.msg}`;
                logRecord.args.forEach((arg) => {
                    switch (typeof (arg)) {
                        case "undefined":
                            msg += " {undefined}";
                            break;
                        case "object":
                            // msg += fmt.sprintf(" %i", arg);
                            // Increase the string length of Deno.inspect since sprintf() doesn't support it.
                            // @see https://deno.land/std@0.201.0/fmt/printf.ts
                            // @see https://github.com/denoland/deno/issues/20382
                            // @see https://deno.land/api@v1.36.4?s=Deno.InspectOptions
                            msg += Deno.inspect(arg, {
                                colors: true,
                                depth: 10, // Default: 4
                                iterableLimit: 1000, // Default: 100
                                strAbbreviateSize: 10000, // Default: unknown
                            });
                            break;
                        default:
                            msg += fmt.sprintf(" {%v}", arg);
                    }
                });
                return msg;
            },
        }),
        /*
		// See https://github.com/NiceGuyIT/pimp-my-tactical/blob/main/scripts/wrapper/explorer-bookmarks.ts for an
		// example of file handler.
		file: new log.handlers.FileHandler("DEBUG", {
			// TODO: Make the log file dynamic
			filename: (Deno.env.get("USERPROFILE") ?? "").match(/systemprofile$/)
				? "C:\\ProgramData\\TacticalRMM\\Explorer-Bookmarks.log"
				: path.join(Deno.env.get("USERPROFILE") ?? "", `\\Documents\\Explorer-Bookmarks\\Explorer-Bookmarks.log`),
			formatter: (logRecord) => {
				const timestamp = datetime.format(logRecord.datetime, "HH:mm:ss.SSS");
				let msg = `${timestamp} [${logRecord.levelName}] ${logRecord.msg}`;
				logRecord.args.forEach((arg) => {
					switch (typeof (arg)) {
						case "undefined":
							msg += " {undefined}";
							break;
						case "object":
							msg += fmt.sprintf(" %i", arg);
							break;
						default:
							msg += fmt.sprintf(" {%v}", arg);
					}
				});
				return msg;
			},
		}),
		 */
    },
    // Assign handlers to loggers
    loggers: {
        default: {
            // handlers: ["console", "file"],
            handlers: ["console",],
            level: (Deno.env.get("TS_LOG_LEVEL") ?? "WARNING").toUpperCase() as log.LevelName,
        }
    }
};

/**
 * These 3 error functions are used to determine the type of error and coerce it to an Error object.
 * @see https://kentcdodds.com/blog/get-a-catch-block-error-message-with-typescript
 *
 * isErrorWithMessage checks if the error is an instance of Error with a message property.
 * @param {unknown} error - The error to check if it's an instance of Error.
 * @return {error is Error} - Returns an instance of Error.
 */
export function IsErrorWithMessage(error: unknown): error is Error {
    return (
        typeof error === 'object' &&
        error !== null &&
        'message' in error &&
        typeof (error as Record<string, unknown>).message === 'string'
    )
}

/**
 * toErrorWithMessage will return an Error object with a message property.
 * @param {unknown} maybeError - The possible error to convert to an Error object.
 * @return {Error} - An Error object with a message property.
 */
export function ToErrorWithMessage(maybeError: unknown): Error {
    if (IsErrorWithMessage(maybeError)) {
        return maybeError;
    }

    try {
        return new Error(JSON.stringify(maybeError));
    } catch {
        // fallback in case there's an error stringifying the maybeError
        // like with circular references for example.
        return new Error(String(maybeError));
    }
}

/**
 * getErrorMessage will return the message property of an Error object.
 * @param {unknown} error - The error to get the message property of.
 * @return {string} Error message string.
 */
export function GetErrorMessage(error: unknown): string {
    return ToErrorWithMessage(error).message;
}

/**
 * powershell will run the script in powershell and return stdout, stderr and the return code.
 * FIXME: PowerShell's try/catch doesn't work 99% of the time because the error is not a terminating error.
 * TODO: Add '-ErrorAction Stop' to PS scripts to catch the exception and handle it.
 * @see https://stackoverflow.com/questions/41476550/try-catch-not-working-in-powershell-script
 * @see https://learn.microsoft.com/en-us/powershell/scripting/learn/deep-dives/everything-about-exceptions?view=powershell-7.3
 * @param {string} script - PowerShell script to run.
 * @return {Promise<string | Error>} - Promise that resolves to a string or Error.
 * @function Win_RunPowershell
 */
export async function Win_RunPowershell(script: string): Promise<string | Error> {
    const logger = log.getLogger();
    const functionName = "Test_IsAdmin";

    if (Deno.build.os !== "windows") {
        logger.warning(`(${functionName}) Attempt to run powershell command on non-Windows OS`);
        logger.warning(`(${functionName})`, script);
        return new Error(`Attempt to run powershell command on non-Windows OS`)
    }

    // Enclose the script in a try/catch block to catch the exception and handle it.
    // $Error[0].ToString() can be used in place of $_.ToString()
    const psScript = `try {
	$ErrorActionPreference = "Stop";
	${script}
} catch {
	[Console]::Error.WriteLine( $_.ToString() );
	Exit(1);
}
`;

    // https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_powershell_exe?view=powershell-5.1&viewFallbackFrom=powershell-7.2
    const cmd = "c:/WINDOWS/System32/WindowsPowerShell/v1.0/powershell.exe";
    const args = [
        "-NonInteractive",
        "-NoProfile",
        "-NoLogo",
        "-WindowStyle",
        "Hidden",
        "-InputFormat",
        "text",
        "-OutputFormat",
        "text",
        "-Command",
        psScript,
    ];

    return await Process_Exec(cmd, args)
        .then((result): string | Error => {
            if (IsErrorWithMessage(result)) {
                return result;
            }

            // PowerShell always appends a newline for text to/from an external process.
            // https://github.com/PowerShell/PowerShell/issues/5974
            // Trim the trailing newline from stdout and stderr.
            if (result.endsWith("\r\n")) {
                result = result.slice(0, -2);
            } else if (result.endsWith("\n")) {
                result = result.slice(0, -1);
            }

            logger.debug(`(${functionName}) stdout:`, result);
            return result;
        })
        .catch(err => {
            logger.error(`(${functionName}) Error executing command:`, cmd);
            logger.error(`(${functionName}) err:`, err);
            logger.debug(`(${functionName}) Powershell script:`, cmd);
            logger.debug(`(${functionName}) Args:`, args);
            return ToErrorWithMessage(err);
        });
}

/**
 * Get the registry keys for the given path.
 * @param {string} regPath - Registry path to the key.
 * @param {string} regKey - Registry key to get.
 * @returns {Promise<string | Error>} Promise that resolves to a string or Error.
 * @function Win_GetRegistryKey
 */
export async function Win_GetRegistryKey(regPath: string, regKey: string): Promise<string[] | Error> {
    const logger = log.getLogger();
    const functionName = "Win_GetRegistryKey";
    logger.info(`(${functionName}) Get the registry key(s) for the given path`);

    // $null = New-PSDrive -Name HKCR -PSProvider Registry -Root HKEY_CLASSES_ROOT
    const psScript = `Get-ChildItem -Name '${regPath}' | ConvertTo-Json`;

    const result = await Win_RunPowershell(psScript)
        .then((execResult: string | Error): string | Error => {
            if (IsErrorWithMessage(execResult)) {
                return execResult;
            }

            if (execResult === "") {
                logger.warning(`(${functionName}) STDOUT is empty:`, execResult);
            }
            return execResult;
        })
        .catch((err: unknown): Error => {
            // if (err instanceof Deno.errors.PermissionDenied) {
            logger.error(`(${functionName}) Error getting the registry key. err:`, err);
            return ToErrorWithMessage(err);
        });

    if (IsErrorWithMessage(result)) {
        return result;
    }

    // Convert the result to an array of strings representing the registry keys.
    // FIXME: This doesn't work if a single key is returned.
    const regJson = JSON.parse(result.toString());
    const regKeys: string[] = [];
    for (const [_key, value] of Object.entries(regJson)) {
        if (!!value && typeof value === "object" && "value" in value && typeof value.value === "string") {
            regKeys.push(value["value"]);
        }
    }
    return regKeys;
}

/**
 * Get the registry value for the given key and property.
 * @param {string} regKey - Registry key or path to the registry property.
 * @param {string} regProperty - Registry property.
 * @returns {Promise<string | Error>} Promise that resolves to a string or Error.
 * @function Win_GetRegistryValue
 */
export async function Win_GetRegistryValue(regKey: string, regProperty: string): Promise<string | Error> {
    const logger = log.getLogger();
    const functionName = "Win_GetRegistryValue";
    logger.info(`(${functionName}) Get registry value for key ${regKey} and property ${regProperty}`);

    // $null = New-PSDrive -Name HKCR -PSProvider Registry -Root HKEY_CLASSES_ROOT
    const psScript = `Get-ItemPropertyValue -Path '${regKey}' -Name '${regProperty}' -ErrorAction Stop`;

    return await Win_RunPowershell(psScript)
        .then((execResult: string | Error): string | Error => {
            if (IsErrorWithMessage(execResult)) {
                return execResult;
            }

            if (execResult === "") {
                logger.warning(`(${functionName}) STDOUT is empty:`, execResult);
            }
            return execResult;
        })
        .catch((err: unknown): Error => {
            // if (err instanceof Deno.errors.PermissionDenied) {
            logger.error(`(${functionName}) Error getting the registry value. err:`, err);
            return ToErrorWithMessage(err);
        });
}

/**
 * Win_SetRegistryValue will get the registry value for the given key.
 * @See https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.management/set-itemproperty?view=powershell-7.3#-type
 * @param {string} regKey - Registry key.
 * @param {string} propertyName - Property name.
 * @param {string} propertyType - Property type.
 * @param {string | number} regPropertyValue - Property value.
 * @returns {Promise<string | Error>} Promise that resolves to a string or Error.
 * @function Win_SetRegistryValue
 */
export async function Win_SetRegistryValue(
    regKey: string, propertyName: string, propertyType: string, regPropertyValue: string | number
): Promise<string | Error> {
    const logger = log.getLogger();
    const functionName = "Win_SetRegistryValue";

    // $null = New-PSDrive -Name HKCR -PSProvider Registry -Root HKEY_CLASSES_ROOT
    // TODO: Check if the PSDrive exists.
    const psScript = `
		if ($null -eq (Get-ItemProperty -Path '${regKey}' -Name '${propertyName}' -ErrorAction SilentlyContinue)) {
			$null = New-ItemProperty -Path '${regKey}' -Name '${propertyName}' -Value '${regPropertyValue}' -PropertyType '${propertyType}'
		} else {
			$null = Set-ItemProperty -Path '${regKey}' -Name '${propertyName}' -Value '${regPropertyValue}' -PropertyType '${propertyType}'
		}
	`;

    logger.info(`(${functionName}) Setting registry ${regKey}\\${propertyName} to ${regPropertyValue}`);
    return await Win_RunPowershell(psScript)
        .then((execResult): string | Error => {
            if (IsErrorWithMessage(execResult)) {
                return execResult;
            }

            if (execResult === "") {
                logger.warning(`(${functionName}) STDOUT is empty:`, execResult);
            }
            return execResult;
        })
        .catch((err: unknown): Error => {
            if (err instanceof Deno.errors.PermissionDenied) {
                logger.warning(`(${functionName}) This script needs to be run with Administrator permission`);
            }
            logger.error(`(${functionName}) Error setting the registry value. err:`, err);
            return ToErrorWithMessage(err);
        });
}

/**
 * Process_Exec will run the command with the supplied arguments and pass back the results as a string. If there's an
 * error, an Error object will be returned with the return code and error message (stderr).
 * @param {string} cmd - Command to run.
 * @param {string[]} args - Arguments to pass to the command.
 * @return {Promise<string | Error>} - Promise that resolves to stdout or Error object (return code and stderr).
 * @function Process_Exec
 */
export async function Process_Exec(cmd: string, args: string[]): Promise<string | Error> {
    const logger = log.getLogger();
    const functionName = "Process_Exec";

    return await (new Deno.Command(cmd, {
        args: args,
        stdout: "piped",
        stderr: "piped",
    })
        .output()
        .then((commandOutput: Deno.CommandOutput): string | Error => {
            const returnCode = commandOutput.code;
            const stdout = new TextDecoder().decode(commandOutput.stdout);
            const stderr = new TextDecoder().decode(commandOutput.stderr);

            // Theoretically, stdout is exclusive of stderr and returnCode. Check and report this is the case.
            if (returnCode !== 0 && stderr !== "") {
                // stderr and returnCode have values indicating an error.
                logger.warning(`(${functionName}) return code:`, returnCode);
                logger.warning(`(${functionName}) stderr:`, stderr);
                logger.warning(`(${functionName}) Command:`, cmd);
                logger.warning(`(${functionName}) Args:`, args);
                return new Error(`return code: ${returnCode}: ${stderr}`);
            } else if (stderr !== "") {
                // stderr has content; returnCode is 0
                logger.warning(`(${functionName}) stderr:`, stderr);
                logger.warning(`(${functionName}) Command:`, cmd);
                logger.warning(`(${functionName}) Args:`, args);
                return new Error(`${stderr}`);
            } else if (returnCode !== 0) {
                // returnCode is not 0 (command was unsuccessful); stderr is empty
                logger.warning(`(${functionName}) return code:`, returnCode);
                logger.warning(`(${functionName}) Command:`, cmd);
                logger.warning(`(${functionName}) Args:`, args);
                return new Error(`return code: ${returnCode}`);
            }

            // Is it possible for stdout to be empty if stderr is empty and returnCode is 0?
            if (stdout === "") {
                logger.warning(`(${functionName}) STDOUT is empty:`, stdout);
            }
            return stdout;
        })
        .catch((err: unknown): Error => {
            logger.error(`(${functionName}) Error executing command:`, cmd);
            logger.error(`(${functionName}) err:`, err);
            logger.error(`(${functionName}) Command:`, cmd);
            logger.error(`(${functionName}) Args:`, args);
            return ToErrorWithMessage(err);
        }));
}

/**
 * Process_Spawn will spawn a new process with the supplied command and arguments.
 * @param {string} cmd - Command to spawn.
 * @param {string[]} args - Arguments to pass to the command.
 * @return {string | Error} - True if successful; Error if there's an error.
 * @function Process_Spawn
 */
export function Process_Spawn(cmd: string, args: string[]): boolean | Error {
    const logger = log.getLogger();
    const functionName = "Process_Exec";

    logger.debug(`(${functionName}) Spawning command:`, cmd);
    logger.debug(`(${functionName}) Args:`, args);
    try {
        new Deno.Command(cmd, {args: args})
            .spawn()
            // Ensure that the status of the child process does not block the Deno process from exiting.
            .unref()
        return true;
    } catch (err: unknown) {
        logger.error(`(${functionName}) Error spawning command:`, cmd);
        logger.error(`(${functionName}) err:`, err);
        return ToErrorWithMessage(err);
    }
}

/**
 * Test_IsAdmin will return true if the current user is an administrator.
 * For Windows:
 *   "Mandatory Label\High Mandatory Level" is when the script is run from an elevated session.
 *   "Mandatory Label\System Mandatory Level" is when the script is run from SYSTEM.
 * @function Test_IsAdmin
 * @returns {Promise<boolean | Error>} - Promise that resolves to true if the current user is an administrator or an Error object.
 */
export async function Test_IsAdmin(): Promise<boolean | Error> {
    const logger = log.getLogger();
    const functionName = "Test_IsAdmin";
    let cmd: string;
    let args: string[] = [];
    if (Deno.build.os === "windows") {
        cmd = "C:/Windows/System32/whoami.exe";
        args = [
            "/groups",
        ];
    } else {
        cmd = "/usr/bin/whoami";
    }

    return await Process_Exec(cmd, args)
        .then((execResult: string | Error): boolean | Error => {
            if (IsErrorWithMessage(execResult)) {
                return execResult;
            }

            if (execResult === "") {
                logger.warning(`(${functionName}) STDOUT is empty:`, execResult);
            }

            // Process the output
            if (Deno.build.os === "windows") {
                logger.debug(`(${functionName}) includes 'Mandatory Label\\High Mandatory Level':`, execResult.includes("Mandatory Label\\High Mandatory Level"));
                logger.debug(`(${functionName}) includes 'Mandatory Label\\System Mandatory Level':`, execResult.includes("Mandatory Label\\System Mandatory Level"));
                if (execResult.includes("Mandatory Label\\High Mandatory Level") ||
                    execResult.includes("Mandatory Label\\System Mandatory Level")) {
                    logger.info(`(${functionName}) isAdmin:`, true);
                    return true;
                } else {
                    logger.info(`(${functionName}) isAdmin:`, false);
                    return false;
                }
            } else {
                logger.info(`(${functionName}) includes 'root':`, execResult.includes("root"));
                return execResult.includes("root");
            }

        })
        .catch((err: unknown): Error => {
            logger.error(`(${functionName}) Error getting the registry key. err:`, err);
            return ToErrorWithMessage(err);
        });

}

/**
 * Test_IsInteractiveShell will return true if the program is being run interactively by checking if stdin is a TTY.
 * @function Test_IsInteractiveShell
 * @returns {boolean} - True if the program is being run interactively with a TTY.
 */
export function Test_IsInteractiveShell(): boolean {
    const logger = log.getLogger();
    const functionName = "Test_IsInteractiveShell";
    logger.debug(`(${functionName}) isATTY STDIN:`, Deno.isatty(Deno.stdin.rid));
    logger.debug(`(${functionName}) isATTY STDOUT:`, Deno.isatty(Deno.stdout.rid));
    return Deno.isatty(Deno.stdin.rid);
}

/**
 * FS_GetDirFiles will return an array of FS_Files in the given directory.
 * @param {string} dir - Directory to check
 * @returns {Promise<string | Error>} Promise that resolves to a string or Error.
 * @function FS_IsDir
 */
export async function FS_IsDir(dir: string): Promise<boolean | Error> {
    const logger = log.getLogger();
    const functionName = "Win_GetRegistryKey";
    logger.info(`(${functionName}) Checking if dir is a directory:`, dir);

    // Stat the directory to make sure it's a directory. Handle permission and non-directory errors.
    return await Deno.stat(dir)
        .then((fileInfo): boolean | Error => {
            if (!fileInfo.isDirectory) {
                logger.debug(`(${functionName}) Path exists but is not a directory:`, dir);
                return new Error(`Path exists but is not a directory: ${dir}`);
            }
            logger.debug(`(${functionName}) isDir:`, true);
            return true;
        })
        .catch((err: Deno.errors.NotFound): boolean | Error => {
            logger.debug(`(${functionName}) Directory does not exist:`, dir);
            logger.debug(`(${functionName}) err:`, err);
            return new Error(`Directory does not exist: ${dir}`);
        })
        .catch((err: unknown): boolean | Error => {
            logger.info(`(${functionName}) Error checking if directory exists:`, dir);
            logger.info(`(${functionName}) err:`, err);
            return new Error(`Error checking if directory exists: ${dir}`);
        });
}

/**
 * FS_Files interface that contains basic file information.
 * @interface FS_Files
 */
export interface FS_Files {
    name: string;
    size: number;
    mtime: Date | null;
    birthtime: Date | null;
    isDir: boolean;
    isFile: boolean;
    isSymlink: boolean;
}

/**
 * FS_GetDirFiles will return an array of FS_Files in the given directory.
 * @param {string} dir - Directory of the files.
 * @param {RegExp} pattern - Optional regular expression to filter based on filename.
 * @function FS_GetDirFiles
 */
export async function FS_GetDirFiles(dir: string, pattern?: RegExp): Promise<FS_Files[] | Error> {
    const logger = log.getLogger();
    const functionName = "Win_GetRegistryValue";
    logger.info(`(FS_GetDir) Getting directory contents:`, dir);

    const files: FS_Files[] = [];
    type DirStat = boolean | Error

    // First stat the directory to make sure it's a directory. Handle permission and non-directory errors.
    const isDir = await FS_IsDir(dir);
    if (IsErrorWithMessage(isDir)) {
        logger.error(`(${functionName}) Error checking if 'dir' is a directory. dir:`, dir);
        logger.error(`(${functionName}) result:`, isDir);
        return isDir;
    }
    // Then iterate through the files in the directory.
    for await (const file of Deno.readDir(dir)) {
        if (!pattern || (pattern && file.name.match(pattern))) {
            const fileInfo = await Deno.stat(`${dir}/${file.name}`);
            files.push({
                name: file.name,
                size: fileInfo.size,
                mtime: fileInfo.mtime,
                birthtime: fileInfo.birthtime,
                isDir: fileInfo.isDirectory,
                isFile: fileInfo.isFile,
                isSymlink: fileInfo.isSymlink,
            });
        }
    }
    return files;
}

/**
 * JsonDiffOptions is a list of options for the JsonDiff function.
 * @interface JsonDiffOptions
 */
export interface JsonDiffOptions {
    color?: boolean;
}

/**
 * JsonDiff will return a string representing the contextual changes between two JSON objects. It's similar to the
 * unified format (unidiff) but without the headings.
 *   - Added lines are prefixed with "+ "
 *   - Removed lines are prefixed with "- "
 *   - Unchanged lines are prefixed with "  "
 * @see https://en.wikipedia.org/wiki/Diff#Unified_format
 * @param {JSON} json1 - First JSON object to diff.
 * @param {JSON} json2 - Second JSON object to diff.
 * @param {JsonDiffOptions} [options] - Options for the JsonDiff function.
 * @function JsonDiff
 */
export function JsonDiff(json1: JSON, json2: JSON, options: JsonDiffOptions = {}): string {
    const logger = log.getLogger();
    /*
		if (!options) {
			options = {
				color: false,
			};
		}
	*/

    // Generate the diff
    const diff = jsdiff.diffJson(json1, json2);

    // Iterate over the changes
    let final = "";
    diff.forEach((part: jsdiffType.Change) => {
        const prefix = part.added ? "+ " : part.removed ? "- " : "  ";
        let output = "";
        part.value.split("\n").forEach((line) => {
            if (line.length > 0) {
                if (options?.color && prefix === "+ ") {
                    output += colors.green(`${prefix}${line}\n`);
                } else if (options?.color && prefix === "- ") {
                    output += colors.red(`${prefix}${line}\n`);
                } else {
                    output += `${prefix}${line}\n`;
                }
            }
        });
        /*
		// Remove the trailing newline to prevent an extra line between two changes.
		// This is only needed if the inputs are interfaces implicitly converted to JSON, not pure JSON.
		if (output.endsWith("\n")) {
			output = output.slice(0, -1);
		}
		*/
        logger.debug(`(map) output:`, output);
        final += output;
    });
    return final;
}
