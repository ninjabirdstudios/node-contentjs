/*/////////////////////////////////////////////////////////////////////////////
/// @summary Exposes the public exports from the /lib modules to define the
/// public package interface.
/// @author Russell Klenk (russ@ninjabirdstudios.com)
///////////////////////////////////////////////////////////////////////////80*/
var FSUtility  = require('./lib/fsutility');
var Compiler   = require('./lib/compiler');
var Database   = require('./lib/database');
var Project    = require('./lib/project');

module.exports.FSEntry                       = FSUtility.FSEntry;
module.exports.FSDiffer                      = FSUtility.FSDiffer;
module.exports.FSScanner                     = FSUtility.FSScanner;
module.exports.FSWatcher                     = FSUtility.FSWatcher;
module.exports.readTree                      = FSUtility.readTree;
module.exports.makeTree                      = FSUtility.makeTree;
module.exports.isFile                        = FSUtility.isFile;
module.exports.isDirectory                   = FSUtility.isDirectory;
module.exports.ensurePathSeparator           = FSUtility.ensurePathSeparator;
module.exports.removePathSeparator           = FSUtility.removePathSeparator;

module.exports.SourceDatabase                = Database.SourceDatabase;
module.exports.TargetDatabase                = Database.TargetDatabase;
module.exports.parseResourcePath             = Database.parseResourcePath;
module.exports.loadSourceDatabase            = Database.loadSourceDatabase;
module.exports.loadTargetDatabase            = Database.loadTargetDatabase;
module.exports.createSourceDatabase          = Database.createSourceDatabase;
module.exports.createTargetDatabase          = Database.createTargetDatabase;

module.exports.CompilerCache                 = Compiler.CompilerCache;
module.exports.createCompilerCache           = Compiler.createCompilerCache;

module.exports.Builder                       = Project.Builder;
module.exports.Project                       = Project.Project;
module.exports.ContentPackage                = Project.Package;
module.exports.TargetPlatform                = Project.Target;
module.exports.createProject                 = Project.createProject;
module.exports.createBuilder                 = Project.createBuilder;
module.exports.loadPipelineDefinition        = Project.loadPipelineDefinition;
module.exports.savePipelineDefinition        = Project.savePipelineDefinition;

