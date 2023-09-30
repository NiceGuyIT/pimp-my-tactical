import * as path from "https://deno.land/std@0.201.0/path/mod.ts";
import * as colors from "https://deno.land/std@0.201.0/fmt/colors.ts";
import * as datetime from "https://deno.land/std@0.201.0/datetime/mod.ts";
import * as log from "https://deno.land/std@0.201.0/log/mod.ts";
import * as tslib from "https://raw.githubusercontent.com/NiceGuyIT/pimp-my-tactical/v0.1.1/scripts/ts-lib/mod.ts";

/**
 * Configure the logging system.
 */
colors.setColorEnabled(tslib.Test_IsInteractiveShell());
log.setup(tslib.MyLogConfig);
const logger = log.getLogger();
// Enable color logging
logger.debug(`(main) Color enabled:`, colors.getColorEnabled());

/**
 * Bookmarks config definition
 */
interface BookmarksConfig {
	install: {
		/**
		 * Path to the script to install. This script will be copied to this path.
		 * Environmental variable: EB_INSTALL_PATH
		 */
		path: string;

		/**
		 * Path to the Deno executable.
		 * TODO: This probably isn't needed.
		 */
		deno: string;
	},

	save: {
		/**
		 * Directory to save the explorer bookmarks file
		 * Do not check if the directory exists because it will be created later.
		 * Environmental variable: EB_SAVE_DIR
		 * Default: $ENV:USERPROFILE\Documents\Explorer-Bookmarks\
		 */
		dir: string;

		/**
		 * Filename of the current bookmark file to create
		 * Environmental variable: EB_SAVE_DIR
		 * Default: ExplorerBookmarks-{yyyyMMdd-HHmmss}.txt
		 */
		filename: string;

		/**
		 * Prefix of the explorer bookmarks filename
		 * Environmental variable: EB_SAVE_FILENAME_PREFIX
		 * Default: ExplorerBookmarks
		 */
		prefix: string;

		/**
		 * Filename pattern to search for all bookmark filenames
		 */
		pattern: RegExp;

		/**
		 * Maximum number of bookmark files to save
		 * Environmental variable: EB_SAVE_MAX_NUM_FILES
		 */
		maxNumFiles: {
			min: number;
			max: number;
			default: number;
			current: number;
		}
	},

	restore: {
		/**
		 * Maximum file size to restore
		 * Environmental variable: EB_RESTORE_MAX_FILE_SIZE
		 */
		maxFileSize: {
			min: number;
			max: number;
			default: number;
			current: number;
		},

		/**
		 * Maximum number of windows to restore. Technically this is calculated by counting the number of lines in the
		 * file to restore.
		 * Environmental variable: EB_RESTORE_MAX_WINDOWS
		 */
		maxWindows: {
			min: number;
			max: number;
			default: number;
			current: number;
		},

		/**
		 * Delay in seconds between opening windows. This can be a fraction.
		 * Environmental variable: EB_RESTORE_DELAY_SECONDS
		 */
		delaySeconds: {
			min: number;
			max: number;
			default: number;
			current: number;
		},
	},

	scheduledTask: {
		/**
		 * Name of the Scheduled Task in Windows
		 */
		name: string;
	},

}

/**
 * Bookmarks config object
 */
const bookmarksConfig: BookmarksConfig = {
	install: {
		path: `C:\\ProgramData\\TacticalRMM\\Explorer-Bookmarks.exe`,
		deno: `C:\\ProgramData\\exec-wrapper\\bin\\deno.exe`,
	},
	save: {
		// Environment variables are case sensitive.
		dir: path.join(Deno.env.get("USERPROFILE") ?? "", `/Documents/Explorer-Bookmarks`),
		filename: "ExplorerBookmarks-yyyyMMdd-HHmmss.txt",
		prefix: "ExplorerBookmarks",
		pattern: new RegExp(`ExplorerBookmarks-.*\.txt`),
		maxNumFiles: {
			min: 1,
			max: 1000,
			default: 20,
			current: 20,
		},
	},
	restore: {
		maxFileSize: {
			min: 1,
			max: 4096,
			default: 1024,
			current: 1024,
		},
		maxWindows: {
			min: 1,
			max: 100,
			default: 50,
			current: 50,
		},
		delaySeconds: {
			min: 0,
			max: 10,
			default: 0.5,
			current: 0.5,
		},
	},
	scheduledTask: {
		name: "Restore-Explorer-Bookmarks",
	},
};

/**
 * Process the environmental variables and bookmarksConfig.
 */
