/*/////////////////////////////////////////////////////////////////////////////
/// @summary Defines functions for working with the content databases that are
/// constructed during content builds and maintain information about asset
/// relationships (dependencies, references, etc.)
/// @author Russell Klenk (russ@ninjabirdstudios.com)
///////////////////////////////////////////////////////////////////////////80*/
var Filesystem = require('fs');
var Path       = require('path');

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

/// Constructor function for the SourceDatabase type, which maintains data
/// about source files referenced by the content.
/// @return A reference to the SourceDatabase instance.
var SourceDatabase = function ()
{
    if (!(this instanceof SourceDatabase))
    {
        return new SourceDatabase();
    }
    this.bundleName = '';
    this.entries    = [];
    this.entryTable = {};
    this.dirty      = false;
    return this;
};

/// Loads data from a file into the database. Any existing data is overwritten.
/// @param path The path of the source database file to load.
/// @return A reference to the SourceDatabase instance.
SourceDatabase.prototype.load = function (path)
{
    var json          = Filesystem.readFileSync(path, 'utf8');
    var data          = JSON.parse(json);
    this.bundleName   = data.bundleName || '';
    this.entries      = data.entries    || [];
    this.entryTable   = {};
    this.dirty        = false;
    for (var i = 0, n = this.entries.length; i < n; ++i)
    {
        var en        = this.entries[i];
        en.writeTime  = new Date(en.writeTime);
        this.entryTable[en.relativePath] = i;
    }
    return this;
};

/// Saves the current database contents to a file and resets the dirty status.
/// @param path The path of the file to which the source database information
/// will be written.
/// @return A reference to the SourceDatabase instance.
SourceDatabase.prototype.save = function (path)
{
    var data        = {
        bundleName  : this.bundleName || '',
        entries     : this.entries    || []
    };
    var json        = JSON.stringify(data, null, '\t');
    Filesystem.writeFileSync(path, json, 'utf8');
    this.dirty      = false;
    return this;
};

/// Queries the SourceDatabase to retrieve the entry representing the specified
/// source file.
/// @param rootPath The absolute path of the project root directory.
/// @param sourcePath The absolute path of the source file.
/// @return An object representing the database entry for the specified source
/// file, or undefined if no entry exists.
SourceDatabase.prototype.query = function (rootPath, sourcePath)
{
    var relPath = Path.relative(rootPath, sourcePath);
    var index   = this.entryTable[relPath];
    if (index !== undefined)
        return this.entries[index];
};

/// Creates a new database entry representing a given source file.
/// @param rootPath The absolute path of the project root directory.
/// @param sourcePath The absolute path of the source file. The file must
/// exist, as the filesystem is accessed to retrieve file information.
/// @return An object representing the database entry for the specified file.
SourceDatabase.prototype.create = function (rootPath, sourcePath)
{
    var stats        = Filesystem.statSync(sourcePath);
    var index        = this.entries.length;
    var parts        = parseResourcePath(sourcePath);
    var entry        = {
        relativePath : Path.relative(rootPath, sourcePath),
        resourceName : parts.resourceName,
        resourceType : parts.resourceType,
        platform     : '',
        properties   : parts.properties,
        references   : [],
        dependencies : [],
        writeTime    : stats.mtime,
        fileSize     : stats.size
    };
    // if there's an existing entry with this relative path,
    // we want to overwrite it instead of duplicate it.
    var existing     = this.entryTable[entry.relativePath];
    if (existing   !== undefined)
    {
        // overwrite the existing entry.
        index = existing;
    }
    // insert the item into the database.
    this.entries[index]                 = entry;
    this.entryTable[entry.relativePath] = index;
    this.dirty                          = true;
    return entry;
};

/// Deletes the database entry representing a given source file.
/// @param rootPath The absolute path of the project root directory.
/// @param sourcePath The absolute path of the source file.
SourceDatabase.prototype.remove = function (rootPath, sourcePath)
{
    var relPath = Path.relative(rootPath, sourcePath);
    var index   = this.entryTable[relPath];
    if (index !== undefined)
    {
        delete this.entryTable[relPath];
        this.entries.slice(index, 1);
        this.dirty = true;
    }
};

/// Constructor function for the TargetDatabase type, which maintains data
/// about target files output by the content pipeline.
/// @return A reference to the TargetDatabase instance.
var TargetDatabase = function ()
{
    if (!(this instanceof TargetDatabase))
    {
        return new TargetDatabase();
    }
    this.bundleName = '';
    this.platform   = '';
    this.entries    = [];
    this.entryTable = {};
    this.dirty      = false;
    return this;
};

