/*
 * ---
 * title: HiHydroSoil v2.0 Layers Export
 * author: Brendan Casey
 * created: 2026-04-16
 * inputs: 
 *   - HiHydroSoil v2.0 ImageCollections (FutureWater / sat-io)
 *   - Hydrologic_Soil_Group_250m Image (FutureWater / sat-io)
 *   - Alberta boundary (FAO GAUL level1)
 * outputs: 
 *   - Multiband HiHydroSoil images clipped to Alberta, 
 *     exported at native (~250 m) and 1000 m resolution.
 * notes: 
 *   HiHydroSoil v2.0 provides global soil hydraulic properties 
 *   at 250 m, derived from SoilGrids250m v2.0 by FutureWater. 
 *   Most continuous layers are stored as int16 * 10000 and are 
 *   rescaled to physical units by multiplying by 0.0001. The
 *   Soil Texture Class (stc) and Hydrologic Soil Group (HSG) 
 *   layers are categorical and are exported without rescaling. 
 *
 *   Most assets are ImageCollections representing the six 
 *   standard soil depths. They are collapsed to a multiband 
 *   image using .toBands(), producing band names of the form 
 *   <index>_<asset>. The Hydrologic_Soil_Group_250m asset is
 *   a single Image.
 *
 *   1000 m exports use ee.Reducer.mean() for continuous layers
 *   and ee.Reducer.mode() for categorical layers (STC, HSG) to 
 *   avoid producing meaningless averages of class codes.
 *
 *   Citation:
 *   Simons, G.W.H., R. Koster, P. Droogers. 2020. HiHydroSoil 
 *   v2.0 - A high resolution soil map of global hydraulic 
 *   properties. FutureWater Report 213.
 * ---
 */

/* 1. Setup
 * User defined parameters and environment setup.
 */

// 1.1 Define Area of Interest (AOI)
var aoi = ee.FeatureCollection('FAO/GAUL_SIMPLIFIED_500m/2015/level1')
  .filter(ee.Filter.eq('ADM0_NAME', 'Canada'))
  .filter(ee.Filter.eq('ADM1_NAME', 'Alberta'))
  .geometry();

/* Small aoi for testing purposes */
// var aoi = ee.Geometry.Polygon([
//   [-113.5, 55.5],
//   [-113.5, 55.0],
//   [-112.8, 55.0],
//   [-112.8, 55.5]
// ]);

// 1.2 Define the base path
var basePath = 'projects/sat-io/open-datasets/HiHydroSoilv2_0/';

// 1.3 Define export parameters
var folder = 'gee_exports';
var nativeScale = 250;   // Native resolution (m)
var coarseScale = 1000;  // Aggregated resolution (m)
var crs = 'EPSG:4326';   // Alternative: 'EPSG:3400' (AB 10-TM)

// 1.4 Optional asset filter.
// Set to null (or an empty array) to keep all assets. Otherwise 
// provide a list of asset short names from continuousCollections 
// and/or categoricalCollections (e.g. ['ksat'], ['ksat', 'wcsat'],
// ['stc']). Assets not listed here are skipped at load time.
var selectedAssets = ['ksat'];

// 1.4b Optional depth filter (per-image, applies to ImageCollection
// assets only). HiHydroSoil collections contain one image per soil 
// depth (and aggregated topsoil/subsoil layers). The exact 
// system:index for each image is provider-specific and not 
// documented in the catalog page. Section 2.5 prints the available
// system:index values for every selected asset so you can copy the
// correct strings into depthFilter on a follow-up run.
//
// Set to null to keep all images in each collection. Otherwise 
// provide a list of system:index strings to keep, e.g. for the 
// 0-5 cm depth you might use a value like ['ksat_0-5'] (replace 
// once you have inspected the printout).
var depthFilter = ["Ksat_0-5cm_M_250m"];

