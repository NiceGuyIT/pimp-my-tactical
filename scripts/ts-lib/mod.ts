import * as fmt from "https://deno.land/std@0.200.0/fmt/printf.ts";
import * as datetime from "https://deno.land/std@0.200.0/datetime/mod.ts";
import * as log from "https://deno.land/std@0.200.0/log/mod.ts";

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
}

/**
 * powershell will run the script in powershell and return stdout, stderr and the return code.
 * FIXME: PowerShell's try/catch doesn't work 99% of the time because the error is not a terminating error.
 * TODO: Add '-ErrorAction Stop' to PS scripts to catch the exception and handle it.
 * @see https://stackoverflow.com/questions/41476550/try-catch-not-working-in-powershell-script
 * @see https://learn.microsoft.com/en-us/powershell/scripting/learn/deep-dives/everything-about-exceptions?view=powershell-7.3
 * @param script
 */
export async function Win_RunPowershell(script: string): Promise<[number, string, string]> {
    const logger = log.getLogger();
    if (Deno.build.os !== "windows") {
        logger.warning(`(WinRunPowershell) Attempt to run powershell command on non-Windows OS`);
        logger.warning(`(WinRunPowershell)`, script);
        return [0, "", ""];
    }

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
        script,
    ];

    let stdoutText = "";
    let stderrText = "";
    let commandOutput: Deno.CommandOutput;
    try {
        // define command used to create the subprocess
        // logger.debug(`(powershell) Running powershell script: ${cmd}`);
        // logger.debug(`(powershell) Args:`, args);
        const command = new Deno.Command(cmd, {
            args: args,
            stdout: "piped",
            stderr: "piped",
        });

        // create subprocess and collect output
        commandOutput = await command.output();
        stderrText = new TextDecoder().decode(commandOutput.stderr);
        stdoutText = new TextDecoder().decode(commandOutput.stdout);
    } catch (err) {
        if (err instanceof Deno.errors.NotFound) {
            logger.error(`(WinRunPowershell) Error executing command:`, cmd);
            logger.error(`(WinRunPowershell) err:`, err);
            logger.error(`(WinRunPowershell) stderr:`, stderrText);
            logger.error(`(WinRunPowershell) File Not Found:`, cmd);
            // throw err;
            return [1, stdoutText, err.message];
        } else {
            logger.error(`(WinRunPowershell) Error executing command:`, cmd);
            logger.error(`(WinRunPowershell) err:`, err);
            logger.error(`(WinRunPowershell) stderr:`, stderrText);
            return [1, stdoutText, err.message];
        }
    }

    // Capture any errors
    if ((commandOutput.code !== 0) || (!commandOutput.success)) {
        logger.error(`(WinRunPowershell) Error executing command '${cmd}'`);
        logger.error(`(WinRunPowershell) Return code:`, commandOutput.code);
        logger.error(`(WinRunPowershell) Success:`, commandOutput.success);
    }
    return [commandOutput.code, stdoutText, stderrText];
}

/**
 * Get the registry value for the given key.
 * @constructor
 */
