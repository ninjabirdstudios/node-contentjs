/*/////////////////////////////////////////////////////////////////////////////
/// @summary Defines some functions for working with projects, which consist
/// of content processors, packages, database information and a content
/// pipeline definition.
/// @author Russell Klenk (russ@ninjabirdstudios.com)
///////////////////////////////////////////////////////////////////////////80*/
var Filesystem = require('fs');
var Path       = require('path');
var Util       = require('util');
var Events     = require('events');
var Compiler   = require('./compiler');
var Database   = require('./database');
var FSUtil     = require('./fsutility');

/// Loads a content pipeline definition from the filesystem.
/// @param path The path of the file containing the JSON pipeline definition.
/// @return An object representing the pipeline definition.
function loadPipelineDefinition(path)
{
    try
    {
        var json = Filesystem.readFileSync(path, 'utf8');
        return JSON.parse(json);
    }
    catch (err)
    {
        // return an empty object.
        return {};
    }
}

/// Saves a content pipeline definition to the filesystem.
/// @param path The path to which the JSON pipeline definition will be written.
/// @param data An object defining the content pipeline configuration.
function savePipelineDefinition(path, data)
{
    try
    {
        var json = JSON.stringify(data, null, '\t');
        Filesystem.writeFileSync(path, json, 'utf8');
    }
    catch (err)
    {
        /* empty */
    }
}

/// Constructor function for the Target type, which represents the output
/// location for content files for a particular target platform. Instances of
/// this type are typically created using Target.create().
/// @return A reference to the new Target instance.
var Target = function ()
{
    if (!(this instanceof Target))
    {
        return new Target();
    }
    this.database     = null; // the in-memory target database
    this.rootPath     = '';   // absolute path of project packages directory
    this.targetPath   = '';   // absolute path of package target content
    this.packageName  = '';   // the name of the parent package
    this.platformName = '';   // the name of the target platform
    this.databasePath = '';   // absolute path of target database file
    return this;
};

/// The name of the generic platform is just an empty string.
Target.GENERIC_PLATFORM    = 'generic';

/// The directory extension used for target packages.
Target.TARGET_EXTENSION    = '.target';

/// The file extension used for target databases.
Target.TARGET_DB_EXTENSION = '.target.json';

/// Loads and caches the data representing the output location and metadata for
/// content files built for a specific target platform.
/// @param args An object specifying information about the environment.
/// @param args.packageName The name of the parent content package.
/// @param args.packageRoot The absolute path of the packages directory.
/// @param args.databaseRoot The absolute path of the database directory.
/// @param args.platformName The name of the target platform.
/// @return A new Target instance. All of the necessary directories and files
/// are created on the filesystem, and any required data has been loaded.
Target.create = function (args)
{
    if (args.platformName.length === 0)
        args.platformName = Target.GENERIC_PLATFORM;

    var dbExtension     = Target.TARGET_DB_EXTENSION;
    var dirExtension    = Target.TARGET_EXTENSION;
    var targetName      = args.packageName + '.' + args.platformName + dirExtension;
    var targetDbName    = args.packageName + '.' + args.platformName + dbExtension;
    var targetPath      = Path.join(args.packageRoot,  targetName);
    var targetDbPath    = Path.join(args.databaseRoot, targetDbName);

    var db              = Database.loadTargetDatabase(targetDbPath);
    db.bundleName       = args.packageName;
    db.platform         = args.platformName;

    var target          = new Target();
    target.database     = db;
    target.rootPath     = args.packageRoot;
    target.targetPath   = targetPath;
    target.packageName  = args.packageName;
    target.platformName = args.platformName;
    target.databasePath = targetDbPath;

    // ensure that the required directories exist:
    FSUtil.makeTree(targetPath);
    return target;
};

/// Constructs the target path associated with a given resource name.
/// @param resourceName The resource name of the content item.
/// @return The absolute path of the target file, without any extension.
Target.prototype.targetPathFor = function (resourceName)
{
    var       ch = 0;
    var     hash = 0; // stb_hash FTW
    resourceName = resourceName || '';
    for (var   i = 0, n = resourceName.length; i < n; ++i)
    {
        ch       = resourceName.charCodeAt(i);
        hash     = (hash << 7) + (hash >> 25) + ch;
    }
    return Path.join(this.targetPath, hash.toString(16));
};

