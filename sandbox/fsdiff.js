/*/////////////////////////////////////////////////////////////////////////////
/// @summary Implements a test of the FSDiffer and FSEntry load functionality.
/// @author Russell Klenk (russ@ninjabirdstudios.com)
///////////////////////////////////////////////////////////////////////////80*/
var ContentJS    = require('../index');
var Filesystem   = require('fs');
var Path         = require('path');

var baseScan     =(process.argv.length > 2 ? process.argv[2] : process.cwd());
var baseLoad     =(process.argv.length > 3 ? process.argv[3] : process.cwd());
var scanPath     = Path.resolve(baseScan);
var loadPath     = Path.resolve(baseLoad);
var jsonPath     = Path.join(loadPath, 'fsdump.json');

if (!Filesystem.existsSync(jsonPath))
{
    console.log('File '+jsonPath+' not found; exiting.');
    process.exit(1);
}

console.log('Scanning tree '+scanPath+'...');

var treeDataCurr = ContentJS.FSScanner.scanTree({
    from         : scanPath,
    recursive    : true,
    ignoreHidden : true
});

console.log('Loading JSON from '+jsonPath+'...');

var treeJSON     = Filesystem.readFileSync(jsonPath, 'utf8');
var treeDataPrev = ContentJS.FSEntry.treeFromJSON(treeJSON);

if (treeDataCurr.root !== treeDataPrev.root)
{
    console.log('Trees have different root paths; exiting:');
    console.log('  prev: '+treeDataPrev.root);
    console.log('  curr: '+treeDataCurr.root);
    process.exit(2);
}

console.log('Diffing trees...');

var diffRoot     = treeDataCurr.root;
var diffList     = ContentJS.FSDiffer.diffTree(
    diffRoot,
    treeDataPrev,
    treeDataCurr,
    true);

ContentJS.FSDiffer.dumpDiffs(diffList);
