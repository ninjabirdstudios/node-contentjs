#! /usr/bin/env node
/*/////////////////////////////////////////////////////////////////////////////
/// @summary Copies a single file from one directory to another. Includes the
/// scaffolding to run in persistent mode, where the tool can be controlled via
/// IPC mechanisms.
/// @author Russell Klenk (russ@ninjabirdstudios.com)
///////////////////////////////////////////////////////////////////////////80*/
var Filesystem  = require('fs');
var Path        = require('path');
var Commander   = require('commander');

/// Constants and global values used throughout the application module.
var application = {
    /// The name of the application module.
    NAME              : 'copydc',
    /// The path from which the application was started.
    STARTUP_DIRECTORY : process.cwd(),
    /// An object defining the pre-digested command-line arguments passed to
    /// the application, not including the node or script name values.
    args              : {},
    /// The data compiler version number.
    version           : 1,
    /// A flag indicating whether we're running in persistent mode.
    persistent        : false
};

/// Constants representing the various application exit codes.
var exit_code      = {
    /// The program has exited successfully.
    SUCCESS        : 0,
    /// The program has exited with an unknown error.
    ERROR          : 1,
    /// The program has exited because the source file does not exist.
    FILE_NOT_FOUND : 2
};

/// Defines the various types of IPC messages between the CompilerCache and a
/// data compiler process. This enumeration must be kept in sync with the
/// corresponding version in the data compiler.
var IPCMessageType = {
    /// The CompilerCache is requesting the compiler name and version from the
    /// data compiler process.
    /// Data: none
    VERSION_QUERY  : 0,

    /// The data compiler process is passing compiler version information back
    /// to the requesting CompilerCache.
    /// Data: An object {
    ///     version     : Number
    /// }
    VERSION_DATA   : 1,

    /// The CompilerCache is requesting that a data compiler process a source
    /// file and generate corresponding target file(s).
    /// Data: An object {
    ///     sourcePath  : String,
    ///     targetPath  : String,
    ///     platform    : String
    /// }
    BUILD_REQUEST  : 2,

    /// The data compiler is reporting the results of a build operation back to
    /// the CompilerCache.
    /// Data: An object {
    ///     sourcePath  : String,
    ///     targetPath  : String,
    ///     platform    : String,
    ///     success     : Boolean,
    ///     errors      : Array of String (error and warning messages),
    ///     outputs     : Array of String (absolute paths of target files),
    ///     references  : Array of String (absolute paths of referenced files)
    /// }
    BUILD_RESULT   : 3
};

/// Parses a path string to extract the metadata associated with a resource.
/// @param path The path string to parse. Metadata is extracted from the
/// filename portion of the path.
/// @return An object with 'resourceName', 'resourceType' and 'properties'
/// fields containing the information extracted from the path. The 'properties'
/// field is an array of strings.
function parseResourcePath(path)
{
    var filename     = Path.basename(path || '');
    var lp           = filename.lastIndexOf('.');
    var fp           = filename.indexOf('.');
    var propsstr     =(fp === lp ? '' : filename.substring(fp + 1, lp));
    return {
        resourceName : filename.substring(0,  fp),
        resourceType : filename.substring(lp + 1),
        properties   : propsstr.split('.')
    };
}

/// Constructs the output path for a given resource type.
/// @param args An object specifying the input arguments.
/// @param args.sourcePath The absolute path of the source file.
/// @param args.targetPath The absolute path of the target file, not including
/// the file extension.
/// @param resourceType The resource type or file extension of the output file.
/// @return A string representing the absolute path of the output file.
function makeOutputPath(args, resourceType)
{
    if (application.persistent)
    {
        // running in persistent mode, expect a proper target resource path.
        if (resourceType && resourceType.length > 0)
            return args.targetPath + '.' + resourceType;
        else
            return args.targetPath;
    }
    else
    {
        // not running in persistent mode, expect a fully-specified path.
        return args.targetPath;
    }
}

/// Completes invocation of the build process. If running in persistent mode,
/// the results are returned to the parent process; otherwise, output is
/// printed to stdout/stderr and the process exits.
/// @param input An object specifying the input arguments.
/// @param input.sourcePath The absolute path of the source file.
/// @param input.targetPath The absolute path of the target file, not including
/// the file extension.
/// @param result An object specifying the results of the operation.
/// @param result.success true if the operation was successful.
/// @param result.errors An array of string error and warning messages.
/// @param result.outputs An array of absolute paths of files written.
/// @param result.references An array of absolute paths of referenced files.
function processComplete(input, result)
{
    console.log('Copied '+input.sourcePath+' to '+input.targetPath);
    if (application.persistent)
    {
        // send the BUILD_RESULT message back to the parent process.
        process.send({
            type : IPCMessageType.BUILD_RESULT,
            data : {
                sourcePath  : input.sourcePath,
                targetPath  : input.targetPath,
                platform    : input.platform,
                success     : result.success,
                errors      : result.errors,
                outputs     : result.outputs,
                references  : result.references
            }
        });
    }
    else
    {
        // print and stdout/stderr and exit the application.
        if (result.success)
        {
            console.log('Operation completed successfully.');
            process.exit(exit_code.SUCCESS);
        }
        else
        {
            console.error('Encountered one or more errors:');
            for (var i = 0, n = result.errors.length; i < n; ++i)
            {
                console.error('  Error: '+result.errors[i]);
            }
            process.exit(exit_code.ERROR);
        }
    }
}

