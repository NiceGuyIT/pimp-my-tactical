import * as fmt from "https://deno.land/std@0.201.0/fmt/printf.ts";
import * as datetime from "https://deno.land/std@0.201.0/datetime/mod.ts";
import * as log from "https://deno.land/std@0.201.0/log/mod.ts";

/**
 * Configure the logging to use a format handler to pretty-print objects.
 * @see https://deno.land/std@0.200.0/log/mod.ts
 * @param {string} TS_LOG_LEVEL - Log level. Default: WARNING
 * Env Var: TS_LOG_LEVEL
 */
export const MyLogConfig: log.LogConfig = {
    // Define handlers
    handlers: {
        console: new log.handlers.ConsoleHandler("DEBUG", {
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
 * Interface for functions that return a result.
 * TODO: This may change once I learn how to throw an error in a Promise.
 */
export interface Result {
    value?: string | string[] | number;
    err?: Error | unknown;
}

/**
 * Interface for functions that exec a command and return the output.
 */
export interface ExecResult {
    stdout?: string;
    stderr?: string;
    returnCode: number;
}

/**
 * powershell will run the script in powershell and return stdout, stderr and the return code.
 * FIXME: PowerShell's try/catch doesn't work 99% of the time because the error is not a terminating error.
 * TODO: Add '-ErrorAction Stop' to PS scripts to catch the exception and handle it.
 * @see https://stackoverflow.com/questions/41476550/try-catch-not-working-in-powershell-script
 * @see https://learn.microsoft.com/en-us/powershell/scripting/learn/deep-dives/everything-about-exceptions?view=powershell-7.3
 * @param script
 */
export async function Win_RunPowershell(script: string): Promise<ExecResult> {
    const logger = log.getLogger();
    if (Deno.build.os !== "windows") {
        logger.warning(`(Win_RunPowershell) Attempt to run powershell command on non-Windows OS`);
        logger.warning(`(Win_RunPowershell)`, script);
        return {
            returnCode: 1,
            stdout: `(Win_RunPowershell) Attempt to run powershell command on non-Windows OS`,
        };
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
        "-InputFormat",
        "text",
        "-OutputFormat",
        "text",
        "-Command",
        psScript,
    ];

    logger.debug(`(Win_RunPowershell) Running powershell script:`, cmd);
    logger.debug(`(Win_RunPowershell) Args:`, args);
    // define command used to create the subprocess
    return await (new Deno.Command(cmd, {
        args: args,
        stdout: "piped",
        stderr: "piped",
    })
        .output()
        .then(commandOutput => {
            const execResult: ExecResult = {returnCode: 0};
            execResult.stderr = new TextDecoder().decode(commandOutput.stderr);
            execResult.stdout = new TextDecoder().decode(commandOutput.stdout);
            execResult.returnCode = commandOutput.code;

            // PowerShell always appends a newline for text to/from an external process.
            // https://github.com/PowerShell/PowerShell/issues/5974
            // Trim the trailing newline from stdout and stderr.
            if (execResult.stdout.endsWith("\r\n")) {
                execResult.stdout = execResult.stdout.slice(0, -2);
            } else if (execResult.stdout.endsWith("\n")) {
                execResult.stdout = execResult.stdout.slice(0, -1);
            }
            if (execResult.stderr.endsWith("\r\n")) {
                execResult.stderr = execResult.stderr.slice(0, -2);
            } else if (execResult.stderr.endsWith("\n")) {
                execResult.stderr = execResult.stderr.slice(0, -1);
            }
            // logger.debug(`(Win_RunPowershell) stdout:`, execResult.stdout);
            return execResult;
        })
        .catch(err => {
            logger.error(`(Win_RunPowershell) Error executing command:`, cmd);
            logger.error(`(Win_RunPowershell) err:`, err);
            const execResult: ExecResult = {returnCode: 0};
            execResult.stdout = err.message;
            execResult.returnCode = err.code;
            return execResult;
        }));
}

/**
 * Get the registry keys for the given path.
 * @constructor
 */
export async function Win_GetRegistryKey(regPath: string, regKey: string): Promise<string[]> {
    const logger = log.getLogger();
    logger.info(`(Win_GetRegistryKey) Get the registry key(s) for the given path`);

    // $null = New-PSDrive -Name HKCR -PSProvider Registry -Root HKEY_CLASSES_ROOT
    const psScript = `Get-ChildItem -Name '${regPath}' | ConvertTo-Json`;

    const result = await Win_RunPowershell(psScript)
        .then((execResult): Result => {
            if (execResult.returnCode !== 0) {
                // PowerShell's exception is not passed to Deno's exception. Search for the errors in the output and
                // handle as necessary.
                logger.warning(`(Win_GetRegistryKey) Code: return code:`, execResult.returnCode);
                logger.warning(`(Win_GetRegistryKey) Code: stdout:`, execResult.stdout ?? "Undefined");
                logger.warning(`(Win_GetRegistryKey) Code: stderr:`, execResult.stderr ?? "Undefined");
                // throw new Error(stderr);
                return {err: Error(execResult.stderr)};
            } else if (execResult.stderr !== "") {
                // PowerShell's exception is not passed to Deno's exception. Search for the errors in the output and
                // handle as necessary.
                logger.warning(`(Win_GetRegistryKey) STDERR: return code:`, execResult.returnCode);
                logger.warning(`(Win_GetRegistryKey) STDERR: stdout:`, execResult.stdout ?? "Undefined");
                logger.warning(`(Win_GetRegistryKey) STDERR: stderr:`, execResult.stderr ?? "Undefined");
                // throw new Error(stderr);
                return {err: Error(execResult.stderr ?? "Undefined")};
            }
            return {value: execResult.stdout ?? "Undefined"};
        })
        .catch((err: unknown): Result => {
            // if (err instanceof Deno.errors.PermissionDenied) {
            logger.error(`(Win_GetRegistryKey) Error getting the registry key`);
            logger.error(`(Win_GetRegistryKey) err:`, err);
            // throw err;
            return {err: err};
        });

    // Convert the result to an array of strings representing the registry keys.
    // FIXME: This doesn't work if a single key is returned.
    if ("value" in result && result.value) {
        const regJson = JSON.parse(result.value.toString());
        const regKeys: string[] = [];
        for (const [key, value] of Object.entries(regJson)) {
            if (!!value && typeof value === "object" && "value" in value && typeof value.value === "string") {
                regKeys.push(value["value"]);
            }
        }
        return regKeys;
    } else {
        return [];
    }
}

/**
 * Get the registry value for the given key and property.
 * @param {string} regKey - Registry key or path to the registry property.
 * @param {string} regProperty - Registry property.
 * @constructor - Get the registry value for the given key and property.
 * @throws {Error} - If the registry key or property does not exist.
 * @returns {string | number | string[]} Registry value.
 */
export async function Win_GetRegistryValue(regKey: string, regProperty: string): Promise<Result> {
    const logger = log.getLogger();
    logger.info(`(Win_GetRegistryKey) Get registry value for key ${regKey} and property ${regProperty}`);

    // $null = New-PSDrive -Name HKCR -PSProvider Registry -Root HKEY_CLASSES_ROOT
    const psScript = `Get-ItemPropertyValue -Path '${regKey}' -Name '${regProperty}' -ErrorAction Stop`;

    return await Win_RunPowershell(psScript)
        .then((execResult): Result => {
            if (execResult.returnCode !== 0) {
                // PowerShell's exception is not passed to Deno's exception. Search for the errors in the output and
                // handle as necessary.
                logger.warning(`(Win_GetRegistryKey) Code: return code:`, execResult.returnCode);
                logger.warning(`(Win_GetRegistryKey) Code: stdout:`, execResult.stdout ?? "Undefined");
                logger.warning(`(Win_GetRegistryKey) Code: stderr:`, execResult.stderr ?? "Undefined");
                // throw new Error(stderr);
                return {err: Error(execResult.stderr)};
            } else if (execResult.stderr !== "") {
                // PowerShell's exception is not passed to Deno's exception. Search for the errors in the output and
                // handle as necessary.
                logger.warning(`(Win_GetRegistryKey) STDERR: return code:`, execResult.returnCode);
                logger.warning(`(Win_GetRegistryKey) STDERR: stdout:`, execResult.stdout ?? "Undefined");
                logger.warning(`(Win_GetRegistryKey) STDERR: stderr:`, execResult.stderr ?? "Undefined");
                // throw new Error(stderr);
                return {err: Error(execResult.stderr ?? "Undefined")};
            }
            if (execResult.stdout === "") {
                logger.warning("(Win_GetRegistryKey) STDOUT is empty:", execResult.stdout);
            }
            return {value: execResult.stdout ?? "Undefined"};
        })
        .catch((err: unknown): Result => {
            // if (err instanceof Deno.errors.PermissionDenied) {
            logger.error(`(Win_GetRegistryKey) Error getting the registry key`);
            logger.error(`(Win_GetRegistryKey) err:`, err);
            // throw err;
            return {err: err};
        });
}

/**
 * Get the registry value for the given key.
 * @See https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.management/set-itemproperty?view=powershell-7.3#-type
 *
 * @param regKey {string} - Registry key.
 * @param propertyName {string} - Property name.
 * @param propertyType {string} - Property type.
 * @param regPropertyValue {string} - Property value.
 * @constructor
 */
export async function Win_SetRegistryValue(
    regKey: string, propertyName: string, propertyType: string, regPropertyValue: string | number
): Promise<Result> {
    const logger = log.getLogger();

    // $null = New-PSDrive -Name HKCR -PSProvider Registry -Root HKEY_CLASSES_ROOT
    // TODO: Check if the PSDrive exists.
    const psScript = `
		if ($null -eq (Get-ItemProperty -Path '${regKey}' -Name '${propertyName}' -ErrorAction SilentlyContinue)) {
			$null = New-ItemProperty -Path '${regKey}' -Name '${propertyName}' -Value '${regPropertyValue}' -PropertyType '${propertyType}'
		} else {
			$null = Set-ItemProperty -Path '${regKey}' -Name '${propertyName}' -Value '${regPropertyValue}' -PropertyType '${propertyType}'
		}
	`;

    logger.info(`(Win_SetRegistry) Setting registry ${regKey}\\${propertyName} to ${regPropertyValue}`);
    return await Win_RunPowershell(psScript)
        .then((execResult): Result => {
            if (execResult.returnCode !== 0) {
                // PowerShell's exception is not passed to Deno's exception. Search for the errors in the output and
                // handle as necessary.
                logger.warning(`(Win_SetRegistry) Code: return code:`, execResult.returnCode);
                logger.warning(`(Win_SetRegistry) Code: stdout:`, execResult.stdout ?? "Undefined");
                logger.warning(`(Win_SetRegistry) Code: stderr:`, execResult.stderr ?? "Undefined");
                // throw new Error(stderr);
                return {err: Error(execResult.stderr)};
            } else if (execResult.stderr !== "") {
                // PowerShell's exception is not passed to Deno's exception. Search for the errors in the output and
                // handle as necessary.
                logger.warning(`(Win_SetRegistry) STDERR: return code:`, execResult.returnCode);
                logger.warning(`(Win_SetRegistry) STDERR: stdout:`, execResult.stdout ?? "Undefined");
                logger.warning(`(Win_SetRegistry) STDERR: stderr:`, execResult.stderr ?? "Undefined");
                // throw new Error(stderr);
                return {err: Error(execResult.stderr ?? "Undefined")};
            }
            return {value: execResult.stdout ?? "Undefined"};
        })
        .catch((err: unknown): Result => {
            if (err instanceof Deno.errors.PermissionDenied) {
                logger.warning(`(Win_SetRegistry) This script needs to be run with Administrator permission`);
            }
            logger.error(`(Win_GetRegistryKey) Error Setting the registry value`);
            logger.error(`(Win_GetRegistryKey) err:`, err);
            // throw err;
            return {err: err};
        });
}