/// Constructor function for the Package type, which represents a logical
/// group of content. Instances of this type are typically created using the
/// Package.create() function.
/// @return A reference to the new Package instance.
var Package = function ()
{
    if (!(this instanceof Package))
    {
        return new Package();
    }
    this.database     = null; // the in-memory source database
    this.databasePath = '';   // absolute path of source database file
    this.databaseRoot = '';   // absolute path of project database directory
    this.packageRoot  = '';   // absolute path of project packages directory
    this.sourcePath   = '';   // absolute path of package source content
    this.projectName  = '';   // the name of the parent project
    this.packageName  = '';   // the name of the content package
    this.targets      = {};   // map target platform name to Target object
    return this;
};

/// The directory extension used for source packages.
Package.SOURCE_EXTENSION    = '.source';

/// The file extension used for source databases.
Package.SOURCE_DB_EXTENSION = '.source.json';

/// Loads and caches the data representing the source location, output
/// locations and metadata for a logical grouping of content.
/// @param args An object specifying information about the environment.
/// @param args.projectName The name of the parent project.
/// @param args.packageName The name of the content package.
/// @param args.packageRoot The absolute path of the packages directory.
/// @param args.databaseRoot The absolute path of the database directory.
/// @return A new Package instance. All of the necessary directories and files
/// are created on the filesystem, and any required data has been loaded.
Package.create = function (args)
{
    var dbExtension     = Package.SOURCE_DB_EXTENSION;
    var dirExtension    = Package.SOURCE_EXTENSION;
    var sourceName      = args.packageName + dirExtension;
    var sourceDbName    = args.packageName + dbExtension;
    var sourcePath      = Path.join(args.packageRoot,  sourceName);
    var sourceDbPath    = Path.join(args.databaseRoot, sourceDbName);

    var db              = Database.loadSourceDatabase(sourceDbPath);
    db.bundleName       = args.packageName;

    var bundle          = new Package();
    bundle.database     = db;
    bundle.databasePath = sourceDbPath;
    bundle.databaseRoot = args.databaseRoot;
    bundle.packageRoot  = args.packageRoot;
    bundle.sourcePath   = sourcePath;
    bundle.projectName  = args.projectName;
    bundle.packageName  = args.packageName;

    // ensure that the required directories exist:
    FSUtil.makeTree(sourcePath);
    return bundle;
};

/// Retrieves the data associated with a particular target platform for this
/// content package. The target platform record is created if it doesn't exist.
/// @param platformName The name of the target platform.
/// @return The Target record for the specified platform name.
Package.prototype.targetPlatform = function (platformName)
{
    // map an empty string to the generic platform.
    if (platformName.length === 0)
        platformName = Target.GENERIC_PLATFORM;

    // return the existing target, if it exists.
    var target   = this.targets[platformName];
    if (target !== undefined)
        return target;

    // the target doesn't exist, so create it.
    target = Target.create({
        packageName  : this.packageName,
        packageRoot  : this.packageRoot,
        databaseRoot : this.databaseRoot,
        platformName : platformName
    });
    this.targets[platformName] = target;
    return target;
};

/// Scans the filesystem and creates Target platform records for any target
/// directories it finds belonging to the content package.
/// @return The Package instance.
Package.prototype.cacheTargets = function ()
{
    var self       = this;
    var checkEntry = function (entry)
        {
            if (entry.stat.isDirectory())
            {
                var ext   = Path.extname(entry.name);
                if (ext === Target.TARGET_EXTENSION)
                {
                    var p = Target.GENERIC_PLATFORM;        // platform name
                    var b = Path.basename(entry.name, ext); // chop '.target'
                    var x = b.lastIndexOf('.');
                    if (x > 0)
                    {
                        p = b.substring(x + 1);             // platform name
                        b = b.substring(0,  x);             // package name
                    }
                    if (b === self.packageName)
                    {
                        self.targetPlatform(p);             // cache Target
                    }
                }
            }
        };
    FSUtil.walkTree(checkEntry, {
        from        : this.packageRoot,
        recursive   : false,
        ignoreHidden: true
    });
    return self;
};

