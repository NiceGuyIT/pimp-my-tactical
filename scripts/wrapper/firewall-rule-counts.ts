import * as colors from "https://deno.land/std@0.200.0/fmt/colors.ts";
import * as log from "https://deno.land/std@0.200.0/log/mod.ts";
import AsciiTable, {AsciiAlign} from "https://deno.land/x/ascii_table@v0.1.0/mod.ts";
import * as utils from "https://raw.githubusercontent.com/NiceGuyIT/pimp-my-tactical/main/scripts/ts-lib/mod.ts";
import {NetFirewallRule, NetFirewallPortFilter} from "https://raw.githubusercontent.com/NiceGuyIT/pimp-my-tactical/main/scripts/ts-lib/microsoft.d.ts";

/**
 * JSON to JSON Schema: https://transform.tools/json-to-json-schema
 * JSON Schema to JSDoc: https://francisn.com/json-schema-to-jsdoc/
 * JSON to JSON Schema with references: https://jsonformatter.org/json-to-jsonschema
 */

/**
 * Configure the logging system.
 */
log.setup(utils.MyLogConfig);
const logger = log.getLogger();

// Are we developers?
const dev = true;

if (dev) {
	// Enable color logging
	if (!colors.getColorEnabled()) {
		colors.setColorEnabled(true);
	}
	logger.debug(`(main) Color enabled:`, colors.getColorEnabled());
} else {
	// Disable color logging
	if (colors.getColorEnabled()) {
		colors.setColorEnabled(false);
	}

}

/**
 * Consolidated structure of Get-NetFirewallRule and Get-NetFirewallPortFilter
 */
type FirewallRule = {
	ID: string;
	InstanceID: string;
	Name: string;
	DisplayName: string;
	Enabled: boolean;
	Profile: number;
	Direction: number;
	Count: number;
	firewallPort?: FirewallPort;
}
type FirewallRuleMap = Record<string, FirewallRule>;

type FirewallPort = {
	InstanceID: string;
	Name: string;
	Protocol: string;
	LocalPort: string;
}

/**
 * Get the firewall rules
 * @param {string} displayName - The DisplayName argument to Get-NetFirewallRule
 * @returns {NetFirewallRule[]} - The firewall rules
 */
async function getFirewallRules(displayName?: string): Promise<NetFirewallRule[]> {
	let psScript = `Get-NetFirewallRule | ConvertTo-Json -Compress;`;
	if (displayName !== undefined && displayName) {
		psScript = `Get-NetFirewallRule -DisplayName "${displayName}" | ConvertTo-Json -Compress;`;
	}

	let code = 0;
	let stdout = "";
	let stderr = "";
	try {
		logger.info(`(getFirewallRules) Running Get-NetFirewallRule`);
		[code, stdout, stderr] = await utils.Win_RunPowershell(psScript);
		if (code !== 0) {
			// PowerShell's exception is not passed to Deno's exception. Search for the errors in the output and
			// handle as necessary.
			if (stderr.match(/Access is denied/)) {
				logger.warning(`(getFirewallRules) Error getting the firewall rules`);
				logger.warning(`(getFirewallRules) This script needs to be run with Administrator permission`);
				logger.warning(`(getFirewallRules) stderr:`, stderr);
				/*
				} else if (stderr.match(/Requested registry access is not allowed/)) {
					logger.warning(`(getFirewallRules) Error getting the firewall rules`);
					logger.warning(`(getFirewallRules) This script needs to be run with Administrator permission`);
					logger.warning(`(getFirewallRules) stderr:`, stderr);
				*/
			} else {
				logger.warning(`(getFirewallRules) return code:`, code);
				logger.warning(`(getFirewallRules) stdout:`, stdout);
				logger.warning(`(getFirewallRules) stderr:`, stderr);
			}
		}
	} catch (err: unknown) {
		if (err instanceof Deno.errors.PermissionDenied) {
			logger.warning(`(getFirewallRules) Error getting the firewall rules`);
			logger.warning(`(getFirewallRules) This script needs to be run with Administrator permission`);
			logger.warning(`(getFirewallRules) err:`, err);
		} else {
			logger.error(`(getFirewallRules) Error getting the firewall rules`);
			logger.error(`(getFirewallRules) stderr:`, stderr);
			logger.error(`(getFirewallRules) err:`, err);
			throw err;
		}
	}

	logger.info(`(getFirewallRules) Done running Get-NetFirewallRule`);
	return <NetFirewallRule[]>JSON.parse(stdout);
}

/**
 * Get the firewall ports
 * @returns {NetFirewallPortFilter[]} - The firewall ports
 */
