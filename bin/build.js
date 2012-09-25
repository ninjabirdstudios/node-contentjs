#! /usr/bin/env node
/*/////////////////////////////////////////////////////////////////////////////
/// @summary This command-line utility implements the content build process.
/// The tool loads a project from the filesystem, determines changed, added and
/// deleted files, and invokes the necessary data compilers.
/// @author Russell Klenk (russ@ninjabirdstudios.com)
///////////////////////////////////////////////////////////////////////////80*/
var Filesystem  = require('fs');
var Path        = require('path');
var Commander   = require('commander');
var ContentJS   = require('../index');

/// Constants and global values used throughout the application module.
var application = {
    /// The name of the application module.
    NAME              : 'contentjs-build',
    /// The path from which the application was started.
    STARTUP_DIRECTORY : process.cwd(),
    /// An object defining the pre-digested command-line arguments passed to
    /// the application, not including the node or script name values.
    args              : {}
};

/// Constants representing the various application exit codes.
var exit_code   = {
    /// The program has exited successfully.
    SUCCESS     : 0,
    /// The program has exited with an unknown error.
    ERROR       : 1,
    /// The program has exited because the specified project does not exist.
    NO_PROJECT  : 2
};

/// Exits the application with an error.
/// @param exitCode One of the values of the @a exit_code enumeration.
/// @param data Optional additional data associated with the error.
function programError(exitCode, data)
{
    exitCode = exitCode || exit_code.ERROR;
    if (!application.args.silent)
    {
        switch (exitCode)
        {
            case exit_code.ERROR:
                console.error('An unknown error occurred:');
                console.error('  '+data);
                break;

            case exit_code.NO_PROJECT:
                console.error('The project could not be found:');
                console.error('  Path: '+data);
                break;
        }
    }
    process.exit(exitCode);
}

/// Callback invoked when the 'project:complete' event is emitted.
/// @param builder The Builder instance that raised the event.
/// @param project The Project being built.
function projectBuildComplete(builder, project)
{
    console.log('Project build has completed.');
}

/// Callack invoked when the 'package:started' event is emitted.
/// @param builder The Builder instance that raised the event.
/// @param info An object describing the build that was started.
/// @param info.projectName The name of the content project to which the
/// content package belongs.
/// @param info.packageName The name of the content package.
/// @param info.sourcePath The absolute path of the package source content.
/// @param info.targetPath The absolute path of the package target resources.
/// @param info.platform The name of the target platform.
function packageBuildStarted(builder, info)
{
    console.log('Starting build for package '+info.packageName+'...');
}

/// Callback invoked when the 'package:complete' event is emitted.
/// @param builder The Builder instance that raised the event.
/// @param info An object describing the build that completed.
/// @param info.projectName The name of the content project to which the
/// content package belongs.
/// @param info.packageName The name of the content package.
/// @param info.sourcePath The absolute path of the package source content.
/// @param info.targetPath The absolute path of the package target resources.
/// @param info.platform The name of the target platform.
/// @param info.errorCount The number of errors encountered while building the
/// content package.
function packageBuildComplete(builder, info)
{
    console.log('Completed build for package '+info.packageName+'.');
}

/// Callback invoked when the 'file:started' event is emitted.
/// @param builder The Builder instance that raised the event.
/// @param info An object describing the build that was started.
/// @param info.projectName The name of the content project to which the
/// content package belongs.
/// @param info.packageName The name of the content package.
/// @param info.sourcePath The absolute path of the source content file.
/// @param info.targetPath The absolute path of the target resource.
/// @param info.compilerName The name of the data compiler building the file.
function fileBuildStarted(builder, info)
{
    console.log('Started build for file '+info.sourcePath+'...');
}

/// Callback invoked when the 'file:skipped' event is emitted.
/// @param builder The Builder instance that raised the event.
/// @param info An object describing the build that was started.
/// @param info.projectName The name of the content project to which the
/// content package belongs.
/// @param info.packageName The name of the content package.
/// @param info.sourcePath The absolute path of the source content file.
/// @param info.targetPath The absolute path of the target resource.
/// @param info.reason A string specifying the reason the file was skipped.
function fileBuildSkipped(builder, info)
{
    console.log('Skipped build of file '+info.sourcePath+':');
    console.log('  Reason: '+info.reason);
}