/// Constructor function for the Project type, which stores paths associated
/// a content project on the filesystem. Instances of this type are typically
/// created using the Project.create() function.
/// @return The new Project instance.
var Project = function ()
{
    if (!(this instanceof Project))
    {
        return new Project();
    }
    this.projectName   = ''; // the name of the project
    this.rootPath      = ''; // absolute path of the whole project
    this.packageRoot   = ''; // absolute path of project content directory
    this.databaseRoot  = ''; // absolute path of project database directory
    this.processorRoot = ''; // absolute path of project processors directory
    this.pipelinePath  = ''; // absolute path of pipeline definition file
    this.pipeline      = {}; // map resource type => compiler source object
    this.packages      = {}; // map package name => Package instance
    return this;
};

/// A string specifying the name of the root directory for content processors.
Project.PROCESSORS_DIRECTORY = 'processors';

/// A string specifying the name of the root directory for content packages.
Project.PACKAGES_DIRECTORY   = 'packages';

/// A string specifying the name of the root directory for database files.
Project.DATABASE_DIRECTORY   = 'database';

/// A string specifying the name of the pipeline configuration file.
Project.PIPELINE_FILE        = 'pipeline.json';

/// Loads and caches the data associated with a content project, which acts as
/// a container for content packages.
/// @param args An object specifying information about the environment.
/// @param args.projectName The name of the parent project.
/// @param args.projectRoot The absolute path of the directory in which the
/// project will be created.
/// @return A new Project instance. All of the necessary directories and files
/// are created on the filesystem, and any required data has been loaded.
Project.create = function (args)
{
    args             = args || {
        projectName  : 'unnamed',
        projectRoot  : process.cwd()
    };
    args.projectName = args.projectName || 'unnamed';
    args.projectRoot = Path.resolve(args.projectRoot || process.cwd());

    var rootPath     = Path.join(args.projectRoot, args.projectName);
    var procPath     = Path.join(rootPath, Project.PROCESSORS_DIRECTORY);
    var packPath     = Path.join(rootPath, Project.PACKAGES_DIRECTORY);
    var dataPath     = Path.join(rootPath, Project.DATABASE_DIRECTORY);
    var pipePath     = Path.join(rootPath, Project.PIPELINE_FILE);

    // ensure that the required directories exist:
    FSUtil.makeTree(rootPath);
    FSUtil.makeTree(dataPath);
    FSUtil.makeTree(procPath);
    FSUtil.makeTree(packPath);

    var project           = new Project();
    project.projectName   = args.projectName;
    project.rootPath      = rootPath;
    project.packageRoot   = packPath;
    project.databaseRoot  = dataPath;
    project.processorRoot = procPath;
    project.pipelinePath  = pipePath;
    project.pipeline      = loadPipelineDefinition(pipePath);
    return project;
};

/// Retrieves the data associated with a particular content package for this
/// project. The content package record is created if it doesn't exist.
/// @param packageName The name of the content package.
/// @return The Package record representing the specified content package.
Project.prototype.contentPackage = function (packageName)
{
    // return the existing package, if it exists.
    var bundle   = this.packages[packageName];
    if (bundle !== undefined)
        return bundle;

    // the package doesn't exist, so create it.
    bundle = Package.create({
        projectName  : this.projectName,
        packageName  : packageName,
        packageRoot  : this.packageRoot,
        databaseRoot : this.databaseRoot
    });
    this.packages[packageName] = bundle;
    return bundle;
};

/// Scans the filesystem and creates Package records for any source content
/// directories it finds belonging to the content project.
/// @return The Project instance.
Project.prototype.cachePackages = function ()
{
    var self       = this;
    var checkEntry = function (entry)
        {
            if (entry.stat.isDirectory())
            {
                var ext   = Path.extname(entry.name);
                if (ext === Package.SOURCE_EXTENSION)
                {
                    var n = Path.basename(entry.name, ext); // chop '.source'
                    var p = self.contentPackage(n);         // cache Package
                    p.cacheTargets();                       // cache Targets
                }
            }
        };
    FSUtil.walkTree(checkEntry, {
        from        : this.packageRoot,
        recursive   : false,
        ignoreHidden: true
    });
    return self;
};

/// Creates or loads a content project from disk.
/// @param projectName The name of the content project.
/// @param projectRoot The absolute path where the project will be created.
function createProject(projectName, projectRoot)
{
    return Project.create({
        projectRoot : projectRoot,
        projectName : projectName
    });
}

