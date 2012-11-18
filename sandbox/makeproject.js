/*/////////////////////////////////////////////////////////////////////////////
/// @summary Implements a test of the project creation functionality.
/// @author Russell Klenk (russ@ninjabirdstudios.com)
///////////////////////////////////////////////////////////////////////////80*/
var ContentJS    = require('../index');
var Filesystem   = require('fs');
var Path         = require('path');

var basePath     =(process.argv.length > 2 ? process.argv[2] : process.cwd());
var projName     =(process.argv.length > 3 ? process.argv[3] : 'untitled');
var parentPath   = Path.resolve(basePath);
var project      = ContentJS.Project.create({
    projectRoot  : parentPath,
    projectName  : projName
});

if (Object.keys(project.pipeline).length === 0)
{
    // create the pipeline definition file if it doesn't exist.
    ContentJS.savePipelineDefinition(project.pipelinePath, project.pipeline);
}

console.log('Created or loaded project \''+projName+'\' at:');
console.log('  '+project.rootPath);

project.cachePackages();

console.log('Project information:');
var pkgKeys = Object.keys(project.packages);
for (var i  = 0, np = pkgKeys.length; i < np; ++i)
{
    var pkg = project.contentPackage(pkgKeys[i]);

    console.log('  Package \''+pkg.packageName+'\':');
    console.log('    Source content at:  '+pkg.sourcePath);
    console.log('    Source database at: '+pkg.databasePath);
    console.log('    Targets:');
    var tgtKeys = Object.keys(pkg.targets);
    for (var j  = 0, nt = tgtKeys.length; j < nt; ++j)
    {
        var tgt = pkg.targetPlatform(tgtKeys[j]);
        console.log('      \''+tgt.platformName+'\': ');
        console.log('        Target content at:  '+tgt.targetPath);
        console.log('        Target database at: '+tgt.databasePath);
    }
}