// 1.5 Define continuous (float) ImageCollection assets.
// These are rescaled by multiplying with 0.0001.
var continuousCollections = [
  'alpha',       // Mualem-van Genuchten alpha (1/cm)
  'crit-wilt',   // Water content pF3 - pF4.2 (m3/m3)
  'field-crit',  // Water content pF2 - pF3 (m3/m3)
  'ksat',        // Saturated hydraulic conductivity (cm/d)
  'N',           // Mualem-van Genuchten N (-)
  'ormc',        // Organic matter content (%)
  'sat-field',   // Water content sat - pF2 (m3/m3)
  'wcavail',     // Available water content (m3/m3)
  'wcpf2',       // Water content at pF2 (m3/m3)
  'wcpf3',       // Water content at pF3 (m3/m3)
  'wcpf4-2',     // Water content at pF4.2 (m3/m3)
  'wcres',       // Residual water content (m3/m3)
  'wcsat'        // Saturated water content (m3/m3)
];

// 1.6 Define categorical ImageCollection assets.
// These are NOT rescaled and use mode() for aggregation.
var categoricalCollections = [
  'stc'  // Soil Texture Class (1-6)
];

// 1.7 Apply filter to the asset lists. Empty/null = no filter.
// The Hydrologic_Soil_Group asset is loaded separately (see 2.3)
// because it is a single Image rather than an ImageCollection. 
// To include it in the filter, use the name 'hydrologic_soil_group'.
var useFilter = (selectedAssets && selectedAssets.length > 0);
var includeHSG = true;
if (useFilter) {
  continuousCollections = continuousCollections.filter(function(name) {
    return selectedAssets.indexOf(name) !== -1;
  });
  categoricalCollections = categoricalCollections.filter(function(name) {
    return selectedAssets.indexOf(name) !== -1;
  });
  includeHSG = (selectedAssets.indexOf('hydrologic_soil_group') !== -1);
}

/* 2. Build HiHydroSoil Image
 * Process each collection into a multiband image, rescale 
 * continuous layers, then combine all layers into a single 
 * multiband image.
 */

/**
 * Load an ImageCollection, optionally filter by system:index,
 * collapse to a multiband image, and assign clean band names.
 * Note: the image is NOT clipped to AOI here. Clipping is 
 * applied later only for raster exports; XY extraction operates
 * on the unclipped image so points outside Alberta still get 
 * values.
 *
 * Band naming rules:
 *  - When indexFilter is applied, each band is renamed to the 
 *    system:index of its source image (e.g. 'Ksat_M_250m_0-5cm').
 *  - When no filter is applied, bands are renamed to 
 *    '<assetName>_<systemIndex>' (e.g. 'ksat_Ksat_M_250m_0-5cm')
 *    to disambiguate across multiple assets.
 * The trailing '_b1' that toBands() inserts for single-band images
 * is stripped in both cases.
 *
 * @param {string} assetName - Short asset name (e.g. 'ksat').
 * @param {Array<string>|null} indexFilter - Optional list of 
 *   system:index strings to keep. If null, all images are kept.
 * @return {ee.Image} Multiband image (global extent).
 */
function collectionToImage(assetName, indexFilter) {
  var ic = ee.ImageCollection(basePath + assetName);
  var hasFilter = (indexFilter && indexFilter.length > 0);
  if (hasFilter) {
    ic = ic.filter(ee.Filter.inList('system:index', indexFilter));
  }
  // toBands() creates bands named '<system:index>_<origBand>'.
  var img = ic.toBands();
  // Strip the trailing '_b1' that toBands appends for single-band 
  // source images, then optionally prefix with the asset name.
  var bandNames = img.bandNames().map(function(bn) {
    var stripped = ee.String(bn).replace('_b1$', '');
    if (hasFilter) {
      return stripped;  // Use system:index as-is (already meaningful)
    }
    return ee.String(assetName).cat('_').cat(stripped);
  });
  return img.rename(bandNames);
}

// 2.1 Process continuous collections (rescale by 0.0001).
// Images are NOT clipped here; clipping is applied per-export.
var continuousImages = continuousCollections.map(function(name) {
  return collectionToImage(name, depthFilter)
    .multiply(0.0001)
    .toFloat();
});