function processConfig() {
	const functionName = "processConfig";
	if (Deno.env.has("EB_INSTALL_PATH")) {
		bookmarksConfig.install.path = Deno.env.get("EB_INSTALL_PATH")!;
	}

	if (Deno.env.has("EB_SAVE_DIR")) {
		bookmarksConfig.save.dir = Deno.env.get("EB_SAVE_DIR")!;
	}

	if (Deno.env.has("EB_SAVE_FILENAME_PREFIX")) {
		bookmarksConfig.save.prefix = Deno.env.get("EB_SAVE_FILENAME_PREFIX")!;
	}

	bookmarksConfig.save.pattern = new RegExp(`${bookmarksConfig.save.prefix}-.*\.txt`);
	bookmarksConfig.save.filename = `${bookmarksConfig.save.prefix}-${datetime.format(new Date(), "yyyyMMdd-HHmmss")}.txt`;

	if (Deno.env.has("EB_SAVE_MAX_NUM_FILES")) {
		const envMaxNumFiles = Number(Deno.env.get("EB_SAVE_MAX_NUM_FILES")!);
		if ((envMaxNumFiles < bookmarksConfig.save.maxNumFiles.min) ||
			(envMaxNumFiles > bookmarksConfig.save.maxNumFiles.max)) {
			logger.warning(`(${functionName}) EB_SAVE_MAX_NUM_FILES is not within the allowable range: ` +
				`${bookmarksConfig.save.maxNumFiles.min} <= ${envMaxNumFiles} <= ${bookmarksConfig.save.maxNumFiles.max}`);
			logger.warning(`(${functionName}) EB_SAVE_MAX_NUM_FILES: Using default of ${bookmarksConfig.save.maxNumFiles.default}`);
		} else {
			bookmarksConfig.save.maxNumFiles.current = Number(Deno.env.get("EB_SAVE_MAX_NUM_FILES")!);
		}
	}

	if (Deno.env.has("EB_RESTORE_MAX_FILE_SIZE")) {
		const envRestoreMaxFileSize = Number(Deno.env.get("EB_RESTORE_MAX_FILE_SIZE")!);
		if ((envRestoreMaxFileSize < bookmarksConfig.restore.maxFileSize.min) ||
			(envRestoreMaxFileSize > bookmarksConfig.restore.maxFileSize.max)) {
			logger.warning(`(${functionName}) EB_SAVE_MAX_NUM_FILES is not within the allowable range: ` +
				`${bookmarksConfig.restore.maxFileSize.min} <= ${envRestoreMaxFileSize} <= ${bookmarksConfig.restore.maxFileSize.max}`);
			logger.warning(`(${functionName}) EB_SAVE_MAX_NUM_FILES: Using default of ${bookmarksConfig.restore.maxFileSize.default}`);
		} else {
			bookmarksConfig.restore.maxFileSize.current = Number(Deno.env.get("EB_RESTORE_MAX_FILE_SIZE")!);
		}
	}

	if (Deno.env.has("EB_RESTORE_MAX_WINDOWS")) {
		const envRestoreMaxWindows = Number(Deno.env.get("EB_RESTORE_MAX_WINDOWS")!);
		if ((envRestoreMaxWindows < bookmarksConfig.restore.maxWindows.min) ||
			(envRestoreMaxWindows > bookmarksConfig.restore.maxWindows.max)) {
			logger.warning(`(${functionName}) EB_RESTORE_MAX_WINDOWS is not within the allowable range: ` +
				`${bookmarksConfig.restore.maxWindows.min} <= ${envRestoreMaxWindows} <= ${bookmarksConfig.restore.maxWindows.max}`);
			logger.warning(`(${functionName}) EB_RESTORE_MAX_WINDOWS: Using default of ${bookmarksConfig.restore.maxWindows.default}`);
		} else {
			bookmarksConfig.restore.maxWindows.current = Number(Deno.env.get("EB_RESTORE_MAX_WINDOWS")!);
		}
	}

	if (Deno.env.has("EB_RESTORE_DELAY_SECONDS")) {
		const envRestoreDelaySeconds = Number(Deno.env.get("EB_RESTORE_DELAY_SECONDS")!);
		if ((envRestoreDelaySeconds < bookmarksConfig.restore.delaySeconds.min) ||
			(envRestoreDelaySeconds > bookmarksConfig.restore.delaySeconds.max)) {
			logger.warning(`(${functionName}) EB_RESTORE_DELAY_SECONDS is not within the allowable range: ` +
				`${bookmarksConfig.restore.delaySeconds.min} <= ${envRestoreDelaySeconds} <= ${bookmarksConfig.restore.delaySeconds.max}`);
			logger.warning(`(${functionName}) EB_RESTORE_DELAY_SECONDS: Using default of ${bookmarksConfig.restore.delaySeconds.default}`);
		} else {
			bookmarksConfig.restore.delaySeconds.current = Number(Deno.env.get("EB_RESTORE_DELAY_SECONDS")!);
		}
	}

}

/**
 * Dump the bookmarksConfig to the logs.
 */
function dumpConfig() {
	const functionName = "dumpConfig";
	logger.debug(`(${functionName}) bookmarksConfig:`, bookmarksConfig);
	logger.debug(`(${functionName}) ENV USERPROFILE:`, Deno.env.get("USERPROFILE") ?? "");
	logger.debug(`(${functionName}) env var:`, Deno.env.toObject());
}

/**
 * verifyConfig will verify the configuration and return true if it's valid.
 * @return {boolean} Returns true if the configuration is valid.
 * @function verifyConfig
 */
function verifyConfig(): boolean {
	const functionName = "verifyConfig";
	let valid = true;

	// Install path is required
	if (bookmarksConfig.install.path === "") {
		logger.error(`(${functionName}) bookmarksConfig.install.path is not set.`);
		valid = false;
	}

	// Save dir is required
	if (bookmarksConfig.save.dir === "") {
		logger.error(`(${functionName}) bookmarksConfig.save.dir is not set.`);
		valid = false;
	}

	// Save prefix is required
	if (bookmarksConfig.save.prefix === "") {
		logger.error(`(${functionName}) bookmarksConfig.save.prefix is not set.`);
		valid = false;
	}

	// Save filename is required
	if (bookmarksConfig.save.filename === "") {
		logger.error(`(${functionName}) bookmarksConfig.save.filename is not set.`);
		valid = false;
	}

	// Save dir is required
	if (bookmarksConfig.save.dir === "") {
		logger.error(`(${functionName}) bookmarksConfig.save.dir is not set.`);
		valid = false;
	}

	// Save dir is required
	if (bookmarksConfig.save.dir === "") {
		logger.error(`(${functionName}) bookmarksConfig.save.dir is not set.`);
		valid = false;
	}

	// Save dir is required
	if (bookmarksConfig.save.dir === "") {
		logger.error(`(${functionName}) bookmarksConfig.save.dir is not set.`);
		valid = false;
	}

	// Save dir is required
	if (bookmarksConfig.save.dir === "") {
		logger.error(`(${functionName}) bookmarksConfig.save.dir is not set.`);
		valid = false;
	}

	return valid;
}