/// Loads data from a file into the database. Any existing data is overwritten.
/// @param path The path of the target database file to load.
/// @return A reference to the TargetDatabase instance.
TargetDatabase.prototype.load = function (path)
{
    var json          = Filesystem.readFileSync(path, 'utf8');
    var data          = JSON.parse(json);
    this.bundleName   = data.bundleName || '';
    this.platform     = data.platform   || '';
    this.entries      = data.entries    || [];
    this.entryTable   = {};
    this.dirty        = false;
    for (var i = 0, n = this.entries.length; i < n; ++i)
    {
        var en        = this.entries[i];
        this.entryTable[en.relativePath] = i;
    }
    return this;
};

/// Saves the current database contents to a file and resets the dirty status.
/// @param path The path of the file to which the target database information
/// will be written.
/// @return A reference to the TargetDatabase instance.
TargetDatabase.prototype.save = function (path)
{
    var data        = {
        bundleName  : this.bundleName || '',
        platform    : this.platform   || '',
        entries     : this.entries    || []
    };
    var json        = JSON.stringify(data, null, '\t');
    Filesystem.writeFileSync(path, json, 'utf8');
    this.dirty      = false;
    return this;
};

/// Queries the TargetDatabase to retrieve the entry representing the specified
/// target file.
/// @param rootPath The absolute path of the project root directory.
/// @param sourcePath The absolute path of the target file.
/// @return An object representing the database entry for the specified target
/// file, or undefined if no entry exists.
TargetDatabase.prototype.query = function (rootPath, targetPath)
{
    var relPath = Path.relative(rootPath, targetPath);
    var index   = this.entryTable[relPath];
    if (index !== undefined)
        return this.entries[index];
};
/// Creates a new database entry representing a given target file.
/// @param rootPath The absolute path of the project root directory.
/// @param sourcePath The absolute path of the source file.
/// @param targetPath The absolute path of the target file. The file must
/// exist, as the filesystem is accessed to retrieve file information.
/// @param compilerName The name of the content compiler that generated the
/// target file.
/// @param compilerVersion The version of the content compiler that generated
/// the target file.
/// @return An object representing the database entry for the specified file.
TargetDatabase.prototype.create = function (rootPath, sourcePath, targetPath, compilerName, compilerVersion)
{
    var index        = this.entries.length;
    var parts        = parseResourcePath(sourcePath);
    var entry        = {
        relativePath : Path.relative(rootPath, targetPath),
        resourceName : parts.resourceName,
        resourceType : parts.resourceType,
        sourcePath   : Path.relative(rootPath, sourcePath),
        platform     : this.platform,
        compilerName : compilerName,
        properties   : parts.properties,
        outputs      : []
    };
    // if there's an existing entry with this relative path,
    // we want to overwrite it instead of duplicate it.
    var existing     = this.entryTable[entry.relativePath];
    if (existing   !== undefined)
    {
        // overwrite the existing entry.
        index = existing;
    }
    // insert the item into the database.
    this.entries[index]                 = entry;
    this.entryTable[entry.relativePath] = index;
    this.dirty                          = true;
    return entry;
};

/// Deletes the database entry representing a given target file.
/// @param rootPath The absolute path of the project root directory.
/// @param sourcePath The absolute path of the target file.
TargetDatabase.prototype.remove = function (rootPath, targetPath)
{
    var relPath = Path.relative(rootPath, targetPath);
    var index   = this.entryTable[relPath];
    if (index !== undefined)
    {
        delete this.entryTable[relPath];
        this.entries.slice(index, 1);
        this.dirty = true;
    }
};

/// Attempts to load a source database from a file. Exceptions are not caught.
/// @param path The path of the file to load.
/// @return A reference to the new SourceDatabase containing the data from the
/// specified file.
function loadSourceDatabase(path)
{
    var sourceDb = new SourceDatabase();
    if (Filesystem.existsSync(path))
        sourceDb.load(path);
    else
        sourceDb.dirty = true; // newly created
    return sourceDb;
}

/// Creates a new, empty source database.
/// @return A new SourceDatabase instance.
function createSourceDatabase()
{
    return new SourceDatabase();
}

/// Attempts to load a target database from a file. Exceptions are not caught.
/// @param path The path of the file to load.
/// @return A reference to the new TargetDatabase containing the data from the
/// specified file.
function loadTargetDatabase(path)
{
    var targetDb = new TargetDatabase();
    if (Filesystem.existsSync(path))
        targetDb.load(path);
    else
        targetDb.dirty = true; // newly created
    return targetDb;
}

/// Creates a new, empty target database.
/// @return A new TargetDatabase instance.
function createTargetDatabase()
{
    return new TargetDatabase();
}

/// Export public types and functions from the module.
module.exports.SourceDatabase       = SourceDatabase;
module.exports.TargetDatabase       = TargetDatabase;
module.exports.parseResourcePath    = parseResourcePath;
module.exports.loadSourceDatabase   = loadSourceDatabase;
module.exports.loadTargetDatabase   = loadTargetDatabase;
module.exports.createSourceDatabase = createSourceDatabase;
module.exports.createTargetDatabase = createTargetDatabase;
