// import * as path from "https://deno.land/std@0.200.0/path/mod.ts";
// import * as fmt from "https://deno.land/std@0.200.0/fmt/printf.ts";
import * as colors from "https://deno.land/std@0.200.0/fmt/colors.ts";
// import * as datetime from "https://deno.land/std@0.200.0/datetime/mod.ts";
import * as log from "https://deno.land/std@0.200.0/log/mod.ts";
// TODO: Add versioning to the URL
import * as utils from "https://raw.githubusercontent.com/NiceGuyIT/pimp-my-tactical/main/scripts/ts-lib/mod.ts";
// import * as utils from "./mod.ts";

/**
 * Configure the logging system.
 */
log.setup(utils.MyLogConfig);
const logger = log.getLogger();

/**
 * Disable color logging
 */
if (colors.getColorEnabled()) {
	colors.setColorEnabled(false);
}
/**
 * Enable color logging
 */
/*
if (!colors.getColorEnabled()) {
	colors.setColorEnabled(true);
}
*/
logger.debug(`(main) Color enabled:`, colors.getColorEnabled());

/**
 * Bypass the TPM check for Windows 11.
 * @See https://support.microsoft.com/en-us/windows/ways-to-install-windows-11-e0edbbfb-cfc5-4011-868b-2ce77ac7c70e
 * @See https://github.com/AveYo/MediaCreationTool.bat/blob/main/bypass11/Skip_TPM_Check_on_Dynamic_Update.cmd
 * @See https://admx.help/?Category=Windows_10_2016&Policy=Microsoft.Policies.WindowsUpdate::DisableWUfBSafeguards
 */
let regKey = '';
let regPropertyName = '';
let regPropertyType = '';
let regPropertyValue: string | number | boolean = '';

/**
 * Not found:
 * Get-ItemProperty -Path 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate' -Name 'DisableWUfBSafeguards'
 *
 *
 */
regKey = `HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsUpdate`;
regPropertyName = `DisableWUfBSafeguards`;
regPropertyType = `DWord`;
regPropertyValue = 1;
try {
	await utils.Win_SetRegistryValue(regKey, regPropertyName, regPropertyType, regPropertyValue);
	logger.debug(`(main) Successfully set registry key:`, regKey, regPropertyName, regPropertyValue);
} catch (err: unknown) {
	if (err instanceof Deno.errors.PermissionDenied) {
		logger.warning(`(main) Error setting the registry value`);
		logger.warning(`(main) This script needs to be run with Administrator permission`);
		logger.warning(`(main) err:`, err);
	} else {
		logger.error(`(Win_SetRegistry) Error setting the registry value`);
		logger.error(`(Win_SetRegistry) err:`, err);
		throw err;
	}
}

/**
 * Home-01: Not found:
 * Get-ItemProperty -Path 'HKLM:\SYSTEM\Setup\MoSetup' -Name 'AllowUpgradesWithUnsupportedTPMOrCPU'
 */
regKey = `HKLM:\\SYSTEM\\Setup\\MoSetup`;
regPropertyName = `AllowUpgradesWithUnsupportedTPMOrCPU`;
regPropertyType = `DWord`;
regPropertyValue = 1;
try {
	await utils.Win_SetRegistryValue(regKey, regPropertyName, regPropertyType, regPropertyValue);
	logger.debug(`(main) Successfully set registry key:`, regKey, regPropertyName, regPropertyValue);
} catch (err: unknown) {
	if (err instanceof Deno.errors.PermissionDenied) {
		logger.warning(`(main) Error setting the registry value`);
		logger.warning(`(main) This script needs to be run with Administrator permission`);
		logger.warning(`(main) err:`, err);
	} else {
		logger.error(`(Win_SetRegistry) Error setting the registry value`);
		logger.error(`(Win_SetRegistry) err:`, err);
		throw err;
	}
}
