/**
 * title: Sentinel-2 Indices and Masks Functions
 * author: Brendan Casey
 * date: 2024-06-01
 *
 * description:
 * This script defines functions to calculate various spectral 
 * indices and apply masks to a time series of Sentinel-2 images. 
 * The indices include vegetation, moisture, and stress-related 
 * indices. Masks are used for cloud, snow, and QA filtering.
 */
 
 
 
 /**
 * Adds Red Edge Chlorophyll Index (CRE) band to an image.
 * Gitelson et al. (2003)
 * @param {ee.Image} image - The input image.
 * @returns {ee.Image} The image with the added DSWI band.
 */
 
exports.addCRE = function(image) {
  var CRE = image.expression(
    '(RedEdge3 / RedEdge1) - 1', {
      'RedEdge1': image.select('B5'),
      'RedEdge3': image.select('B7'),
    }).rename('CRE');
  return image.addBands([CRE]);
};
 
/**
 * Adds Disease Stress Water Index (DSWI) band to an image.
 * @param {ee.Image} image - The input image.
 * @returns {ee.Image} The image with the added DSWI band.
 */
 
exports.addDSWI = function(image) {
  var DSWI = image.expression(
    '(NIR + Green) / (Red + SWIR)', {
      'NIR': image.select('B8'),
      'Green': image.select('B3'),
      'Red': image.select('B4'),
      'SWIR': image.select('B11'),  
    }).rename('DSWI');
  return image.addBands([DSWI]);
};

/**
 * Adds Distance Red & SWIR (DRS) band to an image.
 * @param {ee.Image} image - The input image.
 * @returns {ee.Image} The image with the added DRS band.
 */
exports.addDRS = function(image) {
  var DRS = image.expression(
    'sqrt(((RED) * (RED)) + ((SWIR) * (SWIR)))', {
      'SWIR': image.select('B11'),
      'RED': image.select('B4'),
    }).rename('DRS');
  return image.addBands([DRS])
    .copyProperties(image, ['system:time_start']);
};

/**
 * Adds Enhanced Vegetation Index (EVI) band to an image.
 * EVI = 2.5 * ((NIR - RED) / (NIR + 6 * RED - 7.5 * BLUE + 1))
 * @param {Object} image - The image to process.
 * @returns {Object} The image with the EVI band added.
 */
exports.addEVI = function(image) {
  var EVI = image.expression(
    '2.5 * ((NIR - RED) / (NIR + 6 * RED - 7.5 * BLUE + 1))', {
      'NIR': image.select('B8'),
      'RED': image.select('B4'),
      'BLUE': image.select('B2')
    }).rename('EVI');
  return image.addBands([EVI]);
};

/**
 * Adds Green Normalized Difference Vegetation Index (GNDVI) band to an image.
 * Gitelson and Merzlyak (1998)
 * @param {ee.Image} image - The input image.
 * @returns {ee.Image} The image with the added GNDVI band.
 */
exports.addGNDVI = function(image) {
  var GNDVI = image.normalizedDifference(['B8', 'B3'])
    .rename('GNDVI');
  return image.addBands([GNDVI]);
};


/**
 * Adds Leaf Area Index (LAI) band to an image.
 * LAI = 3.618 * EVI - 0.118
 * @param {Object} image - The image to process.
 * @returns {Object} The image with the LAI band added.
 */
exports.addLAI = function(image) {
  var LAI = image.expression(
    '3.618 * (EVI) - 0.118', {
      'EVI': image.expression(
        '2.5 * ((NIR - RED) / (NIR + 6 * RED - 7.5 * BLUE + 1))', {
          'NIR': image.select('B8'),
          'RED': image.select('B4'),
          'BLUE': image.select('B2')
        })
    }).rename('LAI');
  return image.addBands([LAI]);
};

/**
 * Adds Normalized Burn Ratio (NBR) band to an image.
 * NBR = (NIR - SWIR2) / (NIR + SWIR2)
 * @param {Object} image - The image to process.
 * @returns {Object} The image with the NBR band added.
 */
exports.addNBR = function(image) {
  var NBR = image.expression(
    '(NIR - SWIR2) / (NIR + SWIR2)', {
      'NIR': image.select('B8'),
      'SWIR2': image.select('B12'),
    }).rename('NBR');
  return image.addBands([NBR]);
};