/// Constructor function for a type that implements the build process for all
/// packages in a project.
/// @return A reference to the new Builder instance.
var Builder = function ()
{
    if (!(this instanceof Builder))
    {
        return new Builder();
    }
    this.project         = null;
    this.compilers       = null;
    this.platforms       = [];
    this.pendingPackages = 0;
    return this;
};
Util.inherits(Builder, Events.EventEmitter);

/// Given a set of properties associated with a resource, determine the one
/// identifying the target platform.
/// @param props An array of strings representing the properties associated
/// with the resource.
/// @return A string representing the target platform name as found in the
/// resource properties. If the resource properties do not specify a target
/// platform, an empty string is returned.
Builder.prototype.determinePlatform = function (props)
{
    var  plats = this.platforms;
    var  count = plats.length;
    for (var i = 0, n = props.length; i < n; ++i)
    {
        var propValue = props[i];
        for (var j = 0; j < count; ++j)
        {
            if (propValue === plats[j])
                return propValue;
        }
    }
    return Target.GENERIC_PLATFORM;
};

/// Performs a quick check to determine if a source file has been modified by
/// checking the modification time and file size.
/// @param entry The source database entry representing the last-known
/// information about the source file.
/// @param stat A fs.Stats instance specifying information  about the current
/// state of the source file.
/// @return true if the source file has been modified.
Builder.prototype.sourceFileModified = function (entry, stat)
{
    var tmp   = entry.writeTime.getTime();
    var tmc   = stat.mtime.getTime();
    if (tmc !== tmp) return true;
    var szp   = entry.fileSize;
    var szc   = stat.size;
    if (szc !== szp) return true;
    return false;
};

/// Determines whether any of the dependencies of a given source file have been
/// modified by examining modification time and file size.
/// @param bundle The Package instance representing the content bundle.
/// @param entry The source database entry to check.
/// @return true if any source files in the dependency chain are modified.
Builder.prototype.dependenciesModified = function (bundle, entry)
{
    try
    {
        // check the source file represented by entry to see if it is modified.
        var db     = bundle.database;
        var abs    = Path.join(bundle.sourcePath, entry.relativePath);
        var stat   = Filesystem.statSync(abs);
        if (this.sourceFileModified(entry, stat))
            return true;

        // now check all of the dependencies to see if they've been modified.
        var refs   = entry.dependencies;
        for (var i = 0, n = refs.length; i < n; ++i)
        {
            var  r = db.query(bundle.sourcePath, refs[i]);
            if (!r || r.dependenciesModified(bundle, r))
                return true;
        }
        return false;
    }
    catch (err)
    {
        // the file doesn't exist, isn't accessible, etc.
        return true;
    }
};

/// Determines whether the build outputs for a given target resource exist on
/// the filesystem.
/// @param target The Target instance representing the target platform.
/// @param targetPath The absolute path of the target resource.
/// @return true if all build outputs exist.
Builder.prototype.buildOutputsExist = function (target, targetPath)
{
    var db    = target.database;
    var entry = db.query(target.targetPath, targetPath);
    if (entry)
    {
        var r = true;
        var o = entry.outputs;
        var n = o.length;
        for (var i = 0; i < n; ++i)
        {
            if (!FSUtil.isFile(o[i]))
            {
                r = false; // this file doesn't exist.
                break;
            }
        }
        return r; // will be true if no outputs or all outputs exist.
    }
    else
    {
        // the target resource is unknown.
        // the source file may not have any data compiler.
        return true;
    }
};

/// Checks a given resource to determine whether it needs to be rebuilt.
/// @param bundle The Package instance representing the content bundle.
/// @param target The Target instance representing the target platform.
/// @param targetPath The absolute path of the target resource.
/// @param entry The source database entry representing the item to check.
/// @return true if the specified source file must be rebuilt.
Builder.prototype.requiresRebuild = function (bundle, target, targetPath, entry)
{
    if (this.dependenciesModified(bundle, entry))
        return true; // something in the dependency tree was modified
    if (this.buildOutputsExist(target, targetPath) === false)
        return true; // one or more build outputs missing
    return false;    // everything seems up-to-date
};

