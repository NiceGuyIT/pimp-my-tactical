import * as log from "https://deno.land/std@0.200.0/log/mod.ts";
import {FS_Files, JsonDiffOptions, FS_GetDirFiles} from "https://raw.githubusercontent.com/NiceGuyIT/pimp-my-tactical/v0.1.0/scripts/ts-lib/mod.ts";

declare namespace TSLib {
	const MyLogConfig: log.LogConfig;

	function IsErrorWithMessage(error: unknown): error is Error;

	function ToErrorWithMessage(maybeError: unknown): Error;

	function GetErrorMessage(error: unknown): string;

	async function Win_RunPowershell(script: string): Promise<string | Error>;

	async function Win_GetRegistryKey(regPath: string, regKey: string): Promise<string[] | Error>;

	async function Win_GetRegistryValue(regKey: string, regProperty: string): Promise<string | Error>;

	async function Win_SetRegistryValue(
		regKey: string,
		propertyName: string,
		propertyType: string,
		regPropertyValue: string | number
	): Promise<string | Error>;

	export async function Process_Exec(cmd: string, args: string[]): Promise<string | Error>;

	export async function Test_IsAdmin(): Promise<boolean | Error>;

	export function Test_IsInteractiveShell(): boolean;

	export async function FS_IsDir(path: string): Promise<boolean | Error>;

	export async function FS_GetDirFiles(path: string, regex: RegExp): Promise<FS_Files[] | Error>;

	export function JsonDiff(json1: JSON, json2: JSON, options: JsonDiffOptions): string;
}
