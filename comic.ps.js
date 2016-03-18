/**
* @file Holds all RoboPaint comic mode Paper.JS code
*/

canvas.paperInit(paper);

var grow = false;

// The image to be printed. mainLayer
var raster = null;

// The print ^toolpath^; actionLayer
var preview;

var previewImageData;

// The number of pixels in the source image
var numPixels;

// var pixelSize = {
//     w: 0.18,   // Measured using penDotSizeTest (and magic) for a Sharpie Pen Fine Point
//     h: 0.24825 // Calculated based on WCB aspect ratio
//   };

var pixelSize = {w: 1, h: 1};

var test = false;


function onFrame(event) {
  canvas.onFrame(event);

  if (grow) {
    if (raster && count < numPixels) {
      for (var i = 0, l = count / 36 + 1; i < l; i++) {
        growRaster();
      }

      preview.setImageData(previewImageData, new Point(0, 0));
    } else {
      grow = false;
      if (paper.comicComplete) paper.comicComplete();

      // Enable the start/pause button after the spiral has been made.
      $('#pause').prop('disabled', false);
    }
  }
}

function growRaster() {
  // Get the color of the pixel:
  var red   = rasterData[count * 4]     / 255;
  var green = rasterData[count * 4 + 1] / 255;
  var blue  = rasterData[count * 4 + 2] / 255;
  var alpha = rasterData[count * 4 + 3] / 255;

  // This expects red, green, blue, and alpha to range from 0 to 1.
  // Divide red, green, blue, and alpha by 255 if using the line below.
  var pixelColor = new Color(red, green, blue, alpha).gray < 0.5 ? 0 : 255;

  // This expects red, green, blue, and alpha to range from 0 to 255.
  // Do not divide red, green, blue, and alpha by 255 if using the line below.
  // if (red < 127 && blue < 127 && green < 127) {
  //      var pixelColor = 0;
  //    } else {
  //      var pixelColor = 255;
  //    }

  // CMYK based thresholding
  // var black = 1 - Math.max(red, green, blue);
  // if (black === 1) {
  //   var cyan = 0;
  //   var magenta = 0;
  //   var yellow = 0;
  // } else {
  //   var cyan = (1 - red - black) / (1 - black);
  //   var magenta = (1 - green - black) / (1 - black);
  //   var yellow = (1 - blue - black) / (1 - black);
  // }
  //
  // var pixelColor = yellow >= 0.5 ? 0 : 255;

  previewData[count * 4]     = pixelColor;
  previewData[count * 4 + 1] = pixelColor;
  previewData[count * 4 + 2] = pixelColor;
  previewData[count * 4 + 3] = 255;

  count++;
}


paper.resetComic = function (callback) {
  paper.comicComplete = callback;

  // Transform the raster, so it fills the view:
  raster.fitBounds(view.bounds);

  // Draw the preview on the action layer
  paper.canvas.actionLayer.activate();

  // Make the preview show the dark regions, light regions, and origional well
  paper.canvas.actionLayer.blendMode = 'darken';
  paper.canvas.actionLayer.opacity = 0.7;
  paper.canvas.mainLayer.opacity = 0.4;

  if (preview) {
    preview.remove();
  }

  preview = project.activeLayer.addChild(raster.clone());

  rasterData = raster.getImageData(new Rectangle(new Point(0, 0), raster.size)).data;
  previewImageData = preview.getImageData(new Rectangle(new Point(0, 0), preview.size));
  previewData = previewImageData.data;

  count = 0;

  numPixels = raster.width * raster.height;

  grow = true;
}