// 2.2 Process categorical collections (no rescale, Int16)
var categoricalImages = categoricalCollections.map(function(name) {
  return collectionToImage(name, depthFilter).toInt16();
});

// 2.3 Load Hydrologic Soil Group (single Image, categorical), 
// only if it passed the asset filter. Not clipped here.
var hsg = null;
if (includeHSG) {
  hsg = ee.Image(basePath + 'Hydrologic_Soil_Group_250m')
    .rename('hydrologic_soil_group')
    .toInt16();
}

// 2.4 Combine into continuous and categorical multiband images. 
// Either group may be empty after filtering; downstream sections
// guard against this with hasContinuous / hasCategorical flags.
var hasContinuous = (continuousImages.length > 0);
var hasCategorical = (categoricalImages.length > 0 || hsg !== null);

var hihydroContinuous = null;
if (hasContinuous) {
  hihydroContinuous = ee.Image(continuousImages[0]);
  for (var i = 1; i < continuousImages.length; i++) {
    hihydroContinuous = hihydroContinuous.addBands(continuousImages[i]);
  }
}

var hihydroCategorical = null;
if (hasCategorical) {
  if (categoricalImages.length > 0) {
    hihydroCategorical = ee.Image(categoricalImages[0]);
    for (var j = 1; j < categoricalImages.length; j++) {
      hihydroCategorical = hihydroCategorical.addBands(categoricalImages[j]);
    }
    if (hsg !== null) {
      hihydroCategorical = hihydroCategorical.addBands(hsg);
    }
  } else if (hsg !== null) {
    hihydroCategorical = hsg;
  }
}

if (hasContinuous) {
  print('HiHydroSoil Continuous bands:', hihydroContinuous.bandNames());
}
if (hasCategorical) {
  print('HiHydroSoil Categorical bands:', hihydroCategorical.bandNames());
}

// 2.5 Inspect collection contents (system:index values).
// Print the system:index of every image in each selected 
// collection. Use this output to populate `depthFilter` in 
// Section 1.4b on a follow-up run if you want to keep only 
// specific depth(s).
var assetsToInspect = continuousCollections.concat(categoricalCollections);
assetsToInspect.forEach(function(name) {
  var ic = ee.ImageCollection(basePath + name);
  ic.aggregate_array('system:index').evaluate(function(ids) {
    print(name + ' system:index values:', ids);
  });
});

/* 3. Check Bands
 * Visualize a representative layer and compute summary stats
 * to flag any values outside expected ranges. Visualizations 
 * adapt to whichever assets passed the filter.
 */

Map.centerObject(aoi, 6);

// 3.1 Visualize first continuous band (representative example)
if (hasContinuous) {
  var firstContBand = ee.String(
    hihydroContinuous.bandNames().get(0)
  );
  // Generic palette; min/max are placeholders. Refine after 
  // checking the printed stats below for your selected variable.
  var contVis = {
    palette: ['#ffffcc', '#a1dab4', '#41b6c4', '#2c7fb8', '#253494']
  };
  // Use evaluate to dereference the band name client-side
  firstContBand.evaluate(function(bn) {
    Map.addLayer(
      hihydroContinuous.select(bn), 
      contVis, 
      'Continuous: ' + bn, 
      false
    );
  });
}

// 3.2 Visualize Hydrologic Soil Group (only if loaded)
if (hsg !== null) {
  var hsgVis = {
    min: 1,
    max: 34,
    palette: ['#1a9850', '#91cf60', '#fee08b', '#fc8d59',
              '#d73027', '#a50026', '#4575b4']
  };
  Map.addLayer(hsg, hsgVis, 'Hydrologic Soil Group', false);
}

// 3.3 Print min/max for all continuous bands (or skip if none)
if (hasContinuous) {
  hihydroContinuous.bandNames().evaluate(function(bands) {
    bands.forEach(function(band) {
      var stats = hihydroContinuous.select(band).reduceRegion({
        reducer: ee.Reducer.minMax(),
        geometry: aoi,
        scale: 1000,
        maxPixels: 1e13,
        bestEffort: true,
        tileScale: 4
      });
      stats.evaluate(function(result) {
        print(band + ' Min and Max:', result);
      });
    });
  });
}

