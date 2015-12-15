'use strict';

var DiffUpdater = require('./diff-updater'),
    NewUpdater = require('./new-updater'),
    MetaUpdater = require('./meta-updater');

exports.create = function(config, options) {
    var diffOpt = options.diff,
        newOpt = options.new;

    if (diffOpt && newOpt || !diffOpt && !newOpt) {
        return new MetaUpdater(config, options);
    }
    if (diffOpt) {
        return new DiffUpdater(config, options);
    } else if (newOpt) {
        return new NewUpdater(config, options);
    }
};
