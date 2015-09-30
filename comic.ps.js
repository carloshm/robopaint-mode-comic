/**
 * @file Holds all RoboPaint comic mode Paper.JS code
 */

canvas.paperInit(paper);

// Make this on the actionLayer
paper.canvas.actionLayer.activate();

paper.motionPath = new Path({
  data: {height: []} // A 1:1 match array for the motion path to set the height.
});

// Reset Everything on non-mainLayer and vars
paper.resetAll = function() {
  paper.motionPath.removeSegments(0);
}

// Please note: dragging and dropping images only works for
// certain browsers when serving this script online:
var raster = null;

paper.resetComic = function(callback) {
  paper.motionPath.removeSegments(0); // Remove all motionPath segments

  paper.comicComplete = callback;

  // Transform the raster, so it fills the view:
  raster.fitBounds(view.bounds);

  paper.canvas.tempLayer.activate(); // Draw the spiral on the tempLayer
}


paper.testRaster = function () {
  paper.canvas.tempLayer.activate();

  console.log(raster);

  try {
    for (var y = 0; y < raster.height; y++) {
      for(var x = 0; x < raster.width; x++) {
        // Get the color of the pixel:
        var color = raster.getPixel(x, y);

        // Create a circle shaped path:
        var path = new Path.Circle({
          center: new Point(x, y),
          radius: 6
        });

        // Set the fill color of the path to the color
        // of the pixel:
        path.fillColor = color;
      }
    }
  } catch(e) {
    console.error('Problem rastering', e);
  }

  // Move the active layer to the center of the view, so all 
  // the created paths in it appear centered.
//  project.activeLayer.position = view.center;
}

// Automatically paint the single spiral path.
paper.autoPaintComic = function(){
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

  paper.canvas.tempLayer.activate();
  var preview = project.activeLayer.addChild(raster.clone());

for (var y = 0; y < raster.height; y++) {
      for(var x = 0; x < raster.width; x++) {
        // Get the color of the pixel:
        var pixel = raster.getPixel(x, y);
        preview.setPixel(x, y, new Color(pixel.gray > 0.5 ? 1 : 0));
      }
    }

//  _.each(path.segments, function(seg, segIndex){
//    mode.run([
//      ['height', path.data.height[segIndex]],
//      ['move', {x: seg.point.x, y: seg.point.y}]
//    ]);
//  });

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


paper.pickComicImage = function() {
  mainWindow.dialog({
    type: 'OpenDialog',
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
      paper.canvas.mainLayer.opacity = 0.1;
      paper.resetComic();
      $('#pause').prop('disabled', true);
    }
  } catch(e) {
    console.error('Problem loading image:', path, e);
  }
};

paperLoadedInit();