/// Callback invoked when the CompilerCache emits a 'started' event to signal
/// that a file build has been submitted to a data compiler.
/// @param compilers The CompilerCache instance that raised the event.
/// @param request Information about the source file being built.
/// @param request.input An object describing the input parameters.
/// @param request.input.bundle The Package instance for the content bundle.
/// @param request.input.target The Target instance for the target platform.
/// @param request.input.sourcePath The absolute path of the source file.
/// @param request.input.targetPath The absolute path of the target resource.
/// @param request.input.resourceName The unique name of the resource.
/// @param request.input.resourceType The resource type string.
/// @param request.input.platform The value of the resource platform property.
/// @param request.targetPath The absolute path of the target resource.
/// @param request.compilerName The name of the data compiler.
Builder.prototype.handleBuildFileStarted = function (compilers, request)
{
    this.emit('file:started', this, {
        projectName    : this.project.projectName,
        packageName    : request.input.bundle.packageName,
        sourcePath     : request.input.sourcePath,
        targetPath     : request.input.targetPath,
        compilerName   : request.compilerName
    });
};

/// Callback invoked when the CompilerCache emits a 'skipped' event to signal
/// that it skipped building a source file, typically because no data compiler
/// exists for the file's resource type.
/// @param compilers The CompilerCache instance that raised the event.
/// @param result An object describing the result of the build operation.
/// @param result.input An object describing the input parameters.
/// @param result.input.bundle The Package instance for the content bundle.
/// @param result.input.target The Target instance for the target platform.
/// @param result.input.sourcePath The absolute path of the source file.
/// @param result.input.targetPath The absolute path of the target resource.
/// @param result.input.resourceName The unique name of the resource.
/// @param result.input.resourceType The resource type string.
/// @param result.input.platform The value of the resource platform property.
/// @param result.targetPath The absolute path of the target resource.
/// @param result.reason A string describing the reason the build was skipped.
Builder.prototype.handleBuildFileSkipped = function (compilers, result)
{
    var project = this.project;
    var bundle  = result.input.bundle;
    var target  = result.input.target;
    this.emit('file:skipped', this, {
        projectName    : project.projectName,
        packageName    : bundle.packageName,
        sourcePath     : result.input.sourcePath,
        targetPath     : result.input.targetPath,
        reason         : result.reason
    });
    bundle.pendingFiles--;
    if (this.checkPackageComplete(bundle, target))
        this.completePackageBuild(bundle, target);
};

/// Callback invoked when the CompilerCache emits a 'complete' event to signal
/// that the data compiler has finished executing the build for a given source
/// content item.
/// @param compilers The CompilerCache instance that raised the event.
/// @param result An object describing the result of the build operation.
/// @param result.input An object describing the input parameters.
/// @param result.input.bundle The Package instance for the content bundle.
/// @param result.input.target The Target instance for the target platform.
/// @param result.input.sourcePath The absolute path of the source file.
/// @param result.input.targetPath The absolute path of the target resource.
/// @param result.input.resourceName The unique name of the resource.
/// @param result.input.resourceType The resource type string.
/// @param result.input.platform The value of the resource platform property.
/// @param result.compilerName The name of the data compiler.
/// @param result.compilerVersion The data compiler version.
/// @param result.targetPath The absolute path of the target resource.
/// @param result.success A boolean indicating whether the build was a success.
/// @param result.errors An array of string error messages.
/// @param result.outputs An array of absolute paths of build output files.
/// @param result.references An array of absolute paths of referenced files.
Builder.prototype.handleBuildFileComplete = function (compilers, result)
{
    var bundle     = result.input.bundle;
    var target     = result.input.target;
    var sourcePath = result.input.sourcePath;
    var targetPath = result.input.targetPath;
    var tdb        = target.database;
    var sdb        = bundle.database;

    if (result.success)
    {
        // create a source database entry for each referenced file (input),
        // and add the referenced file as a dependency of the source file.
        var srcEnt = sdb.query(bundle.sourcePath, sourcePath);
        var refs   = result.references;
        for (var i = 0, n = refs.length; i < n; ++i)
        {
            var re = sdb.query(bundle.sourcePath, refs[i]);
            if (re === undefined)
            {
                re = sdb.create(bundle.sourcePath, refs[i]);
                re.platform = this.determinePlatform(re.properties);
                re.references.push(sourcePath);
            }
            srcEnt.dependencies.push(refs[i]);
        }

        // create a target database entry to represent the build outputs, and
        // add all of the output file paths to the new entry.
        var tgtEnt = tdb.create(
            target.targetPath,
            sourcePath,
            targetPath,
            result.compilerName,
            result.compilerVersion);
        var outs   = result.outputs;
        for (var i = 0, n = outs.length; i < n; ++i)
        {
            tgtEnt.outputs.push(outs[i]);
        }

        // emit the 'success' event to report build status information.
        this.emit('file:success', this, {
            projectName  : this.project.projectName,
            packageName  : bundle.packageName,
            sourcePath   : sourcePath,
            targetPath   : targetPath,
            compilerName : result.compilerName,
            outputs      : result.outputs
        });
    }
    else
    {
        // emit the 'error' event to report build status information.
        bundle.errorCount++;
        this.emit('file:error', this, {
            projectName  : this.project.projectName,
            packageName  : bundle.packageName,
            sourcePath   : sourcePath,
            targetPath   : targetPath,
            compilerName : result.compilerName,
            errors       : result.errors
        });
    }

    bundle.pendingFiles--;
    if (this.checkPackageComplete(bundle, target))
        this.completePackageBuild(bundle, target);
};

