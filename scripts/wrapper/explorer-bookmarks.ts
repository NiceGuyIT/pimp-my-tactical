import { readLines } from "https://deno.land/std@0.198.0/io/read_lines.ts";
import { exists, ensureDirSync } from "https://deno.land/std@0.198.0/fs/mod.ts";
import { join } from "https://deno.land/std@0.198.0/path/mod.ts";
import { format } from "https://deno.land/std@0.198.0/datetime/mod.ts";
import { exec, IExecResponse, OutputMode } from "https://deno.land/x/exec@0.0.5/mod.ts";
import * as log from "https://deno.land/std@0.198.0/log/mod.ts";

const bookmarks = "test-file.txt";
const fileReader = await Deno.open(bookmarks);

for await (const line of readLines(fileReader)) {
	// console.log('Line is', line);
	if (await exists(line, {
		isDirectory: true,
		isReadable: true,
	})) {
		console.log("Opening directory", line);
	}
}


/**
 * EB_BOOKMARKS_DIR is the directory to save the explorer bookmark files
 * Do not check if the directory exists because it will be created later.
 * Default: Documents\Explorer-Bookmarks\
 */
const BookmarksDir = Deno.env.get("EB_BOOKMARKS_DIR") ??
	join(Deno.env.get("UserProfile") ?? "", `/Documents/Explorer-Bookmarks`);

/**
 * EB_FILENAME_PREFIX is the filename prefix to use
 */
const FilenamePrefix = Deno.env.get("EB_FILENAME_PREFIX") ?? "ExplorerBookmarks";

// Name to use for the scheduled task.
const TaskName = "Restore-Explorer-Bookmarks";

// Filename pattern is used to search for all bookmark filenames
const FilenamePattern = `${FilenamePrefix}-*.txt`;

// BookmarkFilename is the current bookmark file to create
const BookmarkFilename = `${FilenamePrefix}-${format(new Date(), "yyyyMMdd-HHmmss")}.txt`;

/**
 * ENV:EB_MAX_NUM_FILES is the maximum number of bookmark files to save
 * Default: 20
 * Hard limit: 1000
 */
let MaxNumFiles = Number(Deno.env.get("EB_MAX_NUM_FILES") ?? 20);
if ((MaxNumFiles < 1) || (MaxNumFiles > 1000)) {
	console.warn(`EB_MAX_NUM_FILES: is not a number between 1 and 1000 inclusive: '${MaxNumFiles}'`);
	console.warn(`EB_MAX_NUM_FILES: Using default of 20`);
	MaxNumFiles = 20;
}

/**
 * EB_RESTORE_MAX_FILE_SIZE is the maximum file size to restore
 * Default: 1024 bytes (1KB)
 */
let RestoreMaxFileSize = Number(Deno.env.get("EB_RESTORE_MAX_FILE_SIZE") ?? 1024);
if ((RestoreMaxFileSize < 1) || (RestoreMaxFileSize > 4096)) {
	console.warn(`EB_RESTORE_MAX_FILE_SIZE: is not a number between 1 and 4KB (4096 bytes) inclusive: '${RestoreMaxFileSize}'`);
	console.warn(`EB_RESTORE_MAX_FILE_SIZE: Using default of 1KB`);
	RestoreMaxFileSize = 1024;
}

/**
 * EB_RESTORE_MAX_WINDOWS is the maximum number of windows to restore. Technically this is calculated by counting
 * the number of lines in the file to restore.
 * Default: 100
 * Hard limit: 250
 */
let RestoreMaxWindows = Number(Deno.env.get("EB_RESTORE_MAX_WINDOWS") ?? 100);
if ((RestoreMaxWindows < 1) || (RestoreMaxWindows > 250)) {
	console.warn(`EB_RESTORE_MAX_WINDOWS: is not a number between 1 and 250 inclusive: '${RestoreMaxWindows}'`);
	console.warn(`EB_RESTORE_MAX_WINDOWS: Using default of 100`);
	RestoreMaxWindows = 100;
}

/**
 * EB_RESTORE_DELAY_SECONDS is the delay in seconds between opening windows. This can be a fraction.
 * Default: 0.5
 * Hard limit: 30
 */
let RestoreDelaySeconds = Number(Deno.env.get("EB_RESTORE_DELAY_SECONDS") ?? 0.5);
if ((RestoreDelaySeconds < 0) || (RestoreDelaySeconds > 30)) {
	console.warn(`EB_RESTORE_DELAY_SECONDS: is not a number between 0 and 30 inclusive: '${RestoreDelaySeconds}'`);
	console.warn(`EB_RESTORE_DELAY_SECONDS: Using default of 0.5`);
	RestoreDelaySeconds = 0.5;
}

/**
 * ENV:EB_SCRIPT_PATH is the path to the script to install. This script will be copied to this path.
 * Default: TacticalRMM directory, "C:\ProgramData\TacticalRMM\Explorer-Bookmarks.ps1"
 */
