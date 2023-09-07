import * as log from "https://deno.land/std@0.200.0/log/mod.ts";

declare namespace TSLib {
	const MyLogConfig: log.LogConfig;

	async function Win_RunPowershell(script: string): Promise<ExecResult>;

	async function Win_GetRegistryKey(regPath: string, regKey: string): Promise<string[]>;

	async function Win_GetRegistryKey(regPath: string, regKey: string): Promise<Result>;

	async function Win_GetRegistryValue(regKey: string, regProperty: string): Promise<Result>;

	async function Win_SetRegistryValue(
		regKey: string,
		propertyName: string,
		propertyType: string,
		regPropertyValue: string | number
	): Promise<void>;

	/**
	 * Interface for functions that return a result.
	 * TODO: This may change once I learn how to throw an error in a Promise.
	 */
	interface Result {
		value?: string | string[] | number;
		err?: Error | unknown;
	}

	/**
	 * Interface for functions that exec a command and return the results.
	 */
	interface ExecResult {
		stdout?: string;
		stderr?: string;
		returnCode: number;
	}
}