var hh = ee.Image('projects/sat-io/open-datasets/HiHydroSoilv2_0/ksat/Ksat_0-5cm_M_250m');
print('HiHydroSoil projection:', hh.projection());

/* 4. Extract HiHydroSoil values to XY points (batched)
 * Use sampleRegions to extract the pixel value at each XY 
 * location. With large point sets a single extraction exceeds 
 * GEE's per-tile memory cap, so the points asset is pre-tagged 
 * with a 'batch' column (set in R before upload) and this loop 
 * launches one export task per batch.
 *
 * At bufferSize = 0 there is no reducer distinction between 
 * continuous and categorical layers - sampleRegions just reads 
 * the pixel value. Continuous and categorical multiband stacks 
 * are therefore merged into a single image and extracted in one 
 * set of export tasks. CSV columns inherit the image's native 
 * band names.
 *
 * Each batch exports a separate CSV named 
 * 'hihydrosoil_xy_batchNN'. Merge the CSVs in R after download.
 * If one batch fails, only that batch needs retrying.
 */

// 4.1 Load XY points. Asset must contain a 'batch' property with
// integer values matching the loop range below (see nBatches).
var xyPoints = ee.FeatureCollection(
  "projects/ee-bgcasey-abmi/assets/non_abmi_sites_xy_batch"
);

/* Test points fallback */
// var xyPoints = ee.FeatureCollection([
//   ee.Feature(ee.Geometry.Point([-113.50, 55.25]), {id: 'pt1', batch: 1}),
//   ee.Feature(ee.Geometry.Point([-113.20, 55.10]), {id: 'pt2', batch: 1}),
//   ee.Feature(ee.Geometry.Point([-112.90, 55.40]), {id: 'pt3', batch: 2})
// ]);

// 4.2 Extraction parameters
var extractScale = nativeScale;   // 250 m (use coarseScale for 1 km)
var tileScale = 16;               // higher tileScale -> more tiles, 
                                  // lower per-tile memory.
var nBatches = 50;                // Set to match the number of 
                                  // batches assigned in R.

// 4.3 Combine continuous and categorical stacks into a single 
// extraction image. Either group may be empty after filtering 
// in Section 1; guard against that.
var hihydroCombined = null;
if (hasContinuous && hasCategorical) {
  hihydroCombined = hihydroContinuous.addBands(hihydroCategorical);
} else if (hasContinuous) {
  hihydroCombined = hihydroContinuous;
} else if (hasCategorical) {
  hihydroCombined = hihydroCategorical;
}

// 4.4 Diagnostic: inspect the batch column. If 'Distinct batch 
// values' prints strings (e.g. '1','2',...) instead of numbers, 
// the column is stored as character and the Filter.eq calls 
// below need to pass strings (see note in section 4.5).
print('Total points:', xyPoints.size());
print('First feature properties:', xyPoints.first());
print(
  'Distinct batch values:',
  xyPoints.aggregate_array('batch').distinct().sort()
);

// 4.5 Launch one export task per batch. Loop runs 1..nBatches 
// (inclusive) to match the 1-indexed batch values assigned in R.
//
// If the diagnostic above shows batch as a string, change the 
// filter call to:
//   ee.Filter.eq('batch', ee.Number(b).format())
// or hardcoded strings, e.g.:
//   ee.Filter.eq('batch', String(b))
if (hihydroCombined !== null) {
  for (var b = 1; b <= nBatches; b++) {
    var batchPts = xyPoints.filter(ee.Filter.eq('batch', b));

    var extracted = hihydroCombined.sampleRegions({
      collection: batchPts,
      scale: extractScale,
      tileScale: tileScale,
      geometries: false
    });

    // Zero-pad batch number to 2 digits for tidy filenames
    var batchStr = ('00' + b).slice(-2);

    Export.table.toDrive({
      collection: extracted,
      description: 'hihydrosoil_xy_batch' + batchStr,
      folder: folder,
      fileNamePrefix: 'hihydrosoil_xy_batch' + batchStr,
      fileFormat: 'CSV'
    });
  }

  // 4.6 Print first rows of batch 1 for sanity check
  var batch1 = xyPoints.filter(ee.Filter.eq('batch', 1));
  print(
    'Batch 1 sample extraction (first 5):',
    hihydroCombined.sampleRegions({
      collection: batch1.limit(5),
      scale: extractScale,
      tileScale: tileScale,
      geometries: false
    })
  );
}

