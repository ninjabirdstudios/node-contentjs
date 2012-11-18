/*/////////////////////////////////////////////////////////////////////////////
/// @summary Implements a test of the FSWatcher functionality.
/// @author Russell Klenk (russ@ninjabirdstudios.com)
///////////////////////////////////////////////////////////////////////////80*/
var ContentJS    = require('../index');
var Filesystem   = require('fs');
var Path         = require('path');

var basePath     =(process.argv.length > 2 ? process.argv[2] : process.cwd());
var watchPath    = Path.resolve(basePath);
var watcher      = new ContentJS.FSWatcher({
    from         : watchPath,
    interval     : 1000,
    recursive    : true,
    ignoreHidden : true
});

watcher.on('remove', function (w, ent)
    {
        console.log('Entry '+ent.path+' has been deleted.');
    });
watcher.on('create', function (w, ent)
    {
        console.log('Entry '+ent.path+' has been created.');
    });
watcher.on('change', function (w, obj)
    {
        console.log('Entry '+obj.curr.path+' has been modified.');
    });
process.on('SIGINT', function ()
    {
        console.log('Stopping watcher...');
        watcher.stop();
    });

console.log('Monitoring '+watchPath+'...');
watcher.start();