const ScriptPath = Deno.env.get("EB_SCRIPT_PATH") ?? `C:/ProgramData/TacticalRMM/Explorer-Bookmarks.ps1`;

/**
 * EB_LOG_LEVEL is the log level of the script.
 * Default: Verbose
 */
// FIXME: This can be improved.
let levelName: log.LevelName;
switch (Deno.env.get("EB_LOG_LEVEL") ?? "") {
	case "NOTSET":
		levelName = "NOTSET";
		break;
	case "DEBUG":
		levelName = "DEBUG";
		break;
	case "INFO":
		levelName = "INFO";
		break;
	case "WARNING":
		levelName = "WARNING";
		break;
	case "ERROR":
		levelName = "ERROR";
		break;
	case "CRITICAL":
		levelName = "CRITICAL";
		break;
	default:
		levelName = "WARNING";
		break;
}

log.setup({
	loggers: {
		default: {
			level: levelName,
		}
	}
});

/**
 * NewExplorerDir will create the Explorer Bookmarks directory if it does not already exist.
 * @param dir
 * @constructor
 */
function NewExplorerDir(dir: string) {
	dir = BookmarksDir;
	if (!exists(dir, {
		isDirectory: true,
		isReadable: true,
	})) {
		console.info(`Creating directory to store bookmark files: '${dir}'`);
		ensureDirSync(dir);
	}
}

function SaveExplorerBookmarks() {
	console.info(`Bookmarking the open explorer paths`);

	/*
		(New-Object -ComObject 'Shell.Application').Windows() | ForEach-Object {
			$localPath = $_.Document.Folder.Self.Path
			Write-Output $localPath
		} | Set-Content $( Join-Path $BookmarksDir $BookmarkFilename )
	*/
}

function StartCleanup() {
	console.info(`Cleaning up the bookmark files`);

	/*
		// Remove the current file if it is empty.
		$CurrentFile = Get-ChildItem -Path $BookmarksDir -File -Filter $FilenamePattern |
		Sort-Object -Property CreationTime -Descending |
		Select-Object -First 1
		if ($CurrentFile.Length -eq 0) {
			Write-Output ("Removing empty files.")
			Write-Verbose ("Removing empty file: '{0}'" -f $File.Name)
			$File | Remove-Item
		}

		// Remove the current file if it's a duplicate of the previous bookmark file.
		$LastTwo = Get-ChildItem -Path $BookmarksDir -File -Filter $FilenamePattern |
		Sort-Object -Property CreationTime -Descending |
		Select-Object -First 2 |
		Get-FileHash
		if (($LastTwo.Length -eq 2) -and ($LastTwo[0].Hash -eq $LastTwo[1].Hash)) {
			Write-Output ("Removing the current file since it's a duplicate of the previous file.")
			Write-Verbose ("Removing file: '{0}'" -f $LastTwo[0].Path)
			Remove-Item -Path $LastTwo[0].Path
		}

		// Remove files matching the bookmark file pattern that are more than the maximum number of files.
			$MatchingFiles = Get-ChildItem -Path $BookmarksDir -File -Filter $FilenamePattern |
		Sort-Object -Property CreationTime -Descending
		if ($MatchingFiles.Length -gt $MaxNumFiles) {
			Write-Output ("Removing files more than the maximum number of files configured ({0})" -f $MaxNumFiles)
			ForEach ($File in $MatchingFiles[($MaxNumFiles)..($MatchingFiles.Length)]) {
				Write-Verbose ("Removing: '{0}'" -f $File.FullName)
				Remove-Item -Path $File.FullName
			}
		}
	*/
}

function AddIntegration() {
	console.info(`Adding the integration into explorer's right-click menu`);
	// Another way of doing this:
	// https://stackoverflow.com/questions/10618977/how-to-add-an-entry-in-the-windows-context-menu-for-files-with-a-specific-extens

	// HKCR is not mounted by default
	// https://superuser.com/questions/1621508/windows-10-powershell-registry-drives-are-not-working-properly
	/*
		$null = New-PSDrive -Name HKCR -PSProvider Registry -Root HKEY_CLASSES_ROOT
	*/

	// KeyPath and KeyName are used to create the they registry key.
	/*
		$KeyPath = "HKCR:\SystemFileAssociations\.txt"
		$KeyName = "Shell"
		$Path = "HKCR:\SystemFileAssociations\.txt\Shell"
		if (-not(Test-Path -Path $Path)) {
			$null = New-Item -Path $KeyPath -Name $KeyName
		}
	*/

	// KeyPath and KeyName are used to create the they registry key.
	/*
		$KeyPath = "HKCR:\SystemFileAssociations\.txt\Shell"
		$KeyName = "Explorer-Bookmarks"
		$Path = "HKCR:\SystemFileAssociations\.txt\Shell\Explorer-Bookmarks"
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
	*/

	// KeyPath and KeyName are used to create the they registry key.
	/*
		$KeyPath = "HKCR:\SystemFileAssociations\.txt\Shell\Explorer-Bookmarks"
		$KeyName = "Command"
		$Path = "HKCR:\SystemFileAssociations\.txt\Shell\Explorer-Bookmarks\Command"
		$Name = "(Default)"
		// https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_powershell_exe?view=powershell-5.1
		$Value = ("powershell.exe -ExecutionPolicy Bypass -NonInteractive -NoProfile -NoLogo -InputFormat text -OutputFormat text -WindowStyle Hidden -File `"{0}`" `"%1`"" -f $ScriptPath)
		if ("debug" -eq $LogLevel.ToLower()) {
			$Value = ("powershell.exe -ExecutionPolicy Bypass -NoProfile -NoLogo -InputFormat text -OutputFormat text -File `"{0}`" `"%1`"" -f $ScriptPath)
		}
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
	*/
}