/// Callback invoked when all compiler processes for the content pipeline have
/// been spawned and are ready to begin accepting work. This is where we submit
/// all content packages to be built.
/// @param compilers The CompilerCache that raised the event.
Builder.prototype.handleCompilersReady = function (compilers)
{
    var project   = this.project;
    var keys      = Object.keys(project.packages);
    this.pendingPackages = keys.length;
    for (var    i = 0, n = keys.length; i < n; ++i)
    {
        this.buildPackage(keys[i]);
    }
    if (0 == keys.length)
    {
        // there aren't any packages defined, so complete immediately.
        this.completeProjectBuild(project);
    }
};

/// Callback invoked when all compiler processes for the content pipeline have
/// been fully terminated.
/// @param compilers The CompilerCache that raised the event.
Builder.prototype.handleCompilersTerminated = function (compilers)
{
    /* empty */
};

/// Checks to determine whether the build of a given content package is done.
/// @param bundle The Package representing the content bundle to check.
/// @return true if the specified content package has finished building.
Builder.prototype.checkPackageComplete = function (bundle)
{
    return (bundle.submitComplete && 0 === bundle.pendingFiles);
};

/// Checks to determine whether the project has finished building.
/// @param project The Project representing the content project to check.
/// @return true if the specified content project has finished building.
Builder.prototype.checkProjectComplete = function (project)
{
    return (0 === this.pendingPackages);
};

/// An internal function used to indicate the start of the build process for a
/// content package.
/// @param bundle The Package instance representing the content bundle.
/// @param target The Target instance representing the target platform.
Builder.prototype.startPackageBuild = function (bundle, target)
{
    bundle.submitComplete = false;
    bundle.pendingFiles   = 0;
    bundle.errorCount     = 0;
    this.emit('package:started', this, {
        projectName       : this.project.projectName,
        packageName       : bundle.packageName,
        sourcePath        : bundle.sourcePath,
        targetPath        : target.targetPath,
        platform          : target.platformName
    });
};

/// An internal function used to signal that the build process for a content
/// package has completed.
/// @param bundle The Package instance representing the content bundle.
/// @param target The Target instance representing the target platform.
Builder.prototype.completePackageBuild = function (bundle, target)
{
    if (bundle.database.dirty)
    {
        bundle.database.save(bundle.databasePath);
    }
    if (target.database.dirty)
    {
        target.database.save(target.databasePath);
    }
    var project           = this.project;
    bundle.submitComplete = true;
    bundle.pendingFiles   = 0;
    this.emit('package:complete', this, {
        projectName       : project.projectName,
        packageName       : bundle.packageName,
        sourcePath        : bundle.sourcePath,
        targetPath        : target.targetPath,
        platform          : target.platformName,
        errorCount        : bundle.errorCount
    });
    bundle.errorCount     = 0;
    this.pendingPackages--;
    if (this.checkProjectComplete(project))
        this.completeProjectBuild(project);
};

/// An internal function used to signal that all packages within a content
/// project have been built.
/// @param project The Project representing the content project that was built.
Builder.prototype.completeProjectBuild = function (project)
{
    this.compilers.shutdown();
    this.emit('project:complete', this, project);
};