/**
 * newExplorerDir will create the Explorer Bookmarks directory if it does not already exist.
 * @param dir
 * @constructor
 */
function newExplorerDir(dir: string) {
	const functionName = "newExplorerDir";
	logger.info(`(${functionName}) Creating directory to store bookmark files: '${dir}'`);
	try {
		Deno.mkdirSync(dir, {
			recursive: true,
		});
	} catch (err) {
		if (!(err instanceof Deno.errors.AlreadyExists)) {
			logger.error(`(${functionName}) Error creating directory: '${dir}'`);
			logger.error(`(${functionName}) err:`, err);
			throw err;
		}
	}
}

/**
 * Save the explorer paths to the bookmarks file.
 * If no explorer windows are open, a 0 byte file will be saved. This indicates all windows are closed and no windows
 * are restored upon login.
 * @return {Promise<string | Error>} - Promise that resolves to the path to the bookmarks file or an Error object.
 * @function saveExplorerBookmarks
 */
async function saveExplorerBookmarks(): Promise<string | Error> {
	const functionName = "saveExplorerBookmarks";
	logger.info(`(${functionName}) Bookmarking the open explorer paths`);
	const script = `
		(New-Object -ComObject 'Shell.Application').Windows() | ForEach-Object {
			Write-Output $_.Document.Folder.Self.Path
		}
	`;

	return await tslib.Win_RunPowershell(script)
		.then((execResult): string | Error => {
			if (tslib.IsErrorWithMessage(execResult)) {
				return execResult;
			}

			// Stripe the tailing newline
			const paths = execResult.trim();
			logger.debug(`(${functionName}) Saving ${paths.split("\r\n").length} paths to ${bookmarksConfig.save.filename}`);
			const bookmarkFile = path.join(bookmarksConfig.save.dir, bookmarksConfig.save.filename);
			// Note: An empty file will be created if no windows are open.
			Deno.writeTextFile(bookmarkFile, paths);
			return bookmarkFile;
		})
		.catch((err: unknown): Error => {
			// if (err instanceof Deno.errors.PermissionDenied) {
			logger.error(`(${functionName}) Error saving the explorer windows. err:`, err);
			return tslib.ToErrorWithMessage(err);
		});
}

/**
 * Clean up duplicate files and files more than the configured maximum.
 * @constructor
 */
async function startCleanup() {
	const functionName = "dumpConfig";
	logger.info(`(${functionName}) Cleaning up the bookmark files`);

	const fileArray = await getBookmarksFiles();
	if (fileArray.length >= 2) {
		// Remove the current file if it's a duplicate of the previous bookmark file.
		const contentsLastOne = await Deno.readTextFile(path.join(bookmarksConfig.save.dir, fileArray[fileArray.length - 1][0]));
		const contentsLastTwo = await Deno.readTextFile(path.join(bookmarksConfig.save.dir, fileArray[fileArray.length - 2][0]));
		if (contentsLastOne == contentsLastTwo) {
			logger.info(`(${functionName}) The last two files are identical. Removing the last file: ${fileArray[fileArray.length - 2][0]}`);
			Deno.removeSync(path.join(bookmarksConfig.save.dir, fileArray[fileArray.length - 2][0]));
			fileArray.pop();
		}
	}

	if (fileArray.length > bookmarksConfig.save.maxNumFiles.current) {
		// Remove files more than the configured maximum.
		logger.info(`(${functionName}) Removing files more than the configured maximum: ${bookmarksConfig.save.maxNumFiles.current}`);
		while (fileArray.length > bookmarksConfig.save.maxNumFiles.current) {
			logger.info(`(${functionName}) Removing file: ${fileArray[0][0]}`);
			Deno.removeSync(path.join(bookmarksConfig.save.dir, fileArray[0][0]));
			fileArray.shift();
		}
	}

}

/**
 * Add the Explorer Bookmarks integration to the right-click menu for *.txt files.
 *
 * The right-click menu assumes the program is a windows program. Deno is a console program.
 * CMD, PowerShell or similar is needed to run the deno compiled program. This results in 2 windows: CMD and Deno.
 * This is not desirable but is the only way to get it to work.
 *
 * Here is the final command.
 *   cmd /d /e:off /f:off /v:off /c ""C:\ProgramData\TacticalRMM\Explorer-Bookmarks.exe" "%1""
 *
 * Double quotes are needed because CMD will strip the first and last quotes under certain circumstances.
 * @see https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/cmd#remarks
 *   If the previous conditions aren't met, string is processed by examining the first character to verify whether it
 *   is an opening quotation mark. If the first character is an opening quotation mark, it is stripped along with the
 *   closing quotation mark. Any text following the closing quotation marks is preserved.
 *
 * Deno issues to compile as a windows program:
 * - https://github.com/denoland/deno/discussions/11638
 * - https://github.com/denoland/deno/discussions/12941
 * - https://github.com/denoland/deno/issues/13107
 *
 * An alternative might be to do this:
 * @see https://stackoverflow.com/questions/10618977/how-to-add-an-entry-in-the-windows-context-menu-for-files-with-a-specific-extens
 * @returns {Promise<string | Error>} Promise that resolves to a string or Error.
 * @function addIntegration
 */