/**
 * Adds Normalized Difference Red-edge Index 1 (NDRE1) band to an image.
 * @param {ee.Image} image - The input image.
 * @returns {ee.Image} The image with the added NDRE1 band.
 */
exports.addNDRE1 = function(image) {
  var NDRE1 = image.expression(
    '(RedEdge2 - RedEdge1) / (RedEdge2 + RedEdge1)', {
      'RedEdge2': image.select('B6'),
      'RedEdge1': image.select('B5'),
    }).rename('NDRE1');
  return image.addBands([NDRE1]);
};

/**
 * Adds Normalized Difference Red-edge Index 2 (NDRE2) band to an image.
 * @param {ee.Image} image - The input image.
 * @returns {ee.Image} The image with the added NDRE2 band.
 */
exports.addNDRE2 = function(image) {
  var NDRE2 = image.expression(
    '(RedEdge3 - RedEdge1) / (RedEdge3 + RedEdge1)', {
      'RedEdge3': image.select('B7'),
      'RedEdge1': image.select('B5'),
    }).rename('NDRE2');
  return image.addBands([NDRE2]);
};


/**
 * Adds Normalized Difference Red-edge Index 3 (NDRE3) band to an image.
 * Checks for required bands before applying the calculation.
 * @param {ee.Image} image - The input image.
 * @returns {ee.Image} The image with the added NDRE3 band (if bands exist).
 */
exports.addNDRE3 = function(image) {
  var bands = ['B8A', 'B7']; // Required bands
  var hasBands = bands.every(function(b) { return image.bandNames().contains(b); });

  return ee.Algorithms.If(
    hasBands,
    image.addBands(image.expression(
      '(RedEdge4 - RedEdge3) / (RedEdge4 + RedEdge3)', {
        'RedEdge4': image.select('B8A'),
        'RedEdge3': image.select('B7')
      }).rename('NDRE3')),
    image  // Return original image if bands are missing
  );
};

/**
 * Adds Normalized Difference Vegetation Index (NDVI) band to an image.
 * @param {ee.Image} image - The input image.
 * @returns {ee.Image} The image with the added NDVI band.
 */
exports.addNDVI = function(image) {
  var NDVI = image.normalizedDifference(['B8', 'B4'])
    .rename('NDVI');
  return image.addBands([NDVI])
};




/**
 * Adds Normalized Difference Water Index (NDWI) band to an image.
 * @param {ee.Image} image - The input image.
 * @returns {ee.Image} The image with the added NDWI band.
 */
exports.addNDWI = function(image) {
  var NDWI = image.expression(
    '(Green - NIR) / (Green + NIR)', {
      'NIR': image.select('B8'),
      'Green': image.select('B3'),
    }).rename('NDWI');
  return image.addBands([NDWI]);
};

// /**
// * Adds Normalized Distance Red & SWIR (NDRS) band 
// * to an image for specific forest types and appends a suffix:
// * - Class Code: 210 - Coniferous (_coni)
// * - Class Code: 220 - Broadleaf (_deci)
// * - Class Code: 230 - Mixedwood (_mixed)
// * 
// * @param {ee.Image} image - DRS image to normalize.
// * @param {Array} forestTypes - Forest type codes to include.
// * @returns {ee.Image} The image with NDRS bands added and renamed.
// */