async function getFirewallPorts(): Promise<NetFirewallPortFilter[]> {
	const psScript = `Get-NetFirewallPortFilter | ConvertTo-Json -Compress;`;

	let code = 0;
	let stdout = "";
	let stderr = "";
	try {
		logger.info(`(getFirewallRules) Running Get-NetFirewallPortFilter`);
		[code, stdout, stderr] = await utils.Win_RunPowershell(psScript);
		if (code !== 0) {
			// PowerShell's exception is not passed to Deno's exception. Search for the errors in the output and
			// handle as necessary.
			if (stderr.match(/Access is denied/)) {
				logger.warning(`(getFirewallPorts) Error getting the firewall port filters`);
				logger.warning(`(getFirewallPorts) This script needs to be run with Administrator permission`);
				logger.warning(`(getFirewallPorts) stderr:`, stderr);
				/*
				} else if (stderr.match(/Requested registry access is not allowed/)) {
					logger.warning(`(getFirewallPorts) Error getting the firewall port filters`);
					logger.warning(`(getFirewallPorts) This script needs to be run with Administrator permission`);
					logger.warning(`(getFirewallPorts) stderr:`, stderr);
				*/
			} else {
				logger.warning(`(getFirewallPorts) return code:`, code);
				logger.warning(`(getFirewallPorts) stdout:`, stdout);
				logger.warning(`(getFirewallPorts) stderr:`, stderr);
			}
		}
	} catch (err: unknown) {
		if (err instanceof Deno.errors.PermissionDenied) {
			logger.warning(`(getFirewallPorts) Error getting the firewall port filters`);
			logger.warning(`(getFirewallPorts) This script needs to be run with Administrator permission`);
			logger.warning(`(getFirewallPorts) err:`, err);
		} else {
			logger.error(`(getFirewallPorts) Error getting the firewall port filters`);
			logger.error(`(getFirewallPorts) stderr:`, stderr);
			logger.error(`(getFirewallPorts) err:`, err);
			throw err;
		}
	}

	logger.info(`(getFirewallRules) Done running Get-NetFirewallPortFilter`);
	return <NetFirewallPortFilter[]>JSON.parse(stdout);
}

logger.debug(`(main) Starting`);
const rules = await getFirewallRules();
const firewallRuleMap: FirewallRuleMap = {};
rules.forEach((rule: NetFirewallRule) => {
	if (rule.InstanceID in firewallRuleMap) {
		// Item exists. Increment counter
		logger.debug(`(main) Count:`, firewallRuleMap[rule.InstanceID].Count);
	} else {
		// Item doesn't exist. Add it
		firewallRuleMap[rule.InstanceID] = <FirewallRule>{
			Count: 1,
			ID: rule.ID,
			InstanceID: rule.InstanceID,
			Name: rule.Name,
			DisplayName: rule.DisplayName,
			Enabled: rule.Enabled,
			Profile: rule.Profile,
			Direction: rule.Direction,
		};
	}
});

const ports = await getFirewallPorts();
ports.forEach((port: NetFirewallPortFilter) => {
	if (port.InstanceID in firewallRuleMap) {
		// Item exists. Add port information
		firewallRuleMap[port.InstanceID].firewallPort = {
			InstanceID: port.InstanceID,
			Name: port.Name,
			Protocol: port.Protocol,
			LocalPort: port.LocalPort,
		};
		// logger.debug(`(main) Added FirewallPort to Rule:`, firewallRuleMap[port.InstanceID]);
	} else {
		// Item doesn't exist. Log warning
		logger.warning(`(main) FirewallPort doesn't have matching rule. InstanceID:`, port.InstanceID);
	}
});

const rulesTable = new AsciiTable("Firewall Rules");
rulesTable
	.setHeadingAlign(AsciiAlign.CENTER)
	.setHeading(
		"Count",
		"InstanceID",
		"DisplayName",
		"Enabled",
		"Profile",
		"Direction",
		"Count",
		"PortName",
		"Protocol",
		"LocalPort");

for (const [_key, rule] of Object.entries(firewallRuleMap)) {
	if (rule.Count > 1) {
		logger.info(`(main) Duplicate firewall rule:`, rule);
	} else {
		rulesTable.addRow(
			rule.Count,
			rule.InstanceID,
			rule.DisplayName,
			rule.Enabled,
			rule.Profile,
			rule.Direction,
			rule.Count,
			rule.firewallPort?.Name,
			rule.firewallPort?.Protocol,
			rule.firewallPort?.LocalPort,
		);
	}
}
console.log(rulesTable.toString());
logger.debug(`(main) Done!`);