async function addIntegration(): Promise<string | Error> {
	const functionName = "addIntegration";
	logger.info(`(${functionName}) Adding the integration into explorer's right-click menu`);

	const psScript = `
		$null = New-PSDrive -Name HKCR -PSProvider Registry -Root HKEY_CLASSES_ROOT

		# KeyPath and KeyName are used to create the registry key.
		$KeyPath = "HKCR:\\SystemFileAssociations\\.txt"
		$KeyName = "Shell"
		$Path = "HKCR:\\SystemFileAssociations\\.txt\\Shell"
		if (-not(Test-Path -Path $Path)) {
			$null = New-Item -Path $KeyPath -Name $KeyName
		}

		# KeyPath and KeyName are used to create the registry key.
		$KeyPath = "HKCR:\\SystemFileAssociations\\.txt\\Shell"
		$KeyName = "Explorer-Bookmarks"
		$Path = "HKCR:\\SystemFileAssociations\\.txt\\Shell\\Explorer-Bookmarks"
		$Name = "(Default)"
		$Value = "Restore my Explorer Bookmarks"
		$Type = "String"
		# Need to check for the key and create it before checking for and creating the property.
		if (-not(Test-Path -Path $Path)) {
			# Create the key
			$null = New-Item -Path $KeyPath -Name $KeyName
			if ($null -eq (Get-ItemProperty -Path $Path -Name $Name -ErrorAction SilentlyContinue)) {
			# Create the property on the key
				$null = New-ItemProperty -Path $Path -Name $Name -Value $Value -PropertyType $Type
			}
		}

		# KeyPath and KeyName are used to create the registry key.
		$KeyPath = "HKCR:\\SystemFileAssociations\\.txt\\Shell\\Explorer-Bookmarks"
		$KeyName = "Command"
		$Path = "HKCR:\\SystemFileAssociations\\.txt\\Shell\\Explorer-Bookmarks\\Command"
		$Name = "(Default)"
		$Value = ("cmd /d /e:off /f:off /v:off /c \`"\`"${bookmarksConfig.install.path}\`" \`"%1\`"\`"")
		$Type = "String"
		# Need to check for the key and create it before checking for and creating the property.
		if (-not(Test-Path -Path $Path)) {
			# Create the key
			$null = New-Item -Path $KeyPath -Name $KeyName
			if ($null -eq (Get-ItemProperty -Path $Path -Name $Name -ErrorAction SilentlyContinue)) {
			# Create the property on the key
				$null = New-ItemProperty -Path $Path -Name $Name -Value $Value -PropertyType $Type
			}
		}
	`;

	logger.info(`(${functionName}) Adding the right-click integration`);
	return await tslib.Win_RunPowershell(psScript)
		.then((execResult: string | Error): string | Error => {
			if (tslib.IsErrorWithMessage(execResult)) {
				logger.warning(`(${functionName}) Error executing powershell script:`, execResult);
			}
			return execResult;
		})
		.catch((err: unknown): Error => {
			if (err instanceof Deno.errors.PermissionDenied) {
				logger.warning(`(${functionName}) This script needs to be run with Administrator permission`);
			}
			logger.error(`(${functionName}) Error adding the integration:`, err);
			if (tslib.IsErrorWithMessage(err)) {
				return err;
			} else {
				return new Error(tslib.GetErrorMessage(err));
			}
		});
}

/**
 * Remove the Explorer Bookmarks integration from the right-click menu of *.txt files.
 * @returns {Promise<string | Error>} Promise that resolves to a string or Error.
 * @function removeIntegration
 */
async function removeIntegration(): Promise<string | Error> {
	const functionName = "removeIntegration";
	logger.info(`(${functionName}) Removing the integration from explorer's right-click menu`);
	// HKCR is not mounted by default
	// @see https://superuser.com/questions/1621508/windows-10-powershell-registry-drives-are-not-working-properly
	const psScript = `
		$null = New-PSDrive -Name HKCR -PSProvider Registry -Root HKEY_CLASSES_ROOT

		$Path = "HKCR:\\SystemFileAssociations\\.txt\\Shell\\Explorer-Bookmarks\\Command"
		if (Test-Path -Path $Path) {
			$null = Remove-Item -Path $Path -Confirm:$false
		}

		$Path = "HKCR:\\SystemFileAssociations\\.txt\\Shell\\Explorer-Bookmarks"
		if (Test-Path -Path $Path) {
			$null = Remove-Item -Path $Path -Confirm:$false
		}

		$Path = "HKCR:\\SystemFileAssociations\\.txt\\Shell"
		if (Test-Path -Path $Path) {
			$null = Remove-Item -Path $Path -Confirm:$false
		}
	`;

	logger.info(`(${functionName}) Removing the right-click integration`);
	return await tslib.Win_RunPowershell(psScript)
		.then((execResult: string | Error): string | Error => {
			if (tslib.IsErrorWithMessage(execResult)) {
				logger.warning(`(${functionName}) Error executing powershell script:`, execResult);
			}
			return execResult;
		})
		.catch((err: unknown): Error => {
			if (err instanceof Deno.errors.PermissionDenied) {
				logger.warning(`(${functionName}) This script needs to be run with Administrator permission`);
			}
			logger.error(`(${functionName}) Error removing the integration:`, err);
			return tslib.ToErrorWithMessage(err);
		});

}

/**
 * existsScheduledTask returns true if the scheduled task exists.
 * @param {string} taskName - Name of the task to check.
 * @returns {Promise<boolean | Error>} Promise that resolves to a boolean or Error.
 * @function existsScheduledTask
 */