/// Starts building all content packages defined in a project.
/// @param project The Project instance representing the project to build.
/// @param targetPlatform The name of the target platform.
Builder.prototype.buildProject = function (project, targetPlatform)
{
    var self       = this;
    var procRoot   = project.processorRoot;
    var pipeline   = project.pipeline;
    this.project   = project;
    this.platform  = targetPlatform || '';
    this.compilers = Compiler.createCompilerCache(procRoot, pipeline);
    this.compilers.on('ready',      this.handleCompilersReady.bind(this));
    this.compilers.on('started',    this.handleBuildFileStarted.bind(this));
    this.compilers.on('skipped',    this.handleBuildFileSkipped.bind(this));
    this.compilers.on('complete',   this.handleBuildFileComplete.bind(this));
    this.compilers.on('terminated', this.handleCompilersTerminated.bind(this));
};

/// Builds a specific content package under the current project.
/// @param packageName The name of the content package to build.
Builder.prototype.buildPackage = function (packageName)
{
    var self       = this;
    var platform   = this.platform;
    var project    = this.project;
    var bundle     = project.contentPackage(packageName);
    var target     = bundle.targetPlatform(platform);
    var sourceDb   = bundle.database;
    var targetDb   = target.database;
    var checkEntry = function (entry)
        {
            // skip checking any directories, etc.
            if (!entry.stat.isFile()) return;

            // determine whether this source file requires a rebuild.
            var rebuild  = true;
            var pkgRoot  = bundle.sourcePath;
            var srcPath  = entry.absolutePath;
            var srcEntry = sourceDb.query(pkgRoot, srcPath);
            if (srcEntry)
            {
                // check to see if the source file has been modified.
                rebuild  = self.requiresRebuild(
                    bundle,
                    target,
                    target.targetPathFor(srcEntry.resourceName),
                    srcEntry);
            }

            // rebuild the file if it was actually required.
            if (rebuild)
            {
                // submit the build request. the build may not be
                // started immediately if the data compiler is busy.
                self.buildFile(srcPath, bundle, target);
            }
            else
            {
                // no rebuild was required. note that in this case,
                // the source database entry will be non-null.
                self.emit('file:skipped', self, {
                    projectName : self.project.projectName,
                    packageName : bundle.packageName,
                    sourcePath  : srcPath,
                    targetPath  : target.targetPathFor(srcEntry.resourceName),
                    reason      : 'File is up-to-date'
                });
            }
        };

    // reset the build status for the content bundle:
    this.startPackageBuild(bundle, target);

    // walk the filesystem tree. this is a synchronous operation.
    FSUtil.walkTree(checkEntry, {
        from         : bundle.sourcePath,
        recursive    : true,
        ignoreHidden : true
    });

    // mark the build submission as complete.
    bundle.submitComplete = true;
    if (this.checkPackageComplete(bundle))
        this.completePackageBuild(bundle, target);
};

/// Starts the build process for a given source file.
/// @param absolutePath The absolute path of the source file.
/// @param bundle The Package object representing the content bundle.
/// @param target The Target object representing the target platform.
Builder.prototype.buildFile = function (absolutePath, bundle, target)
{
    var db              = bundle.database;
    var rootPath        = bundle.sourcePath;
    var sourcePath      = absolutePath;
    var srcDbEntry      = db.create(rootPath, sourcePath);
    var targetPath      = target.targetPathFor(srcDbEntry.resourceName);
    var platform        = this.determinePlatform(srcDbEntry.properties);
    var compilers       = this.compilers;
    srcDbEntry.platform = platform;
    if (target.platformName !== platform)
    {
        this.emit('file:skipped', this, {
            projectName : this.project.projectName,
            packageName : bundle.packageName,
            sourcePath  : sourcePath,
            targetPath  : targetPath,
            reason      : 'Source file doesn\'t match target platform'
        });
        return;
    }
    bundle.pendingFiles++;
    compilers.build(targetPath, {
        bundle          : bundle,
        target          : target,
        sourcePath      : sourcePath,
        targetPath      : targetPath,
        resourceName    : srcDbEntry.resourceName,
        resourceType    : srcDbEntry.resourceType,
        platform        : srcDbEntry.platform
    });
};

/// Creates a new content Builder instance.
/// @return The new Builder instance.
function createBuilder()
{
    return new Builder();
}

/// Export public symbols from the module.
module.exports.Builder                = Builder;
module.exports.Project                = Project;
module.exports.Package                = Package;
module.exports.Target                 = Target;
module.exports.createProject          = createProject;
module.exports.createBuilder          = createBuilder;
module.exports.loadPipelineDefinition = loadPipelineDefinition;
module.exports.savePipelineDefinition = savePipelineDefinition;