/// Implements the primary function of the tool/data compiler.
/// @param args An object specifying the input arguments.
/// @param args.sourcePath The absolute path of the source file.
/// @param args.targetPath The absolute path of the target file, not including
/// the file extension.
function processExecute(args)
{
    try
    {
        // attempt to copy the file.
        var BUFFER_SIZE  = 4096;
        var resourceInfo = parseResourcePath(args.sourcePath);
        var outputPath   = makeOutputPath(args, resourceInfo.resourceType);
        var buffer       = new Buffer(BUFFER_SIZE);
        var fdRd         = Filesystem.openSync(args.sourcePath, 'r');
        var fdWr         = Filesystem.openSync(outputPath, 'w');
        var num          = 1;
        var pos          = 0;

        while (num > 0)
        {
            num    = Filesystem.readSync(fdRd, buffer, 0, BUFFER_SIZE, pos);
            Filesystem.writeSync(fdWr, buffer, 0, num);
            pos   += num;
        }

        Filesystem.closeSync(fdWr);
        Filesystem.closeSync(fdRd);
        processComplete(args, {
            success   : true,
            errors    : [],
            outputs   : [outputPath],
            references: []
        });
    }
    catch (error)
    {
        // complete with an error.
        processComplete(args, {
            success   : false,
            errors    : [error.toString()],
            outputs   : [],
            references: []
        });
    }
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
        .option('-P, --persistent',  'Start in persistent mode.', Boolean, false)
        .option('-i, --input [path]',  'Specify the source file.', String)
        .option('-o, --output [path]', 'Specify the destination path.', String)
        .parse(process.argv);

    // if not running in persistent mode:
    // both the input path and the output path must be specified.
    // the file specified by the input path must exist.
    if (!Commander.persistent)
    {
        if (!Commander.input || !Commander.output)
        {
            console.error('ERROR: Both --input and --output must be specified.');
            process.exit(exit_code.ERROR);
        }
        Commander.input  = Path.resolve(Commander.input);
        Commander.output = Path.resolve(Commander.output);
        if (!Filesystem.existsSync(Commander.input))
        {
            console.error('ERROR: The file specified by --input does not exist.');
            process.exit(exit_code.ERROR);
        }
    }

    // return an object containing our final configuration options:
    return {
        sourcePath : Commander.input,
        targetPath : Commander.output,
        persistent : Commander.persistent
    };
}

/// Cleans up any resources allocated for the lifetime of the process.
function processShutdown()
{
    // @todo: if your data compiler has any resources that need to
    // be cleaned up during process shutdown, do that work here.
    process.exit(exit_code.SUCCESS);
}

/// Catches any unhandled exceptions that might occur during execution.
/// @param error Information about the error that occurred.
function processUnhandledException(error)
{
    // @todo: if your data compiler has any resources that need to
    // be cleaned up during process shutdown, do that work here.
    console.error('An unhandled exception has occurred:');
    console.error('  Error: '+error);
}

/// Handles an IPC message received from the parent process. This only runs
/// when the data compiler is being run in persistent mode.
/// @param message An object describing the message. This object should have a
/// field 'type', which is one of IPCMessageType, and 'data' which is an object
/// whose fields are message-specific.
function processMessage(message)
{
    var type = message.type;
    var data = message.data;

    switch (type)
    {
        case IPCMessageType.VERSION_QUERY:
            {
                process.send({
                    type : IPCMessageType.VERSION_DATA,
                    data : {
                        version : application.version
                    }
                });
            }
            break;

        case IPCMessageType.BUILD_REQUEST:
            {
                processExecute(data);
            }
            break;
    }
}

/// Attach global event handlers, process command-line arguments and run if
/// we aren't running in persistent mode.
process.on('unhandledException', processUnhandledException);
process.on('SIGINT',             processShutdown);
process.on('SIGTERM',            processShutdown);
process.on('message',            processMessage);
application.args               = processCommandLine();
application.persistent         = application.args.persistent;
if (!application.persistent)
{
    // not running in persistent mode, so kick things off:
    processExecute({
        sourcePath : application.args.sourcePath,
        targetPath : application.args.targetPath
    });
}