async function existsScheduledTask(taskName: string): Promise<boolean | Error> {
	const functionName = "existsScheduledTask";
	const countPS = `
		(Get-ScheduledTask -TaskName ${taskName} -ErrorAction SilentlyContinue | measure).Count
	`;

	logger.debug(`(${functionName}) Checking if scheduled task exists:`, taskName);
	const result = await tslib.Win_RunPowershell(countPS)
		.then((execResult: string | Error): string | Error => {
			if (tslib.IsErrorWithMessage(execResult)) {
				logger.warning(`(${functionName}) Error executing powershell script:`, execResult);
			}
			return execResult;
		})
		.catch((err: unknown): Error => {
			logger.error(`(${functionName}) Error checking if the scheduled task exists:`, err);
			if (tslib.IsErrorWithMessage(err)) {
				return err;
			} else {
				return new Error(tslib.GetErrorMessage(err));
			}
		});

	if (tslib.IsErrorWithMessage(result)) {
		return result;
	}

	const exists = (result.trim() !== "0");
	logger.debug(`(${functionName}) Result:`, exists);
	return exists;
}

/**
 * addScheduledTask will add the scheduled task that runs when the user logs in.
 * @returns {Promise<string | Error>} Promise that resolves to a string or Error.
 * @function addScheduledTask
 */
async function addScheduledTask(): Promise<string | Error> {
	const functionName = "addScheduledTask";
	const taskExists = await existsScheduledTask(bookmarksConfig.scheduledTask.name);
	if (taskExists) {
		logger.info(`(${functionName}) Scheduled Task ${bookmarksConfig.scheduledTask.name} exists`);
		// return new Error(`Scheduled Task ${bookmarksConfig.scheduledTask.name} already exists`);
		return "";
	}

	const psScript = `
		$Arguments = ("task")
		$Action = New-ScheduledTaskAction -Execute "${bookmarksConfig.install.path}" -Argument $Arguments
		$Trigger = New-ScheduledTaskTrigger -AtLogon
		$Principal = New-ScheduledTaskPrincipal -GroupId "BUILTIN\\Users"
		$null = Register-ScheduledTask -TaskName "${bookmarksConfig.scheduledTask.name}" -Trigger $Trigger -Action $Action -Principal $Principal
	`;

	logger.info(`(${functionName}) Adding Scheduled Task: '${bookmarksConfig.scheduledTask.name}'`);
	return await tslib.Win_RunPowershell(psScript)
		.then((execResult: string | Error): string | Error => {
			if (tslib.IsErrorWithMessage(execResult)) {
				logger.warning(`(${functionName}) Error executing powershell script:`, execResult);
			}
			if (typeof execResult === "string") {
				if (execResult.match(/Access is denied/)) {
					logger.warning(`(${functionName}) This script needs to be run with Administrator permission`);
				}
			}
			// TODO: This is here for future reference
			/**
			 * This soothes WebStorm but not Deno.
			 * @typedef {Object} scheduledTask - Scheduled Task object
			 * @property {string} TaskName - Task name of the Scheduled Task
			 */
			/** @type {scheduledTask} */
			/*
			const scheduledTask = JSON.parse(stdout);
			if (scheduledTask.TaskName == bookmarksConfig.scheduledTask.name) {
				logger.warning(`(${functionName}) Scheduled Task already exists:`, bookmarksConfig.scheduledTask.name);
				return;
			}
			*/
			return execResult;
		})
		.catch((err: unknown): Error => {
			if (err instanceof Deno.errors.PermissionDenied) {
				logger.warning(`(${functionName}) This script needs to be run with Administrator permission`);
			}
			logger.error(`(${functionName}) Error adding the Scheduled Task:`, err);
			return tslib.ToErrorWithMessage(err);
		});

}

/**
 * removeScheduledTask will remove the scheduled task that runs when the user logs in.
 * @returns {Promise<string | Error>} Promise that resolves to a string or Error.
 * @function addScheduledTask
 */
async function removeScheduledTask(): Promise<string | Error> {
	const functionName = "removeScheduledTask";
	const taskExists = await existsScheduledTask(bookmarksConfig.scheduledTask.name);
	if (!taskExists) {
		logger.info(`(${functionName}) Scheduled Task '${bookmarksConfig.scheduledTask.name}' does not exists`);
		return "";
	}

	const psScript = `
		$null = Unregister-ScheduledTask -TaskName ${bookmarksConfig.scheduledTask.name} -Confirm:$false
	`;

	logger.info(`(${functionName}) Removing Scheduled Task: '${bookmarksConfig.scheduledTask.name}'`);

	return await tslib.Win_RunPowershell(psScript)
		.then((execResult: string | Error): string | Error => {
			if (tslib.IsErrorWithMessage(execResult)) {
				logger.warning(`(${functionName}) Error executing powershell script:`, execResult);
			}
			if (typeof execResult === "string") {
				if (execResult.match(/Access is denied/)) {
					logger.warning(`(${functionName}) This script needs to be run with Administrator permission`);
				}
			}
			return execResult;
		})
		.catch((err: unknown): Error => {
			if (err instanceof Deno.errors.PermissionDenied) {
				logger.warning(`(${functionName}) This script needs to be run with Administrator permission`);
			}
			logger.error(`(${functionName}) Error removing the Scheduled Task:`, err);
			if (tslib.IsErrorWithMessage(err)) {
				return err;
			} else {
				return new Error(tslib.GetErrorMessage(err));
			}
		});

}

/**
 * installScript will compile the script and save it in the TacticalRMM directory for use by the user outside Tactical.
 * @returns {Promise<string | Error>} Promise that resolves to a string or Error.
 * @function installScript
 */