paper.autoPaintComic = function(repeatLineTimes) {
  // Wait for all these commands to stream in before starting to actually
  // run them. This ensures a smooth start.
  robopaint.pauseTillEmpty(true);

  mode.run([
    ['callbackname', 'comicBegin'],
    'wash',
    ['media', 'color0'],
    ['status', mode.t('status.printing')],
    'up'
  ]);

  // Initial move without height set to get out onto the canvas.
  mode.run('move', {x: 0, y: 0});


  var rasterWidth = raster.width;
  var rasterHeight = raster.height;

  var penPos = 'up';
  var pixelPos;

  pixelSize.w = pixelSize.h = Math.min(
    robopaint.canvas.width / rasterWidth,
    robopaint.canvas.height / rasterHeight
  );

  var drawingOffset = {
    x: (robopaint.canvas.width - rasterWidth * pixelSize.w) / 2,
    y: (robopaint.canvas.height - rasterHeight * pixelSize.h) / 2
  }

  function getPixelIndex(x, y) {
    return (y * rasterWidth + x) * 4;
  }

  if (test) {
    drawingOffset.x = drawingOffset.y = 0;
    pixelSize.w = pixelSize.w = 10;
  }

  pixelSize.h = pixelSize.h / repeatLineTimes;

  function realPosition(x, y) {
    return {x: x * pixelSize.w + drawingOffset.x, y: y * pixelSize.h + drawingOffset.y}
  }

  mode.run('move', realPosition(0, 0));


  for (var y = 0; y < rasterHeight * repeatLineTimes; y++) {
    var step = Math.pow(-1, y);
    var yPixel = Math.floor(y / repeatLineTimes);

    var start =  y % 2 * (rasterWidth - 1);
    var end   = (y + 1) % 2 * (rasterWidth + 1) - 1;

    for (var x = start; x !== end; x += step) {
      pixelVal = previewData[getPixelIndex(x, yPixel)];

      if (pixelVal === 0) {
        pixelPos = 'down';
      } else {
        pixelPos = 'up';
      }

      if (penPos !== pixelPos) {
        // Move to finish pixel when going up.
        // Move to before pixel when going down.
        if (pixelPos === 'down') {
          mode.run([
            ['move', realPosition(step > 0 ? x : x + -step, y)],
            'down'
          ]);
        } else {
          mode.run([
            ['move', realPosition(step > 0 ? x : x + -step, y)],
            'up'
          ]);
        }

        penPos = pixelPos;
      }
    }

    // If pen is down we must move over for the last pixel and down for the next line
    if (penPos == 'down') {
      // x has been incremented from the for loop this just executes the move
      mode.run([
        ['move', realPosition(step > 0 ? x : x + -step, y)],
        'up'
      ]);
      penPos = 'up';
    }
  }


  mode.run([
    'wash',
    'park',
    ['status', i18n.t('libs.autocomplete')],
    ['callbackname', 'comicComplete']
  ]);

  // This tells pause Till Empty that we're ready to start checking for
  // local buffer depletion. We can't check sooner as we haven't finished
  // sending all the data yet!
  robopaint.pauseTillEmpty(false);
}


// Prompt the user for the path to the image
paper.pickComicImage = function () {
  mainWindow.dialog({
    t: 'OpenDialog',
    title: mode.t('filepick.title'),
    filters: [
      { name: mode.t('filepick.files'), extensions: ['jpg', 'jpeg', 'gif', 'png'] }
    ]
  }, function(filePath){
    if (!filePath) {  // Open cancelled
      return;
    }
    paper.loadComicImage(filePath[0]);
  });
};

// Load the image onto the canvas
paper.loadComicImage = function (path) {
  paper.canvas.mainLayer.activate(); // Draw the raster to the main layer

  if (raster) raster.remove();
  try {
    raster = new Raster({
      source: dataURI(path),
      position: view.center
    });

    raster.onLoad = function () {
      raster.fitBounds(view.bounds);
      paper.canvas.mainLayer.opacity = 0.2;
      paper.resetComic();
      $('#pause').prop('disabled', true);
    }
  } catch (e) {
    console.error('Problem loading image:', path, e);
  }
};


paperLoadedInit();