exports.addNDRS = function(image, forestTypes) {
  // Define the area of interest (AOI) using the image's geometry
  var aoi = image.geometry();
  
  // Extract the year from the image properties
  var year = ee.Number.parse(image.get('year'));

  // Define start and end dates based on the year
  var startDate = ee.Algorithms.If(
    year.gte(2019),
    ee.Date('2019-01-01'),
    ee.Date(year.format().cat('-01-01')) // Start date of "year-01-01"
  );
  
  var endDate = ee.Algorithms.If(
    year.gte(2019),
    ee.Date('2019-12-31'),
    ee.Date(year.format().cat('-12-31')) // End date of "year-12-31"
  );
  
    // Load landcover data for the specified period
  var forest_lc = require("users/bgcasey/science_centre:functions/annual_forest_land_cover");
  var lcCollection = forest_lc.lc_fn(startDate, endDate, aoi);
  var landcoverImage = ee.Image(lcCollection.first())
    .select('forest_lc_class');
  
  // Create a mask for the specified forest types
  forestTypes = forestTypes || [210, 220, 230]; // Default to all three types
  var forestMask = landcoverImage.remap(forestTypes, 
    ee.List.repeat(1, forestTypes.length), 0);
  
  // Apply the forest mask to the DRS band
  var DRS = image.select('DRS');
  var maskedDRS = DRS.updateMask(forestMask);
  
  // Calculate min and max of DRS for forest pixels
  var minMax = maskedDRS.reduceRegion({
    reducer: ee.Reducer.minMax(),
    geometry: aoi.bounds(),
    scale: 1000,
    maxPixels: 1e10,
    bestEffort: true,
    tileScale: 8
  });
  
  // Extract the min and max values
  var DRSmin = ee.Number(minMax.get('DRS_min'));
  var DRSmax = ee.Number(minMax.get('DRS_max'));
  
  // Adjust pixel values to ensure they are within [DRSmin, DRSmax]
  var adjustedDRS = DRS.clamp(DRSmin, DRSmax);

  // Calculate NDRS using the min and max values
  var NDRS = adjustedDRS.expression(
    '(DRS - DRSmin) / (DRSmax - DRSmin)', {
      'DRS': adjustedDRS,
      'DRSmin': DRSmin,
      'DRSmax': DRSmax
    }).rename('NDRS');

  // Rename the NDRS band with conditional suffixes
  var suffix = ee.Algorithms.If(
    forestTypes.length === 1,
    ee.Algorithms.If(
      forestTypes[0] === 210, '_coni', // Coniferous
      ee.Algorithms.If(
        forestTypes[0] === 220, '_deci', // Deciduous
        '_mixed' // Mixedwood
      )
    ),
    '_mixed' // More than one type defaults to mixed
  );
  NDRS = NDRS.rename(NDRS.bandNames().map(function(bandName) {
    return ee.String(bandName).cat(suffix);
  }));
  
  // Rename NDRS_coni_deci_mixed to NDRS_mixed
  var renamedBands = NDRS.bandNames().map(function(bandName) {
    return ee.String(bandName).replace('NDRS_coni_deci_mixed', 'NDRS_mixed');
  });
  NDRS = NDRS.rename(renamedBands);
  
  // Add the renamed NDRS band to the image
  return image.addBands(NDRS);
};



/**
 * Adds Ratio Drought Index (RDI) band to an image.
 * Checks for required bands before applying the calculation.
 * @param {ee.Image} image - The input image.
 * @returns {ee.Image} The image with the added RDI band (if bands exist).
 */
exports.addRDI = function(image) {
  var bands = ['B12', 'B8A']; // Required bands
  var hasBands = bands.every(function(b) { return image.bandNames().contains(b); });

  return ee.Algorithms.If(
    hasBands,
    image.addBands(image.expression(
      'SWIR2 / RedEdge4', {
        'SWIR2': image.select('B12'),
        'RedEdge4': image.select('B8A')
      }).rename('RDI')),
    image  // Return original image if bands are missing
  );
};


/**
 * Creates a binary mask based on the NDRS threshold to 
 * classify stressed and not stressed forest pixels.
 * @param {ee.Image} image - The input image.
 * @returns {ee.Image} The image with the added binary mask band.
 */
exports.createBinaryMask = function(image) {
  var masks = require("users/bgcasey/science_centre:functions/masks");
  var maskedImage = masks.maskByLandcover(image).unmask(0);
  var band = maskedImage.select(bandName);
  var binaryMask = band.gt(threshold).rename('NDRS_stressed');
  var imageWithMask = image.addBands(binaryMask);
  return imageWithMask;
};





/**
 * Function to mask clouds using the Sentinel-2 QA band
 * @param {ee.Image} image Sentinel-2 image
 * @return {ee.Image} cloud masked Sentinel-2 image
 */
exports.maskS2clouds = function(image) {
  var qa = image.select('QA60');

  // Bits 10 and 11 are clouds and cirrus, respectively.
  var cloudBitMask = 1 << 10;
  var cirrusBitMask = 1 << 11;

  // Both flags should be set to zero, indicating clear conditions.
  var mask = qa.bitwiseAnd(cloudBitMask).eq(0)
      .and(qa.bitwiseAnd(cirrusBitMask).eq(0));

  return image.updateMask(mask).divide(10000);
}