async function installScript(): Promise<string | Error> {
	const functionName = "installScript";
	// These environmental variables are guaranteed to be set because they are used by the exec wrapper to call this
	// script.
	const remoteUrl = Deno.env.get("WRAPPER_REMOTE_REPO") ?? "";
	const remoteVersion = Deno.env.get("WRAPPER_REMOTE_VERSION") ?? "";
	const remoteScript = Deno.env.get("WRAPPER_REMOTE_SCRIPT") ?? "";
	const source = `${remoteUrl}/${remoteVersion}/${remoteScript}`;
	const cmd = Deno.execPath();
	const args = [
		"compile",
		"--no-prompt",
	];
	if (!remoteUrl || !remoteVersion || !remoteScript) {
		logger.error(`(${functionName}) Remote URL, Version, or Script is not specified`);
		logger.error(`(${functionName}) WRAPPER_REMOTE_REPO:`, Deno.env.get("WRAPPER_REMOTE_REPO") ?? "");
		logger.error(`(${functionName}) WRAPPER_REMOTE_VERSION:`, Deno.env.get("WRAPPER_REMOTE_VERSION") ?? "");
		logger.error(`(${functionName}) WRAPPER_REMOTE_SCRIPT:`, Deno.env.get("WRAPPER_REMOTE_SCRIPT") ?? "");
		logger.error(`(${functionName}) remoteUrl:`, remoteUrl);
		logger.error(`(${functionName}) remoteVersion:`, remoteVersion);
		logger.error(`(${functionName}) remoteScript:`, remoteScript);
		logger.error(`(${functionName}) if statement:`, <boolean>(!remoteUrl || !remoteVersion || !remoteScript));
		return new Error(`(${functionName}) Remote URL, Version, or Script is not specified`);
	}
	if (logger.levelName !== "DEBUG") {
		// Hiding the terminal also hides critical errors. Only hide it if not debugging.
		args.push("--no-terminal");
	}
	if (Deno.env.has("EXEC_DENO_PERMISSION_FLAGS")) {
		// EXEC_DENO_PERMISSION_FLAGS is used by the exec wrapper, but also used here to compile.
		args.push(...(Deno.env.get("EXEC_DENO_PERMISSION_FLAGS") ?? "").split(" "));
	}
	args.push(
		// Save location
		"--output",
		bookmarksConfig.install.path,
		source,
	);

	logger.debug(`(${functionName}) Compiling '${source}' to executable '${bookmarksConfig.install.path}'`);
	logger.debug(`(${functionName}) args:`, args);
	return await tslib.Process_Exec(cmd, args)
		.then((execResult: string | Error): string | Error => {
			if (tslib.IsErrorWithMessage(execResult)) {
				return execResult;
			}

			if (execResult === "") {
				logger.warning(`(${functionName}) STDOUT is empty:`, execResult);
			}
			return execResult;
		})
		.catch((err: unknown): Error => {
			logger.error(`(${functionName}) Error compiling the script for installation:`, err);
			return tslib.ToErrorWithMessage(err);
		});
}

/**
 * uninstallScript will uninstall (delete) the Explorer-Bookmarks.exe executable from the system.
 * @returns {Promise<boolean | Error>} Promise that resolves to a string or Error.
 * @function uninstallScript
 */
async function uninstallScript(): Promise<boolean | Error> {
	const functionName = "uninstallScript";

	let removeFile = bookmarksConfig.install.path;
	let removeResults;
	let result: boolean | Error = true;
	removeResults = await Deno.stat(removeFile)
		.then(async (fileInfo: Deno.FileInfo): Promise<boolean | Error> => {
			if (fileInfo.isFile) {
				logger.info(`(${functionName}) Uninstalling executable from ${removeFile}`);
				return await Deno.remove(removeFile)
					.then(() => {
						logger.info(`(${functionName}) Successfully removed ${removeFile}`);
						return true;
					})
					.catch((err: unknown): Error => {
						logger.error(`(${functionName}) Error removing ${removeFile}:`, err);
						return tslib.ToErrorWithMessage(err);
					});
			} else {
				logger.info(`(${functionName}) File does not exist:`, removeFile);
				// FIXME: This needs verification.
				return false;
			}
		})
		.catch((err: unknown): boolean | Error => {
			if (!(err instanceof Deno.errors.NotFound)) {
				logger.error(`(${functionName}) Error removing file: '${removeFile}':`, err);
				return tslib.ToErrorWithMessage(err);
			}
			return true;
		});
	if (tslib.IsErrorWithMessage(removeResults)) {
		logger.error(`(${functionName}) Error removing file '${removeFile}':`, removeResults);
		result = removeResults;
	}

	// Clean up PowerShell version of the script
	removeFile = `C:\\ProgramData\\TacticalRMM\\Explorer-Bookmarks.ps1`;
	removeResults = await Deno.stat(removeFile)
		.then(async (fileInfo: Deno.FileInfo): Promise<boolean | Error> => {
			if (fileInfo.isFile) {
				logger.info(`(${functionName}) Uninstalling PowerShell script ${removeFile}`);
				return await Deno.remove(removeFile)
					.then(() => {
						logger.info(`(${functionName}) Successfully removed ${removeFile}`);
						return true;
					})
					.catch((err: unknown): Error => {
						logger.error(`(${functionName}) Error removing ${removeFile}:`, err);
						if (tslib.IsErrorWithMessage(err)) {
							return err;
						} else {
							return new Error(tslib.GetErrorMessage(err));
						}
					});
			} else {
				logger.info(`(${functionName}) File does not exist:`, removeFile);
				// FIXME: This needs verification.
				return false;
			}
		})
		.catch((err: unknown): boolean | Error => {
			if (!(err instanceof Deno.errors.NotFound)) {
				logger.error(`(${functionName}) Error removing file: '${removeFile}':`, err);
				return tslib.ToErrorWithMessage(err);
			}
			return true;
		});
	if (tslib.IsErrorWithMessage(removeResults)) {
		logger.error(`(${functionName}) Error removing file '${removeFile}':`, removeResults);
		result = removeResults;
	}
	return result;
}

