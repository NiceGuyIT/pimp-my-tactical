import * as colors from "https://deno.land/std@0.201.0/fmt/colors.ts";
import * as log from "https://deno.land/std@0.201.0/log/mod.ts";
import AsciiTable, {AsciiAlign} from "https://deno.land/x/ascii_table@v0.1.0/mod.ts";
import * as tslib from "https://raw.githubusercontent.com/NiceGuyIT/pimp-my-tactical/v0.0.7/scripts/ts-lib/mod.ts";
import {NetFirewallRule, NetFirewallPortFilter} from "https://raw.githubusercontent.com/NiceGuyIT/pimp-my-tactical/v0.0.7/scripts/ts-lib/microsoft.d.ts";

/**
 * JSON to JSON Schema: https://transform.tools/json-to-json-schema
 * JSON Schema to JSDoc: https://francisn.com/json-schema-to-jsdoc/
 * JSON to JSON Schema with references: https://jsonformatter.org/json-to-jsonschema
 */

/**
 * To convert enum to string, use the following:
 * [enum]::GetNames([Microsoft.PowerShell.Cmdletization.GeneratedTypes.NetSecurity.Profile]) |
 * foreach {
 * 		$num = [Microsoft.PowerShell.Cmdletization.GeneratedTypes.NetSecurity.Profile]::$_.value__;
 * 		Write-Host ("${num} - ${_}");
 * }
 */

/**
 * Configure the logging system.
 */
log.setup(tslib.MyLogConfig);
const logger = log.getLogger();

// Are we developers?
const dev = false;

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

logger.debug(`(main) Starting`);
let rules: NetFirewallRule[] = []
logger.debug(`(main) Getting firewall rules`);
const rulesResult = await tslib.Win_RunPowershell(`Get-NetFirewallRule | ConvertTo-Json -Compress`);
if ("err" in rulesResult) {
	logger.error(`(main) Error getting the firewall rules:`, rulesResult.err);
	throw rulesResult.err;
} else if ("stdout" in rulesResult) {
	logger.debug(`(main) Done getting firewall rules`);
	rules = <NetFirewallRule[]>JSON.parse(rulesResult.stdout ?? "");
}

let ports: NetFirewallPortFilter[] = []
logger.debug(`(main) Getting firewall ports`);
const portsResult = await tslib.Win_RunPowershell(`Get-NetFirewallRule | ConvertTo-Json -Compress`);
if ("err" in portsResult) {
	logger.error(`(main) Error getting the firewall rules:`, portsResult.err);
	throw portsResult.err;
} else if ("stdout" in portsResult) {
	ports = <NetFirewallPortFilter[]>JSON.parse(portsResult.stdout ?? "");
	logger.debug(`(main) Done getting firewall ports`);
}

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