/* 5. Aggregate to 1000 m (Alberta only)
 * Clip to AOI first so aggregation and export only operate on
 * Alberta pixels. setDefaultProjection is required before 
 * reduceResolution when aggregating by more than a factor of 64.
 * Either group is skipped if no assets passed the filter.
 */

var hihydroContinuousAB = null;
var hihydroCategoricalAB = null;
var hihydroContinuous1km = null;
var hihydroCategorical1km = null;

// 5.1 Continuous: clip to AB and aggregate to 1 km (mean)
if (hasContinuous) {
  hihydroContinuousAB = hihydroContinuous.clip(aoi);
  hihydroContinuous1km = hihydroContinuousAB
    .setDefaultProjection({
      crs: crs,
      scale: nativeScale
    })
    .reduceResolution({
      reducer: ee.Reducer.mean(),
      maxPixels: 1024
    })
    .reproject({
      crs: crs,
      scale: coarseScale
    })
    .toFloat();
}

// 5.2 Categorical: clip to AB and aggregate to 1 km (mode)
if (hasCategorical) {
  hihydroCategoricalAB = hihydroCategorical.clip(aoi);
  hihydroCategorical1km = hihydroCategoricalAB
    .setDefaultProjection({
      crs: crs,
      scale: nativeScale
    })
    .reduceResolution({
      reducer: ee.Reducer.mode(),
      maxPixels: 1024
    })
    .reproject({
      crs: crs,
      scale: coarseScale
    })
    .toInt16();
}

/* 6. Export Raster Outputs
 * Export native-resolution and 1000 m images to Google Drive.
 * Note: these are large exports (especially native-resolution 
 * continuous). Monitor the Tasks tab and expect substantial
 * processing time. Either group is skipped if no assets passed
 * the filter.
 */

if (hasContinuous) {
  // 6.1 Continuous layers - native resolution (~250 m)
  Export.image.toDrive({
    image: hihydroContinuousAB,
    description: 'HiHydroSoil_Continuous_AB_250m',
    folder: folder,
    fileNamePrefix: 'hihydrosoil_continuous_ab_250m',
    region: aoi,
    scale: nativeScale,
    crs: crs,
    maxPixels: 1e13
  });

  // 6.2 Continuous layers - 1000 m
  Export.image.toDrive({
    image: hihydroContinuous1km,
    description: 'HiHydroSoil_Continuous_AB_1000m',
    folder: folder,
    fileNamePrefix: 'hihydrosoil_continuous_ab_1000m',
    region: aoi,
    scale: coarseScale,
    crs: crs,
    maxPixels: 1e13
  });
}

if (hasCategorical) {
  // 6.3 Categorical layers - native resolution (~250 m)
  Export.image.toDrive({
    image: hihydroCategoricalAB,
    description: 'HiHydroSoil_Categorical_AB_250m',
    folder: folder,
    fileNamePrefix: 'hihydrosoil_categorical_ab_250m',
    region: aoi,
    scale: nativeScale,
    crs: crs,
    maxPixels: 1e13
  });

  // 6.4 Categorical layers - 1000 m
  Export.image.toDrive({
    image: hihydroCategorical1km,
    description: 'HiHydroSoil_Categorical_AB_1000m',
    folder: folder,
    fileNamePrefix: 'hihydrosoil_categorical_ab_1000m',
    region: aoi,
    scale: coarseScale,
    crs: crs,
    maxPixels: 1e13
  });
}

/* End of script */