/**
 * openExplorerBookmarks will open the bookmarks in the given file.
 * @param {string} bookmarkFile - Bookmark file to open
 * @returns {Promise<boolean | Error>} Promise that resolves to a string or Error.
 * @function openExplorerBookmarks
 */
async function openExplorerBookmarks(bookmarkFile: string): Promise<boolean | Error> {
	const functionName = "openExplorerBookmarks";
	logger.info(`(${functionName}) Opening file ${bookmarkFile}`);

	// Check if the file is larger than the maximum file size.
	// This also checks if the file exists.
	const ok = await Deno.stat(bookmarkFile)
		.then((fileInfo: Deno.FileInfo): boolean => {
			if (fileInfo.size > bookmarksConfig.restore.maxFileSize.current) {
				logger.warning(`(${functionName}) Requested file ${bookmarkFile} is more than the maximum file size`);
				logger.warning(`(${functionName}) File size: ${fileInfo.size}`);
				logger.warning(`(${functionName}) Maximum file size: ${bookmarksConfig.restore.maxFileSize.current}`);
				return false;
			} else {
				return true;
			}
		})
		.catch((err: unknown): boolean | Error => {
			if (err instanceof Deno.errors.NotFound) {
				logger.warning(`(${functionName}) Requested file ${bookmarkFile} is not found:`, err);
				return false;
			} else {
				logger.error(`(${functionName}) Unknown error when opening bookmarks file '${bookmarkFile}':`, err);
				return tslib.ToErrorWithMessage(err);
			}

		});
	if (tslib.IsErrorWithMessage(ok)) {
		logger.error(`(${functionName}) Error opening bookmark file '${bookmarkFile}':`, ok);
		return ok;
	} else if (!ok) {
		// The file is too large.
		return ok;
	}


	const bookmarkPaths = await Deno.readTextFile(bookmarkFile)
		.then((fileContents: string): string[] => {
			return fileContents.trim().split("\n");
		})
		.catch((err: unknown): Error => {
			logger.error(`(${functionName}) Error reading bookmark file '${bookmarkFile}':`, err);
			return tslib.ToErrorWithMessage(err);
		});
	if (tslib.IsErrorWithMessage(bookmarkPaths)) {
		logger.error(`(${functionName}) Error opening bookmark file '${bookmarkFile}':`, ok);
		return bookmarkPaths;
	}

	// Check if the number of bookmarks to restore is more than the maximum allowed.
	if (bookmarkPaths.length > bookmarksConfig.restore.maxWindows.current) {
		logger.warning(`(${functionName}) Number of explorer windows to restore is more than the maximum allowed`);
		logger.warning(`(${functionName}) Windows to restore: ${bookmarkPaths.length}`);
		logger.warning(`(${functionName}) Maximum windows to restore: ${bookmarksConfig.restore.maxWindows.current}`);
		return false;
	}

	// Get the path to Windows explorer.exe
	if (!Deno.env.has("SystemRoot")) {
		logger.warning(`(${functionName}) Environmental variable 'SystemRoot' is not set`);
	}
	const explorer = path.join(Deno.env.get("SystemRoot") ?? "C:/Windows", "explorer.exe");

	bookmarkPaths.forEach(bookmarkPath => {
		try {
			// Trim the trailing carriage return (\r) since the split was on newline (\n).
			const fileInfo = Deno.statSync(bookmarkPath.trim());
			if (fileInfo.isDirectory) {
				logger.debug(`(${functionName}) Opening Explorer Bookmark: ${bookmarkPath}`);
				// For additional command line switches:
				// @see https://superuser.com/questions/21394/explorer-command-line-switches
				const result = tslib.Process_Spawn(explorer, [bookmarkPath.trim()]);
				if (tslib.IsErrorWithMessage(result)) {
					logger.error(`(${functionName}) Error opening Explorer Bookmark: ${bookmarkPath}:`, result);
				}
			} else {
				logger.info(`(${functionName}) Bookmark was not found: ${bookmarkPath}`);
			}
		} catch (err) {
			if (!(err instanceof Deno.errors.NotFound)) {
				logger.error(`(${functionName}) Unknown error when reading bookmarks file '${bookmarkFile}'`);
				logger.error(`(${functionName}) err:`, err);
				throw err;
			}
		}
	});
	return true;
}

/**
 * getBookmarksFiles will get the list of bookmark files sorted by last modified time.
 * @return {string}
 */
async function getBookmarksFiles(): Promise<[string, Date][]> {
	let fileArray: [string, Date][] = [];
	for await (const dirEntry of Deno.readDir(bookmarksConfig.save.dir)) {
		if (dirEntry.isFile && (dirEntry.name.match(bookmarksConfig.save.pattern) !== null)) {
			const fileInfo = Deno.statSync(path.join(bookmarksConfig.save.dir, dirEntry.name));
			fileArray.push([dirEntry.name, fileInfo.mtime ?? new Date(0)]);
		}
	}
	if (fileArray.length > 1) {
		// If 2 or more files, sort the files by the last modified time.
		fileArray = fileArray.sort((a, b) => {
			return a[1].getTime() - b[1].getTime();
		});
	}
	return fileArray;
}

/**
 * getHelp will print the help message.
 * @function getHelp
 */