/// Callback invoked when the 'file:success' event is emitted.
/// @param builder The Builder instance that raised the event.
/// @param info An object describing the build that was started.
/// @param info.projectName The name of the content project to which the
/// content package belongs.
/// @param info.packageName The name of the content package.
/// @param info.sourcePath The absolute path of the source content file.
/// @param info.targetPath The absolute path of the target resource.
/// @param info.compilerName The name of the data compiler building the file.
/// @param info.outputs An array of absolute paths of the build output files.
function fileBuildSuccess(builder, info)
{
    console.log('Successfully built file '+info.sourcePath+'.');
}

/// Callback invoked when the 'file:error' event is emitted.
/// @param builder The Builder instance that raised the event.
/// @param info An object describing the build that was started.
/// @param info.projectName The name of the content project to which the
/// content package belongs.
/// @param info.packageName The name of the content package.
/// @param info.sourcePath The absolute path of the source content file.
/// @param info.targetPath The absolute path of the target resource.
/// @param info.compilerName The name of the data compiler building the file.
/// @param info.errors An array of string error messages.
function fileBuildError(builder, info)
{
    console.log('Build of file '+info.sourcePath+' encountered errors:');
    for (var i = 0, n = info.errors.length; i < n; ++i)
    {
        console.log('  Error: '+errors[i]);
    }
}

/// Loads a project from disk.
/// @param rootPath The project root directory.
/// @return The Project instance for the specified path.
function loadProject(rootPath)
{
    var resolved = Path.resolve(rootPath || process.cwd());
    var rootDir  = Path.dirname(resolved);
    var projName = Path.basename(resolved);

    // the project must exist, and must specify a directory.
    if (!Filesystem.existsSync(resolved))
    {
        programError(exit_code.NO_PROJECT, resolved);
    }
    if (!Filesystem.statSync(resolved).isDirectory())
    {
        programError(exit_code.NO_PROJECT, resolved);
    }
    console.log('Loading project: ');
    console.log('  From: '+rootDir);
    console.log('  Name: '+projName);
    return ContentJS.createProject(projName, rootDir).cachePackages();
}

/// Builds a content project.
/// @param project The Project instance for the content project to build.
/// @param platform The name of the target platform.
/// @return The Builder instance used to manage the project build process.
function buildProject(project, platform)
{
    var builder = ContentJS.createBuilder();
    builder.on('project:complete', projectBuildComplete);
    builder.on('package:started',  packageBuildStarted);
    builder.on('package:complete', packageBuildComplete);
    builder.on('file:started',     fileBuildStarted);
    builder.on('file:skipped',     fileBuildSkipped);
    builder.on('file:success',     fileBuildSuccess);
    builder.on('file:error',       fileBuildError);
    builder.buildProject(project, platform || '');
    return builder;
}

/// Processes any options specified on the command line. If necessary, help
/// information is displayed and the application exits.
/// @return An object whose properties are the configuration specified by the
/// command-line arguments, with suitable defaults filled in where necessary.
function processCommandLine()
{
    // parse the command line, display help, etc. if the command
    // line is invalid, commander will call process.exit() for us.
    Commander
        .version('1.0.0')
        .option('-s, --silent',  'Run in silent mode (no console output).', Boolean, false)
        .option('-p, --project [path]', 'Specify the path of the project to build.', String)
        .parse(process.argv);

    // return an object containing our final configuration options:
    return {
        silent      : Commander.silent,
        projectRoot : Commander.project
    };
}

///
function programExecute()
{
    var project = loadProject(application.args.projectRoot);
    var builder = buildProject(project);
}

/// Implements the entry point of the application.
function main()
{
    application.args = processCommandLine();
    programExecute();
}

/// Application entry point.
main();
