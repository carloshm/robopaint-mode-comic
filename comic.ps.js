/**
* @file Holds all RoboPaint comic mode Paper.JS code
*/

canvas.paperInit(paper);

var grow = false;

// The image to be printed. mainLayer
var raster = null;

// The print ^toolpath^; actionLayer
var preview;

var previewImageData, previewImageData;

// The number of pixels in the source image
var numPixels;

// var pixelSize = {
//     w: 0.18,   // Measured using penDotSizeTest (and magic) for a Sharpie Pen Fine Point
//     h: 0.24825 // Calculated based on WCB aspect ratio
//   };

var pixelSize = {w: 1, h: 1};


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
  var red   = rasterData[count * 4]     / 255.0;
  var green = rasterData[count * 4 + 1] / 255.0;
  var blue  = rasterData[count * 4 + 2] / 255.0;
  var alpha = rasterData[count * 4 + 3] / 255.0;

  var pixelColor = new Color(red, green, blue, alpha).gray < 0.5 ? 0 : 255;

  previewData[count * 4]     = pixelColor;
  previewData[count * 4 + 1] = pixelColor;
  previewData[count * 4 + 2] = pixelColor;
  previewData[count * 4 + 3] = 255;

  count++;
}


paper.resetComic = function(callback) {
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




paper.autoPaintComic = function() {
  // pixelSize.h = paper.canvas.actionLayer.bounds.height / raster.height;
  // pixelSize.w = paper.canvas.actionLayer.bounds.width / raster.width;

  // Wait for all these commands to stream in before starting to actually
  // run them. This ensures a smooth start.
  robopaint.pauseTillEmpty(true);

  mode.run([
    'wash',
    ['media', 'color0'],
    ['status', mode.t('status.printing')],
    'up'
  ]);

// Initial move without height set to get out onto the canvas.
  mode.run('move', {x: 0, y: 0});


  var rasterWidth = raster.width;
  var rasterHeight = raster.height;
  var penState = 1; // 1 is up, 0 is down; this is the representation on the canvas
  var pixelPen; // The Z position of the pen for this pixel
  var pixelVal; // The value of the pixel

  // penState is the state of the physical pen and must only be written to
  // when a pen up/down command is issued
  // pixelPen is the Z position of the pen for the current pixel and is
  // compared to penState to determine if a pen up/down command needs to be sent
  // pixelVal is the value of the current pixel

var penCommand, oldPenCommand;

  for(var y = 0; y < rasterHeight; y++) {
    for(var x = 0; x < rasterWidth; x++) {
      pixelVal = previewData[((rasterWidth * y) + x) * 4];

      if(pixelVal === 0) {
        pixelPen = 0; // The pen should be down
        penCommand = 'down';
      } else {
        console.log("UP!!!!!!");
        pixelPen = 1;
        penCommand = 'up';
      }

      // penCommand = pixelPen === 0 ? 'down' : 'up';

      if(penCommand === 'down' && pixelPen !== 0 || penCommand === 'up' && pixelPen === 0) {
        console.log("ERROR!!!!");
        console.log('pixelVal ' + pixelVal + '  pixelPen ' + pixelPen + '  penCommand ' + penCommand);
      }

      if (pixelVal === 255) {
        console.log(penCommand);
        if(penCommand !== 'up') {
          console.log("UP ERRORO!!!#@!!");
        }
      }

      if(oldPenCommand !== penCommand) {
        console.log('incoming command!!!' + penCommand)
        mode.run([
          [penCommand],
          [penCommand],
          ['move', {x: pixelSize.w * x, y: pixelSize.h * y}]
        ]);

        oldPenCommand = penCommand;
        penState = pixelPen;
      }
    }

    console.log('y' + y);

    // Pen is down so we must move over for the last pixel
    if(true || penState === 0) {
      mode.run('move', {x: pixelSize.w * (x + 1), y: pixelSize.h * y});
    }

    mode.run([
      ['up'],
      ['up'],
      ['move', {x: 0, y: pixelSize.h * (y + 1)}]
    ]);

    // The pen X commands are duplicated here. I am trying to figure out what is not working

    // I set this to two to get this to reset the pen state at the begenning
    // of each line
    penState = 2; // Reset the pen to up
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




// Image chooser stuff

// Prompt the user for the path to the image
paper.pickComicImage = function() {
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

    raster.onLoad = function() {
      raster.fitBounds(view.bounds);
      paper.canvas.mainLayer.opacity = 0.2;
      paper.resetComic();
      $('#pause').prop('disabled', true);
    }
  } catch(e) {
    console.error('Problem loading image:', path, e);
  }
};

paperLoadedInit();