function getHelp() {
	const help = `Explorer Bookmarks will "bookmark" the open Explorer windows.

Usage:

deno explorer-bookmarks.ts
	Bookmark the open Windows Explorer paths in a file.

deno explorer-bookmarks.ts <file>
	Load the bookmarks from a file. This is usually done from a right-click menu.

$ENV:EB_ACTION=task; deno explorer-bookmarks.ts
	This command is run from the scheduled task to restore the last bookmarks saved opon login.

$ENV:EB_ACTION=<install | uninstall | reinstall>; deno explorer-bookmarks.ts
	Install/uninstall/reinstall the integration: Script, right click menu and scheduled task.

Environmental variables:

	EB_ACTION - Administrative action to take. One of task, install, uninstall, reinstall
	EB_INSTALL_PATH - Where to install this script for the integration.
	EB_SAVE_DIR - Directory to save the explorer bookmark files.
	EB_SAVE_FILENAME_PREFIX - Filename prefix to use for the bookmark files.
	EB_SAVE_MAX_NUM_FILES - Maximum number of bookmark files to save.
	EB_RESTORE_MAX_FILE_SIZE - Maximum file size to restore.
	EB_RESTORE_MAX_WINDOWS - Maximum number of windows to restore.
	  Note: This counts the lines in the file, not actual windows.
	EB_RESTORE_DELAY_SECONDS - Delay in seconds between opening each window.
	TS_LOG_LEVEL - Set the log level of the TypeScript logger.

Deno permissions
	This script requires the following permissions. See https://deno.land/manual/basics/permissions
	for an explanation of the permissions.
		--allow-read
		--allow-write
		--allow-run
		--allow-sys
		--allow-env
`;
	console.log(help);
}

// Used to provide the method name for logging.
const functionName = "main";

// Check if the script is run as an Administrator.
const isAdminResult = await tslib.Test_IsAdmin();
if (tslib.IsErrorWithMessage(isAdminResult)) {
	logger.error(`(${functionName}) Error testing for admin permissions:`, isAdminResult);
	Deno.exit(1);
}
const isAdmin = <boolean>isAdminResult;
logger.debug(`(${functionName}) isAdmin: ${isAdmin}`);
let returnCode = 0;

processConfig();
if (logger.levelName === "DEBUG") {
	// Dump the config when debugging.
	dumpConfig();
}

const valid = verifyConfig();
if (!valid) {
	returnCode = 1;
	Deno.exit(returnCode);
}

if (Deno.build.os !== "windows") {
	logger.warning(`(${functionName}) This script is designed for Windows. Please run it on a Windows OS.`);
	returnCode = 1;
	Deno.exit(returnCode);
}

if (Deno.env.has("EB_ACTION")) {
	switch (Deno.env.get("EB_ACTION")?.toLowerCase()) {

		case "install": {
			if (isAdmin) {
				await installScript();
				await addIntegration();
				await addScheduledTask();
			} else {
				logger.error(`(${functionName}) Failed to install the integration. Administrator permission is required.`);
				returnCode = 1;
			}
		}
			break;

		case "uninstall": {
			if (isAdmin) {
				await uninstallScript();
				await removeIntegration();
				await removeScheduledTask();
			} else {
				logger.error(`(${functionName}) Failed to uninstall the integration. Administrator permission is required.`);
				returnCode = 1;
			}
		}
			break;

		case "reinstall": {
			if (isAdmin) {
				// Uninstall
				logger.info(`(${functionName}) Reinstalling the integration. Uninstalling`);
				await uninstallScript();
				await removeIntegration();
				await removeScheduledTask();

				// Install
				logger.info(`(${functionName}) Reinstalling the integration. Installing`);
				await installScript();
				await addIntegration();
				await addScheduledTask();
			} else {
				logger.error(`(${functionName}) Failed to reinstall the integration. Administrator permission is required.`);
				returnCode = 1;
			}
		}
			break;

		case "dev": {
			await saveExplorerBookmarks();
			await removeIntegration();
			await addIntegration();
		}
			break;

		case "help": {
			getHelp();
		}
			break;

		default: {
			logger.error(`(${functionName}) Invalid action: '${Deno.env.get("EB_ACTION")?.toLowerCase()}'`);
			getHelp();
			returnCode = 1;
		}
			break;
	}
} else {

	switch (Deno.args.length) {
		case 0: {
			if (isAdmin) {
				// TacticalRMM's RunAsUser functionality will work only if a session is active.
				// If 'query.exe session' does not show an active session, the user is not logged in.
				// This happens if you connect via RDP and then disconnect. The login session is there but not active.
				// Logging in through MeshCentral will start the session on the console, and disconnecting MeshCentral
				// will leave the console session active.
				// For this reason, we don't set the return code as failure.
				// @see https://docs.tacticalrmm.com/howitallworks/#runasuser-functionality
				logger.info(`(${functionName}) Session is not active for RunAsUser functionality.`);
				break;
			}

			// Zero args: Save the Explorer paths
			// User configuration
			newExplorerDir(bookmarksConfig.save.dir);
			await saveExplorerBookmarks();
			await startCleanup();
		}
			break;

		case 1: {
			switch (Deno.args[0].toLowerCase()) {

				case "task": {
					// Scheduled task to open the bookmarks in the last saved file.
					if (isAdmin) {
						logger.warning(`(${functionName}) This script should not be run as an administrator.`);
						returnCode = 1;
						break;
					}

					// Open the bookmarks saved in the last bookmark file.
					const fileArray = await getBookmarksFiles();
					if (fileArray.length >= 1) {
						// Sleep 10 seconds to allow the desktop and other tasks to load.
						const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
						await sleep(10 * 1000);
						await openExplorerBookmarks(path.join(bookmarksConfig.save.dir, fileArray[fileArray.length - 1][0]));
					}

				}
					break;

				case "help": {
					getHelp();
				}
					break;

				default: {
					// Open the bookmarks from the right-click menu in Explorer.
					await openExplorerBookmarks(Deno.args[0]);
					// FIXME: Should this sleep?
				}
					break;
			}
		}
			break;

		default: {
			logger.error(`(${functionName}) Wrong number of arguments: '${Deno.args.length}'`);
			getHelp();
			returnCode = 1;
		}
	}
}

Deno.exit(returnCode);
