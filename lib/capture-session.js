'use strict';

var util = require('util'),
    q = require('q'),
    inherit = require('inherit'),
    find = require('../lib/find-func').find,
    _ = require('lodash'),
    logger = require('./utils').logger,
    debug = require('debug'),
    StateError = require('../lib/errors/state-error');

module.exports = inherit({
    __constructor: function(browser) {
        this.browser = browser;
        this._context = {};
        this.log = debug('gemini:capture:' + this.browser.id);
    },

    runHook: function(hook, suite) {
        this.log('run callback', hook);
        var sequence = this.browser.createActionSequence();

        try {
            hook.call(this._context, sequence, find);
        } catch (e) {
            return q.reject(new StateError('Error while executing callback', e));
        }
        return sequence.perform()
            .then(function() {
                suite.addPostActions(sequence.getPostActions());
            });
    },

    capture: function(state, opts) {
        var _this = this;
        opts = _.extend({}, opts, {
            ignoreSelectors: state.ignoreSelectors
        });

        this.log('capture "%s" in %o', state.fullName, this.browser);
        return _this.browser.prepareScreenshot(state.captureSelectors, opts)
            .fail(function(e) {
                return _this.browser.captureFullscreenImage()
                    .then(function(screenImage) {
                        _.extend(e, {
                            suite: state.suite,
                            state: state,
                            browserId: _this.browser.id,
                            sessionId: _this.browser.sessionId,
                            image: screenImage
                        });
                        return q.reject(e);
                    });
            })
            .then(function(prepareData) {
                return _this.browser.captureFullscreenImage()
                    .then(_.bind(_this._cropImage, _this, _, prepareData));
            });
    },

    _cropImage: function(screenImage, prepareData) {
        this.log('capture data:', prepareData);

        var toImageCoords = this._getToImageCoordsFunction(screenImage, prepareData),
            cropArea = toImageCoords(prepareData.captureArea);

        try {
            this._validateImage(screenImage, cropArea);
        } catch (err) {
            logger.error(err.message);
            return {image: screenImage};
        }

        prepareData.ignoreAreas.forEach(function(area) {
            screenImage.clear(toImageCoords(area));
        });
        return screenImage.crop(cropArea)
            .then(function(crop) {
                return {
                    image: crop,
                    canHaveCaret: prepareData.canHaveCaret,
                    coverage: prepareData.coverage
                };
            });
    },

    _validateImage: function(image, cropArea) {
        var imageSize = image.getSize(),
            bottom = cropArea.top + cropArea.height;
        this.log('image size', imageSize);
        this.log('crop area', cropArea);
        if (bottom > imageSize.height) {
            this.log('crop bottom is outside of image');
            // This case is handled specially because of Opera 12 browser.
            // Problem, described in error message occurs there much more often then
            // for other browsers and has different workaround
            throw new StateError(util.format(
                'Failed to capture the element because it is positioned outside of the captured body. ' +
                'Most probably you are trying to capture an absolute positioned element which does not make body ' +
                'height to expand. To fix this place a tall enough <div> on the page to make body expand.\n' +
                'Element position: %s, %s; size: %s, %s. Page screenshot size: %s, %s. ',
                cropArea.left,
                cropArea.top,
                cropArea.width,
                cropArea.height,
                imageSize.width,
                imageSize.height
            ));
        }

        if (isOutsideOfImage(imageSize, cropArea)) {
            this.log('crop area is outside of image');
            throw new StateError(
                'Can not capture specified region of the page\n' +
                'The size of a region is larger then image, captured by browser\n' +
                'Check that elements:\n' +
                ' - does not overflows the document\n' +
                ' - does not overflows browser viewport\n ' +
                'Alternatively, you can increase browser window size using\n' +
                '"setWindowSize" or "windowSize" option in config file.'

            );
        }
    },

    _getToImageCoordsFunction: function(image, prepareData) {
        var imageSize = image.getSize(),
            scaleCoords = this._getCoordsScaleFunction(prepareData);
        if (imageSize.height >= prepareData.documentHeight && imageSize.width >= prepareData.documentWidth) {
            this.log('using page coordinates');
            return function toImageCoords(area) {
                return scaleCoords(area);
            };
        }

        this.log('using viewport coordinates');
        var viewportOffset = prepareData.viewportOffset;
        return function toImageCoords(area) {
            return scaleCoords({
                top: area.top - viewportOffset.top,
                left: area.left - viewportOffset.left,
                width: area.width,
                height: area.height
            });
        };
    },

    _getCoordsScaleFunction: function(prepareData) {
        if (this.browser.usePixelRatio && !_.isUndefined(prepareData.pixelRatio)) {
            this.log('coordinates will be scaled by %d', prepareData.pixelRatio);
            return function(area) {
                return {
                    top: area.top * prepareData.pixelRatio,
                    left: area.left * prepareData.pixelRatio,
                    width: area.width * prepareData.pixelRatio,
                    height: area.height * prepareData.pixelRatio
                };
            };
        }

        this.log('coordinates will not be scaled');
        return _.identity;
    }
});

function isOutsideOfImage(imageSize, cropArea) {
    return cropArea.top < 0 || cropArea.left < 0 || cropArea.left + cropArea.width > imageSize.width;
}
