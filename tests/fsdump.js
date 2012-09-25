/*/////////////////////////////////////////////////////////////////////////////
/// @summary Implements a test of the FSScanner and FSEntry dump functionality.
/// @author Russell Klenk (russ@ninjabirdstudios.com)
///////////////////////////////////////////////////////////////////////////80*/
var ContentJS    = require('../index');
var Filesystem   = require('fs');
var Path         = require('path');

var baseScan     =(process.argv.length > 2 ? process.argv[2] : process.cwd());
var baseSave     =(process.argv.length > 3 ? process.argv[3] : process.cwd());
var scanPath     = Path.resolve(baseScan);
var savePath     = Path.resolve(baseSave);

console.log('Scanning tree '+scanPath+'...');

var treeData     = ContentJS.FSScanner.scanTree({
    from         : scanPath,
    recursive    : true,
    ignoreHidden : true
});

console.log('Converting to JSON...');

var treeJSON     = ContentJS.FSEntry.treeToJSON(treeData, '\t');
var jsonPath     = Path.join(savePath, 'fsdump.json');

console.log('Writing to '+jsonPath+'...');
Filesystem.writeFileSync(jsonPath, treeJSON, 'utf8');
