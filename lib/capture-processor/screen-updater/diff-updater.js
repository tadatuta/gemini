'use strict';

var fs = require('q-io/fs'),
    inherit = require('inherit'),
    temp = require('temp'),

    ImageProcessor = require('../../image-processor'),
    CaptureProcessor = require('../capture-processor'),

    RunnerEvents = require('../../constants/runner-events');

temp.track();

module.exports = inherit(CaptureProcessor, {
    __constructor: function(config, options) {
        this.__base(config, RunnerEvents.CAPTURE);
        options = options || {};
        this._tempDir = options.tempDir || temp.path('gemini');
        this._imageProcessor = null;
    },

    prepare: function(emitter) {
        this._imageProcessor = new ImageProcessor(emitter);
        return fs.makeTree(this._tempDir);
    },

    processCapture: function(capture) {
        var _this = this,
            browserConfig = capture.browser.config,
            refPath = browserConfig.getScreenshotPath(capture.suite, capture.state.name),
            tmpPath = this._tempPath(),
            tolerance = capture.state.tolerance;

        return capture.image.save(tmpPath)
            .then(function() {
                return fs.exists(refPath);
            })
            .then(function(isRefExists) {
                if (isRefExists) {
                    return _this._imageProcessor.compare(tmpPath, refPath, {
                            canHaveCaret: capture.canHaveCaret,
                            tolerance: tolerance
                        })
                        .then(function(isEqual) {
                            if (!isEqual) {
                                return fs.copy(tmpPath, refPath);
                            }
                        });
                }
            })
            .then(function() {
                return _this.getStateData(capture, refPath);
            });
    },

    _tempPath: function() {
        return temp.path({dir: this._tempDir, suffix: '.png'});
    }
});