function RemoveIntegration() {
	console.info(`Removing the integration from explorer's right-click menu`);
	// HKCR is not mounted by default
	// https://superuser.com/questions/1621508/windows-10-powershell-registry-drives-are-not-working-properly
	/*
		$null = New-PSDrive -Name HKCR -PSProvider Registry -Root HKEY_CLASSES_ROOT

		$Path = "HKCR:\SystemFileAssociations\.txt\Shell\Explorer-Bookmarks\Command"
		if (Test-Path -Path $Path) {
			$null = Remove-Item -Path $Path -Confirm:$false
		}

		$Path = "HKCR:\SystemFileAssociations\.txt\Shell\Explorer-Bookmarks"
		if (Test-Path -Path $Path) {
			$null = Remove-Item -Path $Path -Confirm:$false
		}

		$Path = "HKCR:\SystemFileAssociations\.txt\Shell"
		if (Test-Path -Path $Path) {
			$null = Remove-Item -Path $Path -Confirm:$false
		}
	*/
}

function AddScheduledTask() {
	/*
		if (-not(Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue)) {
			// Create the scheduled task to run when the user logs in.
			Write-Output ("Creating scheduled task to run when the user logs in.")
			$Arguments = ("-ExecutionPolicy Bypass -NonInteractive -NoProfile -NoLogo -InputFormat text -OutputFormat text -WindowStyle Hidden -File `"{0}`" task" -f $ScriptPath)
			$Action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument $Arguments
			$Trigger = New-ScheduledTaskTrigger -AtLogon
			$Principal = New-ScheduledTaskPrincipal -GroupId "BUILTIN\Users"
			$null = Register-ScheduledTask -TaskName $TaskName -Trigger $Trigger -Action $Action -Principal $Principal
		}
	*/
}

function RemoveScheduledTask() {
	/*
		if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
			// Remove the scheduled task to run when the user logs in.
			console.info(`Removing scheduled task that runs when the user logs in`);
			$null = Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
		}
	*/
}

function InstallScript() {
	// Copy the script to the TacticalRMM directory so it can be used outside Tactical.
	/*
		if (-not(Test-Path $ScriptPath)) {
			console.info(`Installing the script for use outside TacticalRMM`);
			Copy-Item -Path $PSCommandPath -Destination $ScriptPath
		}
	*/
}

function UninstallScript() {
	// Remove the script from the TacticalRMM directory.
	/*
		if (Test-Path $ScriptPath) {
			console.info(`Uninstalling the script from the TacticalRMM directory.`)
			Remove-Item -Path $ScriptPath
		}
	*/
}

function OpenExplorerBookmarks(File: string) {
	console.info(`Opening file ${File}`);

	/*
		if (!(Test-Path $File)) {
			Write-Error ("File does not exist: '{0}'" -f $File)
			return $false
		}

		$Size = (Get-Item -Path $File).Length
		if ($RestoreMaxFileSize -le $Size) {
			Write-Error ("File size is too large. File size limit: '{0}'" -f $RestoreMaxFileSize)
			Write-Error ("File path: '{0}'" -f $File)
			Write-Error ("File size: '{0}'" -f $Size)
			return $false
		}

		$Bookmarks = Get-Content -Path $File
		if ($RestoreMaxWindows -le $Bookmarks.Length) {
			Write-Error ("Number of explorer windows to restore is too large. Restore limit: '{0}'" -f $RestoreMaxWindows)
			Write-Error ("File path: '{0}'" -f $File)
			Write-Error ("Number of Explorer windows to restore: '{0}'" -f $Bookmarks.Length)
			return $false
		}

		$PrevFile = $null
		ForEach ($Bookmark in $Bookmarks) {
			$Bookmark = $Bookmark.Trim()
			if (Test-Path -Path $Bookmark -PathType Container) {
				if ($PrevFile -ne $Bookmark) {
					Write-Output ("Opening Explorer to '{0}'" -f $Bookmark)
				# More command line switches:
						# https://superuser.com/questions/21394/explorer-command-line-switches
						& "$ENV:SystemRoot\explorer.exe" "$Bookmark"
					Start-Sleep -Seconds $RestoreDelaySeconds
				# Don't open the same window multiple times if they are next to each other.
				# The window will be opened if they are not next to each other.
						$PrevFile = $Bookmark
				}
			}
		}
	*/
}

