/**
 * @file Holds all RoboPaint comic mode DOM code
 */
"use strict";

var actualPen = {}; // Hold onto the latest actualPen object from updates.
var buffer = {};
var t = i18n.t; // The mother of all shortcuts
var canvas = rpRequire('canvas');
var dataURI = require('datauri'); // Save rasters as a single URI
var remote = require('remote');
var mainWindow = remote.getCurrentWindow();

// True to show advanced options (CMYK printing options)
var advanced = true;
var dither = false;

mode.pageInitReady = function () {
  // Initialize the paper.js canvas with wrapper margin and other settings.
  canvas.domInit({
    replace: '#paper-placeholder', // jQuery selecter of element to replace
    paperScriptFile: 'comic.ps.js', // The main PaperScript file to load
    wrapperMargin: {
      top: 30,
      left: 30,
      right: 265,
      bottom: 40
    }
  });
}


// Trigger load init resize only after paper has called this function.
function paperLoadedInit() {

  // Build the initial Spiral
  paper.loadComicImage(mode.path.dir + '/images/mona.jpg');

  mode.settings.$manage('.managed');

  if (!advanced) {
    $('#advancedcontrols').hide();
  }

  // With Paper ready, send a single up to fill values for buffer & pen.
  mode.run('up');
}


// Catch CNCServer buffered callbacks
mode.onCallbackEvent = function(name) {
  switch (name) {
    case 'comicBegin': // Should happen when we've just started
      $('#pause').prop('disabled', false); // Enable pause button
      break;
    case 'comicComplete': // Should happen when we're completely done
      $('#pause').attr('class', 'ready')
        .attr('title', t('modes.print.status.ready'))
        .text(robopaint.t('common.action.start'))
        .prop('disabled', false);
      $('#buttons button.normal').prop('disabled', false); // Enable options
      $('#cancel').prop('disabled', true); // Disable the cancel print button
      break;
  }
};

// Catch less general message types from RoboPaint.
mode.onMessage = function(channel, data) {
  switch (channel) {
    default:
    console.log("RP message: ", channel, data);
  }
};

// Mode API called callback for binding the controls
mode.bindControls = function(){
  // Cancel Print
  $('#cancel').click(function(){
    var cancelPrint = confirm(mode.t("status.confirm"));
    if (cancelPrint) {
      mode.onCallbackEvent('comicComplete');
      mode.fullCancel(mode.t('status.cancelled'));
    }
  });

  // Pick file (mostly handled in the PaperScript comic.ps.js)
  $('#picker').click(function(){
    paper.pickComicImage();
  });

  // Bind pause click and functionality
  $('#pause').click(function() {

    // With nothing in the queue, start comicpaint!
    if (buffer.length === 0) {
      $('#pause')
        .removeClass('ready')
        .attr('title', mode.t("status.pause"))
        .text(t('common.action.pause'))
        .prop('disabled', true);
      $('#buttons button.normal').prop('disabled', true); // Disable options
      $('#cancel').prop('disabled', false); // Enable the cancel print button

      // Actually go and paint the comic
      paper.autoPaintComic(parseInt($('#repeattimes').val()));

    } else {
      // With something in the queue... we're either pausing, or resuming
      if (!buffer.paused) {
        // Starting Pause =========
        $('#pause').prop('disabled', true).attr('title', t("status.wait"));
        mode.run([
          ['status', t("status.pausing")],
          ['pause']
        ], true); // Insert at the start of the buffer so it happens immediately

        mode.onFullyPaused = function(){
          mode.run('status', t("status.paused"));
          $('#buttons button.normal').prop('disabled', false); // Enable options
          $('#pause')
            .addClass('active')
            .attr('title', t("status.resume"))
            .prop('disabled', false)
            .text(t("common.action.resume"));
        };
      } else {
        // Resuming ===============
        $('#buttons button.normal').prop('disabled', true); // Disable options
        mode.run([
          ['status', t("status.resuming")],
          ['resume']
        ], true); // Insert at the start of the buffer so it happens immediately

        mode.onFullyResumed = function(){
          $('#pause')
            .removeClass('active')
            .attr('title', t("mode.print.status.pause"))
            .text(t('common.action.pause'));
          mode.run('status', t("status.resumed"));
        };
      }
    }
  });

  // Bind to control buttons
  $('#park').click(function(){
    // If we're paused, skip the buffer
    mode.run([
      ['status', t("status.parking"), buffer.paused],
      ['park', buffer.paused], // TODO: If paused, only one message will show :/
      ['status', t("status.parked"), buffer.paused]
    ]);
  });


  $('#pen').click(function(){
    // Run height pos into the buffer, or skip buffer if paused
    var newState = 'up';
    if (actualPen.state === "up" || actualPen.state === 0) {
      newState = 'down';
    }

    mode.run(newState, buffer.paused);
  });

  // Motor unlock: Also lifts pen and zeros out.
  $('#disable').click(function(){
    mode.run([
      ['status', t("status.unlocking")],
      ['up'],
      ['zero'],
      ['unlock'],
      ['status', t("status.unlocked")]
    ]);
  });

  $('#update').click(function() {
    paper.resetComic();
  });
}