export async function Win_GetRegistryKey(regPath: string, regKey: string): Promise<string[]> {
    const logger = log.getLogger();
    logger.info(`(Win_GetRegistryKey) Get the registry key(s) for the given path`);

    // $null = New-PSDrive -Name HKCR -PSProvider Registry -Root HKEY_CLASSES_ROOT
    const psScript = `Get-ChildItem -Name '${regPath}' | ConvertTo-Json`;

    let code = 0;
    let stdout = "";
    let stderr = "";
    try {
        logger.info(`(Win_GetRegistryKey) Adding the right-click integration`);
        [code, stdout, stderr] = await Win_RunPowershell(psScript);
        if (code !== 0) {
            // PowerShell's exception is not passed to Deno's exception. Search for the errors in the output and
            // handle as necessary.
            if (stderr.match(/Access is denied/)) {
                logger.warning(`(Win_GetRegistryKey) Error adding the integration`);
                logger.warning(`(Win_GetRegistryKey) This script needs to be run with Administrator permission`);
                logger.warning(`(Win_GetRegistryKey) stderr:`, stderr);
            } else if (stderr.match(/Requested registry access is not allowed/)) {
                logger.warning(`(Win_GetRegistryKey) Error adding the integration`);
                logger.warning(`(Win_GetRegistryKey) This script needs to be run with Administrator permission`);
                logger.warning(`(Win_GetRegistryKey) stderr:`, stderr);
            } else {
                logger.warning(`(Win_GetRegistryKey) return code:`, code);
                logger.warning(`(Win_GetRegistryKey) stdout:`, stdout);
                logger.warning(`(Win_GetRegistryKey) stderr:`, stderr);
            }
        }
    } catch (err: unknown) {
        if (err instanceof Deno.errors.PermissionDenied) {
            logger.warning(`(Win_GetRegistryKey) Error adding the integration`);
            logger.warning(`(Win_GetRegistryKey) This script needs to be run with Administrator permission`);
            logger.warning(`(Win_GetRegistryKey) err:`, err);
        } else {
            logger.error(`(Win_GetRegistryKey) Error adding the integration`);
            logger.error(`(Win_GetRegistryKey) stderr:`, stderr);
            logger.error(`(Win_GetRegistryKey) err:`, err);
            throw err;
        }
    }

    // Convert the result to an array of strings representing the registry keys.
    // FIXME: This doesn't work if a single key is returned.
    const regJson = JSON.parse(stdout);
    const regKeys: string[] = [];
    for (const [key, value] of Object.entries(regJson)) {
        if (!!value && typeof value === "object" && "value" in value && typeof value.value === "string") {
            regKeys.push(value["value"]);
        }
    }
    return regKeys;
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
): Promise<void> {
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
    /*
        const psScript = `
            Get-Item HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsUpdate\\

            // KeyPath and KeyName are used to create the registry key.
            $KeyPath = "HKCR:\\SystemFileAssociations\\.txt"
            $KeyName = "Shell"
            $Path = "HKCR:\\SystemFileAssociations\\.txt\\Shell"
            if (-not(Test-Path -Path $Path)) {
                $null = New-Item -Path $KeyPath -Name $KeyName
            }

            // KeyPath and KeyName are used to create the registry key.
            $KeyPath = "HKCR:\\SystemFileAssociations\\.txt\\Shell"
            $KeyName = "Explorer-Bookmarks"
            $Path = "HKCR:\\SystemFileAssociations\\.txt\\Shell\\Explorer-Bookmarks"
            $Name = "(Default)"
            $Value = "Restore my Explorer Bookmarks"
            $Type = "String"
            // Need to check for the key and create it before checking for and creating the property.
            if (-not(Test-Path -Path $Path)) {
                // Create the key
                $null = New-Item -Path $KeyPath -Name $KeyName
                if ($null -eq (Get-ItemProperty -Path $Path -Name $Name -ErrorAction SilentlyContinue)) {
                # Create the property on the key
                    $null = New-ItemProperty -Path $Path -Name $Name -Value $Value -PropertyType $Type
                }
            }

            // KeyPath and KeyName are used to create the registry key.
            $KeyPath = "HKCR:\\SystemFileAssociations\\.txt\\Shell\\Explorer-Bookmarks"
            $KeyName = "Command"
            $Path = "HKCR:\\SystemFileAssociations\\.txt\\Shell\\Explorer-Bookmarks\\Command"
            $Name = "(Default)"
            $Value = ("Value")
            $Type = "String"
            // Need to check for the key and create it before checking for and creating the property.
            if (-not(Test-Path -Path $Path)) {
                // Create the key
                $null = New-Item -Path $KeyPath -Name $KeyName
                if ($null -eq (Get-ItemProperty -Path $Path -Name $Name -ErrorAction SilentlyContinue)) {
                # Create the property on the key
                    $null = New-ItemProperty -Path $Path -Name $Name -Value $Value -PropertyType $Type
                }
            }
        `;
    */

    let code = 0;
    let stdout = "";
    let stderr = "";
    try {
        logger.info(`(Win_SetRegistry) Setting registry ${regKey}\\${propertyName} to ${regPropertyValue}`);
        [code, stdout, stderr] = await Win_RunPowershell(psScript);
        if (code !== 0) {
            // PowerShell's exception is not passed to Deno's exception. Search for the errors in the output and
            // handle as necessary.
            if (stderr.match(/Access is denied/)) {
                logger.warning(`(Win_SetRegistry) Error setting the registry value`);
                logger.warning(`(Win_SetRegistry) This script needs to be run with Administrator permission`);
                logger.warning(`(Win_SetRegistry) stderr:`, stderr);
            } else if (stderr.match(/Requested registry access is not allowed/)) {
                logger.warning(`(Win_SetRegistry) Error setting the registry value`);
                logger.warning(`(Win_SetRegistry) This script needs to be run with Administrator permission`);
                logger.warning(`(Win_SetRegistry) stderr:`, stderr);
            } else {
                logger.warning(`(Win_SetRegistry) return code:`, code);
                logger.warning(`(Win_SetRegistry) stdout:`, stdout);
                logger.warning(`(Win_SetRegistry) stderr:`, stderr);
            }
        }
    } catch (err: unknown) {
        if (err instanceof Deno.errors.PermissionDenied) {
            logger.warning(`(Win_SetRegistry) Error setting the registry value`);
            logger.warning(`(Win_SetRegistry) This script needs to be run with Administrator permission`);
            logger.warning(`(Win_SetRegistry) err:`, err);
        } else {
            logger.error(`(Win_SetRegistry) Error setting the registry value`);
            logger.error(`(Win_SetRegistry) stderr:`, stderr);
            logger.error(`(Win_SetRegistry) err:`, err);
            throw err;
        }
    }

}
