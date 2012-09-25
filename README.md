node-contentjs
==============

A streamlined, minimalistic game content pipeline built on Node.js. The library
and tools can be set up to monitor multiple source directory trees for changes,
and on command, execute data compilers for each modified file. The intent is to
provide rapid iteration for game content while minimizing errors that might
result from manually running a series of separate tools.

TODOs
-----

The following items remain TBD or fixed:

 * Need to properly store relative path information when saving out a source
   or target database.
 * Need to restore absolute path information when loading a source or target
   database.
 * In the target database, source file paths are made relative using the wrong
   root path (it uses the target root path instead of the source root path.)
 * Lots of cleanup; many things feel a bit hacky.
 * Need to output the bundle manifest file with metadata.
 * Need to implement a sample data compiler that does something more than just
   copy the input file to the target directory.
 * Need to take a look at the code required to implement a data compiler. It
   seems more of a PITA than it should be.

License
-------

This is free and unencumbered software released into the public domain.

Anyone is free to copy, modify, publish, use, compile, sell, or distribute this
software, either in source code form or as a compiled binary, for any purpose,
commercial or non-commercial, and by any means.

In jurisdictions that recognize copyright laws, the author or authors of this
software dedicate any and all copyright interest in the software to the public
domain. We make this dedication for the benefit of the public at large and to
the detriment of our heirs and successors. We intend this dedication to be an
overt act of relinquishment in perpetuity of all present and future rights to
this software under copyright law.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN
ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

For more information, please refer to <http://unlicense.org/>