// Warn the user on close about cancelling jobs.
mode.onClose = function(callback) {
  if (buffer.length) {
    var r = confirm(i18n.t('common.dialog.confirmexit'));
    if (r == true) {
      // As this is a forceful cancel, shove to the front of the queue
      mode.run(['clear', 'park', 'clearlocal'], true);
      callback(); // The user chose to close.
    }
  } else {
    callback(); // Close, as we have nothing the user is waiting on.
  }
}

// Actual pen update event
mode.onPenUpdate = function(botPen){
  paper.canvas.drawPoint.move(botPen.absCoord, botPen.lastDuration);
  actualPen = $.extend({}, botPen);

  // Update button text/state
  // TODO: change implement type <brush> based on actual implement selected!
  var key = 'common.action.brush.raise';
  if (actualPen.state === "up" || actualPen.state === 0){
    key = 'common.action.brush.lower';
  }
  $('#pen').text(t(key));
}

// An abbreviated buffer update event, contains paused/not paused & length.
mode.onBufferUpdate = function(b) {
  buffer = b;
}

function growRaster(printColor, count, rasterWidth) {
  // Get the color of the pixel:
  var red   = rasterData[count * 4]     / 255;
  var green = rasterData[count * 4 + 1] / 255;
  var blue  = rasterData[count * 4 + 2] / 255;
  var alpha = rasterData[count * 4 + 3] / 255;

  // This expects red, green, blue, and alpha to range from 0 to 1.
  // Divide red, green, blue, and alpha by 255 if using the line below.
  // var pixelColor = new Color(red, green, blue, alpha).gray < 0.5 ? 0 : 255;

  // This expects red, green, blue, and alpha to range from 0 to 255.
  // Do not divide red, green, blue, and alpha by 255 if using the line below.
  // if (red < 127 && blue < 127 && green < 127) {
  //      var pixelColor = 0;
  //    } else {
  //      var pixelColor = 255;
  //    }

  // CMYK based thresholding
  var black = 1 - Math.max(red, green, blue);
  if (black === 1) {
    var cyan = 0;
    var magenta = 0;
    var yellow = 0;
  } else {
    var cyan = (1 - red - black) / (1 - black);
    var magenta = (1 - green - black) / (1 - black);
    var yellow = (1 - blue - black) / (1 - black);
  }

  var threshRed, threshGreen, threshBlue;

  if (black >= 0.5) {
    threshRed = threshGreen = threshBlue = 0;
  } else {
    threshRed   = (1 - cyan   ) * (1 - black) <= 0.5 ? 0 : 255;
    threshGreen = (1 - magenta) * (1 - black) <= 0.5 ? 0 : 255;
    threshBlue  = (1 - yellow ) * (1 - black) <= 0.5 ? 0 : 255;
  }

  // All color values in here will be 0 - 255
  if (dither) {
    var redErr   = red   * 255 - threshRed;
    var greenErr = green * 255 - threshGreen;
    var blueErr  = blue  * 255 - threshBlue;

    var ditherErrs = [
      {offset:               1, dist: 7/16},
      {offset: rasterWidth - 1, dist: 3/16},
      {offset:    rasterWidth , dist: 5/16},
      {offset: rasterWidth + 1, dist: 1/16},
    ];

    var remainingPixels = rasterData.length / 4 - count;

    for (let errPx of ditherErrs) {
      if (remainingPixels < errPx.offset) {
        break;
      }

      rasterData[(count + errPx.offset) * 4]     += redErr   * errPx.dist;
      rasterData[(count + errPx.offset) * 4 + 1] += greenErr * errPx.dist;
      rasterData[(count + errPx.offset) * 4 + 2] += blueErr  * errPx.dist;
    }
  }

  var pixelColor;

  switch (printColor) {
    case 'black':
      pixelColor = black >= 0.5 ? 0 : 255;
      break;
    case 'cyan':
      pixelColor = cyan >= 0.5 && !(black >= 0.5) ? 0 : 255;
      break;
    case 'magenta':
      pixelColor = magenta >= 0.5 && !(black >= 0.5) ? 0 : 255;
      break;
    case 'yellow':
      pixelColor = yellow >= 0.5 && !(black >= 0.5) ? 0 : 255;
      break;
    case 'all':
      // do nothing
      break;
  }

  var previewRed, previewGreen, previewBlue;

  if (printColor !== 'all') {
    previewRed = previewGreen = previewBlue = pixelColor;
    if (pixelColor === 0) {
      paper.downCount++;
    } else {
      paper.upCount++;
    }
  } else {
    previewRed   = threshRed;
    previewGreen = threshGreen;
    previewBlue  = threshBlue;

    if (black >= 0.5) {paper.downCount++;} else {paper.upCount++;}
    if (cyan >= 0.5 && !(black >= 0.5)) {paper.downCount++;} else {paper.upCount++;}
    if (magenta >= 0.5 && !(black >= 0.5)) {paper.downCount++;} else {paper.upCount++;}
    if (yellow >= 0.5 && !(black >= 0.5)) {paper.downCount++;} else {paper.upCount++;}
  }

  previewData[count * 4]     = previewRed;
  previewData[count * 4 + 1] = previewGreen;
  previewData[count * 4 + 2] = previewBlue;
  previewData[count * 4 + 3] = 255;
}
