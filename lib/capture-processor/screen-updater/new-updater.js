'use strict';

var fs = require('q-io/fs'),
    inherit = require('inherit'),
    CaptureProcessor = require('../capture-processor'),

    RunnerEvents = require('../../constants/runner-events');

module.exports = inherit(CaptureProcessor, {
    __constructor: function(config) {
        this.__base(config, RunnerEvents.CAPTURE);
    },

    processCapture: function(capture) {
        var browserConfig = capture.browser.config,
            refPath = browserConfig.getScreenshotPath(capture.suite, capture.state.name);

        return fs.makeTree(browserConfig.getScreenshotsDir(capture.suite, capture.state.name))
            .then(function() {
                return fs.exists(refPath);
            })
            .then(function(isRefExists) {
                if (!isRefExists) {
                    return capture.image.save(refPath);
                }
            })
            .then(function() {
                return this.getStateData(capture, refPath);
            }.bind(this));
    }
});
