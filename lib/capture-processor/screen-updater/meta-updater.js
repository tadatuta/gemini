'use strict';

var inherit = require('inherit'),
    CaptureProcessor = require('../capture-processor'),
    DiffUpdater = require('./diff-updater'),
    NewUpdater = require('./new-updater'),

    util = require('../../promise-util'),

    RunnerEvents = require('../../constants/runner-events');

module.exports = inherit(CaptureProcessor, {
    __constructor: function(config, options) {
        this.__base(config, RunnerEvents.CAPTURE);
        this._diffUpdater = new DiffUpdater(config, options);
        this._newUpdater = new NewUpdater(config);
    },

    prepare: function(emitter) {
        this._diffUpdater.prepare(emitter);
        this._newUpdater.prepare(emitter);
    },

    processCapture: function(capture) {
        return util.sequence([
            this._diffUpdater.processCapture.bind(this._diffUpdater, capture),
            this._newUpdater.processCapture.bind(this._newUpdater, capture)
        ]);
    }
});