/**
 * Helper function to test if exec() response is an instance of IExecResponse.
 * @param obj Object to test.
 */
// deno-lint-ignore no-explicit-any
function instanceOfIExecResponse(obj: any): obj is IExecResponse {
	return ("status" in obj) && ("output" in obj);
}

/**
 * TestIsAdmin will return true if the current user is an administrator.
 * For Windows:
 *   "Mandatory Label\High Mandatory Level" is when the script is run from an elevated session.
 *   "Mandatory Label\System Mandatory Level" is when the script is run from SYSTEM.
 * @constructor
 */
function TestIsAdmin() {
	if (Deno.build.os === "windows") {
		const cmd = `C:/Windows/System32/whoami.exe /groups`;
		exec(cmd, {output: OutputMode.Capture})
			.catch(err => {
				console.error(`Error executing command '${cmd}':`, err);
				throw err;
			})
			.then(response => {
				if (instanceOfIExecResponse(response)) {
					console.debug(`whoAmI output: '${response.output}'`);
					console.debug(`whoAmI status: '${response.status.success}'`);
					console.debug(`whoAmI response:`, response);
					if (response.output.includes("Mandatory Label\\High Mandatory Level") ||
						response.output.includes("Mandatory Label\\System Mandatory Level")) {
						return true;
					}
				}
			});
	} else {
		const cmd = `/usr/bin/whoami`;
		exec(cmd, {output: OutputMode.Capture})
			.catch(err => {
				console.error(`Error executing command '${cmd}':`, err);
				throw err;
			})
			.then(response => {
				if (instanceOfIExecResponse(response)) {
					console.debug(`whoAmI output: '${response.output}'`);
					console.debug(`whoAmI status: '${response.status.success}'`);
					console.debug(`whoAmI response:`, response);
					if (response.output.includes("root")) {
						return true;
					}
				}
			});
	}
	return false;
}

/**
 * TestIsInterativeShell will return true if the program is being run interactively.
 * For Linux/macOS:
 *   This checks if stdin is a terminal.
 * For Windows:
 *   This checks if PowerShell was run with the -NonInteractive switch.
 *   @See https://stackoverflow.com/questions/9738535/powershell-test-for-noninteractive-mode
 * @constructor
 */
function TestIsInteractiveShell() {
	if (Deno.build.os === "windows") {
		// Test each Arg for match of abbreviated '-NonInteractive' command.
		/*
		$NonInteractive = [Environment]::GetCommandLineArgs() | Where - Object
		{
			$_ - like
			'-NonI*'
		}

		if ([Environment]::UserInteractive - and - not$NonInteractive) {
			// We are in an interactive shell.
			return $true
		}
		*/
		return false;
	} else {
		return Deno.isatty(Deno.stdin.rid);
	}
}

/**
 * GetHelp will print the help message.
 * @constructor
 */
function GetHelp() {
	console.log(`explorer-bookmarks.ps1
	Bookmark the Windows Explorer paths in a file.

explorer-bookmarks.ps1 <file>
	Load the bookmarks from a file. This is usually done from a right-click menu.

explorer-bookmarks.ps1 task
	This command is run from the scheduled task to restore the last bookmarks saved.

explorer-bookmarks.ps1 <install | uninstall | reinstall>
	Install/uninstall/reinstall the integration: Script, right click menu and scheduled task.

Environmental variables:

	EB_BOOKMARKS_DIR - Directory to save the explorer bookmark files.
	EB_MAX_NUM_FILES - Maximum number of bookmark files to save.
	EB_FILENAME_PREFIX - Filename prefix to use for the bookmark files.
	EB_RESTORE_MAX_FILE_SIZE - Maximum file size to restore.
	EB_RESTORE_MAX_WINDOWS - Maximum number of windows to restore.
	  Note: This counts the lines in the file, not actual windows.
	EB_RESTORE_DELAY_SECONDS - Delay in seconds between opening each window.
	EB_SCRIPT_PATH - Where to install this script for the integration.
	EB_LOG_LEVEL - Set the log level of the script.

	`);
}

if (TestIsAdmin()) {
	console.log(`IsAdmin: True`);
}

if (TestIsInteractiveShell()) {
	console.log(`IsInteractiveShell: True`);
}
