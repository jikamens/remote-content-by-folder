// https://gist.github.com/oshybystyi/8cf882bc8b0c9a95a116

/**
 * Working example can be found here
 * https://github.com/oshybystyi/FireX-Pixel-Perfect/blob/issue-5-make-addon-restartless/content/lib/defaultPreferencesLoader.jsm
 *
 * Important this module was tested only with <em:unpack>true</em:unpack>, most
 * likely it won't work with false value
 *
 * A lot of stuff was borrowed from https://github.com/firebug/firebug/blob/master/extension/modules/prefLoader.js
 */

const { utils: Cu, classes: Cc, interfaces: Ci } = Components;

Cu.import('resource://gre/modules/Services.jsm');

var EXPORTED_SYMBOLS = ['DefaultPreferencesLoader'];

/**
 * Read defaults/preferences/* and set Services.pref default branch
 */
function DefaultPreferencesLoader(installPath) {
    var readFrom = [];

    // Maybe instead just test if it's a file rather than a directory?
    // Not sure.
    if (/\.xpi$/i.test(installPath.path)) {
        let baseURI = Services.io.newFileURI(installPath);
        // Packed extension, need to read ZIP to get list of preference files
        // and then use "jar:" URIs to access them.
        let zr = Cc['@mozilla.org/libjar/zip-reader;1'].createInstance(
            Ci.nsIZipReader);
        zr.open(installPath);
        let entries = zr.findEntries('defaults/preferences/?*');
        while (entries.hasMore()) {
            let entry = entries.getNext();
            readFrom.push('jar:' + baseURI.spec + "!/" + entry);
        }
    }
    else {
        let dirPath = installPath.clone(); // don't modify the original object

        ['defaults', 'preferences'].forEach(function(dir) {
            dirPath.append(dir);
        });

        if (dirPath.exists() !== true) {
            throw new DefaultsDirectoryMissingError(dirPath);
        }

        let entries = dirPath.directoryEntries;

        while (entries.hasMoreElements()) {
            let fileURI = Services.io.newFileURI(entries.getNext());
            readFrom.push(fileURI.spec);
        }
    }

    this.readFrom = readFrom;

    this.defaultBranch = Services.prefs.getDefaultBranch("");
} 

DefaultPreferencesLoader.prototype = {
    /**
     * Iterate over files in the default/preferences/*
     *
     * @param {function} prefFunc the function that should be used instead of
     * pref
     */
    parseDirectory: function(prefFunc) {
        prefFunc = prefFunc || this.pref.bind(this);

        this.readFrom.forEach(function(uri) {
	    Services.scriptloader.loadSubScript(uri, { pref: prefFunc });
	});
    },

    /**
     * Emulates firefox pref function to load default preferences
     */
    pref: function(key, value) {
        switch (typeof value) {
            case 'boolean':
                this.defaultBranch.setBoolPref(key, value);
                break;

            case 'number':
                this.defaultBranch.setIntPref(key, value);
                break;

            case 'string':
                /**
                 * Using setComplexValue instead of setCharPref because of
                 * unicode support
                 */
                let str = Cc["@mozilla.org/supports-string;1"].createInstance(Ci.nsISupportsString);
                str.data = value;
                this.defaultBranch.setComplexValue(key, Ci.nsISupportsString, str);
                break;

            default:
                throw new NotSupportedValueTypeError(key);
                break;
        }
    },

    /**
     * Clears default preferences according to AMO reviewers reccommendation
     * This should be invoked on bootstrap::shutdown
     * @see https://github.com/firebug/firebug/blob/master/extension/modules/prefLoader.js
     */
    clearDefaultPrefs: function() {
        this.parseDirectory(this.prefUnload.bind(this));
    },

    prefUnload: function(key) {
        let branch = this.defaultBranch;
        if (branch.prefHasUserValue(key) !== true) {
            branch.deleteBranch(key);
        }
    }

};

/**
 * Exception type on missing defaults/preferences folder
 */
function DefaultsDirectoryMissingError(installPath) {
    this.name = 'DefaultsDirectoryMissingError';
    this.message = '\'' + installPath.path + '\' does no exist';
}

/** Inherit from Error for error stack and pretty output in terminal **/
DefaultsDirectoryMissingError.prototype = new Error();

/**
 * Not supported value type to store by pref
 */
function NotSupportedValueTypeError(key) {
    this.name = 'NotSupportedValueType';
    this.message = 'Value type for key \'' + key + '\' is not supported';
}

NotSupportedValueTypeError.prototype = new Error();