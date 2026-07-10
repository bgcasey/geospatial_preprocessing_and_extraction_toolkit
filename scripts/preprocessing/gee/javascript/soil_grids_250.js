/*
 * ---
 * title: SoilGrids 250m v2.0 Layers Export
 * author: Brendan Casey
 * created: 2026-04-16
 * inputs: 
 *   - ISRIC SoilGrids 250m v2.0 mean Images 
 *     (projects/soilgrids-isric/*_mean)
 *   - Alberta boundary (FAO GAUL level1)
 *   - XY points (may include locations outside Alberta)
 * outputs: 
 *   - Multiband SoilGrids image clipped to Alberta, exported
 *     at native (~250 m) and 1000 m resolution.
 *   - Table with point-level extracted soil values for ALL 
 *     points (including those outside the Alberta AOI).
 * notes: 
 *   SoilGrids 250m v2.0 is a globally consistent, data-driven 
 *   system that predicts soil properties at six standard depths 
 *   (0-5, 5-15, 15-30, 30-60, 60-100, 100-200 cm). Each *_mean 
 *   asset is a multiband Image with one band per depth.
 *
 *   Mapped units are integer-scaled; a per-variable conversion 
 *   factor is applied to recover conventional units:
 *     bdod     (cg/cm3)     / 100 -> kg/dm3
 *     cec      (mmol(c)/kg) / 10  -> cmol(c)/kg
 *     cfvo     (cm3/dm3)    / 10  -> cm3/100cm3 (vol %)
 *     clay     (g/kg)       / 10  -> g/100g (%)
 *     nitrogen (cg/kg)      / 100 -> g/kg
 *     phh2o    (pH*10)      / 10  -> pH
 *     sand     (g/kg)       / 10  -> g/100g (%)
 *     silt     (g/kg)       / 10  -> g/100g (%)
 *     soc      (dg/kg)      / 10  -> g/kg
 *     ocd      (hg/dm3)     / 10  -> kg/dm3
 *     ocs      (t/ha)       / 10  -> kg/m2
 *
 *   The 'ocs' (organic carbon stock) asset covers only the 
 *   0-30 cm depth (single band). All other variables retain 
 *   the six-depth structure. Native band names take the form
 *   '<var>_<depth>_mean' (e.g. 'clay_0-5cm_mean').
 *
 *   The base SoilGrids image is built unclipped (global). The 
 *   AOI clip is applied only for raster aggregation and export
 *   so that XY point extraction can return values for points
 *   located anywhere with SoilGrids coverage.
 *
 *   1000 m aggregation uses mean reduction on continuous layers.
 *   setDefaultProjection is required before reduceResolution 
 *   when aggregating by a factor greater than 64.
 *
 *   Citation:
 *   Poggio, L., de Sousa, L. M., Batjes, N. H., Heuvelink, 
 *   G. B. M., Kempen, B., Ribeiro, E., and Rossiter, D.: 
 *   SoilGrids 2.0: producing soil information for the globe 
 *   with quantified spatial uncertainty, SOIL, 7, 217-240, 
 *   https://doi.org/10.5194/soil-7-217-2021, 2021.
 * ---
 */
 
/* 1. Setup
 * User defined parameters and environment setup.
 */
 
// 1.0 Load helper functions
var utils = require(
  "users/bgcasey/science_centre:functions/utils"
);
 
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
var basePath = 'projects/soilgrids-isric/';
 
// 1.3 Define export parameters
var folder = 'gee_exports';
var nativeScale = 250;   // Native resolution (m)
var coarseScale = 1000;  // Aggregated resolution (m)
var crs = 'EPSG:4326';
 
// 1.4 Optional band filter.
// Set to null (or an empty array) to keep all bands. Otherwise 
// provide a list of band names in <variable>_<depth>_mean format.
// Any variable not represented in selectedBands is skipped at load
// time; remaining variables are loaded fully and filtered after.
var selectedBands = [
  'sand_0-5cm_mean',
  'clay_0-5cm_mean',
  'soc_0-5cm_mean',
  'phh2o_0-5cm_mean',
  'cfvo_0-5cm_mean',
  'cec_0-5cm_mean'
];
 
// 1.5 Define SoilGrids variables and their conversion factors.
// Mapped integer values are divided by the conversion factor to 
// recover conventional units (see notes in header).
var variables = [
  {name: 'bdod',     factor: 100},
  {name: 'cec',      factor: 10},
  {name: 'cfvo',     factor: 10},
  {name: 'clay',     factor: 10},
  {name: 'nitrogen', factor: 100},
  {name: 'phh2o',    factor: 10},
  {name: 'sand',     factor: 10},
  {name: 'silt',     factor: 10},
  {name: 'soc',      factor: 10},
  {name: 'ocd',      factor: 10},
  {name: 'ocs',      factor: 10}
];
 
/* 2. Build SoilGrids Image
 * Load each variable, apply its conversion factor, and combine 
 * into a single multiband image. The image is NOT clipped to 
 * AOI here; clipping is applied later only for raster aggregation
 * and export. Point extraction operates on the unclipped image so
 * out-of-AOI points still get values.
 *
 * Native SoilGrids band names already include the variable name 
 * (e.g. 'sand_0-5cm_mean'), so no renaming is needed.
 */
 
/**
 * Load one SoilGrids *_mean asset and rescale to conventional 
 * units. Native band names are preserved. Image is global 
 * (unclipped) and reprojected to EPSG:4326 to avoid sample
 * loss from the native Mollweide projection.
 *
 * @param {string} name - Variable short name (e.g. 'clay').
 * @param {number} factor - Conversion factor (mapped / factor 
 *                          = conventional units).
 * @return {ee.Image} Rescaled, reprojected multiband image
 *                    (global extent, EPSG:4326).
 */
function loadVariable(name, factor) {
  return ee.Image(basePath + name + '_mean')
    .divide(factor)
    .toFloat()
    .reproject({
      crs: 'EPSG:4326',
      scale: 250
    });
}
 
// 2.1 Determine which variables are needed based on selectedBands.
// If the filter is null/empty, load everything; otherwise load only
// variables that contribute to the requested bands.
var useFilter = (selectedBands && selectedBands.length > 0);
var neededVars;
if (useFilter) {
  var varSet = {};
  selectedBands.forEach(function(bn) {
    varSet[bn.split('_')[0]] = true;
  });
  neededVars = variables.filter(function(v) {
    return varSet[v.name] === true;
  });
} else {
  neededVars = variables;
}
 
// 2.2 Combine needed variables into a single multiband image
var soilgrids = loadVariable(
  neededVars[0].name, neededVars[0].factor
);
for (var i = 1; i < neededVars.length; i++) {
  soilgrids = soilgrids.addBands(
    loadVariable(neededVars[i].name, neededVars[i].factor)
  );
}
 
// 2.3 Apply the band filter to trim to exactly the requested bands
if (useFilter) {
  soilgrids = soilgrids.select(selectedBands);
}
 
print('SoilGrids bands:', soilgrids.bandNames());
 
/* 3. Check Bands
 * Visualize representative layers and compute summary stats
 * (within Alberta) to flag any values outside expected ranges.
 */
 
Map.centerObject(aoi, 6);
 
// 3.1 Visualize clay content at 0-5 cm (%)
var clayVis = {
  min: 0,
  max: 60,
  palette: ['#ffffd9', '#edf8b1', '#c7e9b4', '#7fcdbb',
            '#41b6c4', '#1d91c0', '#225ea8', '#0c2c84']
};
// SoilGrids native band names are '<var>_<depth>_mean'
var clayTop = soilgrids.select('clay_0-5cm_mean');
Map.addLayer(clayTop, clayVis, 'Clay 0-5 cm (%)', false);
 
// 3.2 Visualize soil organic carbon at 0-5 cm (g/kg)
var socVis = {
  min: 0,
  max: 100,
  palette: ['#ffffe5', '#f7fcb9', '#d9f0a3', '#addd8e',
            '#78c679', '#41ab5d', '#238443', '#005a32']
};
var socTop = soilgrids.select('soc_0-5cm_mean');
Map.addLayer(socTop, socVis, 'SOC 0-5 cm (g/kg)', false);
 
// 3.3 Print min/max for a subset of bands (computed over AOI)
var sampleBands = [
  'clay_0-5cm_mean',
  'sand_0-5cm_mean',
  'soc_0-5cm_mean',
  'phh2o_0-5cm_mean'
];
sampleBands.forEach(function(band) {
  var stats = soilgrids.select(band).reduceRegion({
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
 
/* 4. Extract SoilGrids values to XY points (batched)
 * Use sampleRegions to extract the pixel value at each XY 
 * location. With ~13M points a single extraction exceeds GEE's 
 * per-tile memory cap, so the points asset is pre-tagged with 
 * a 'batch' column (set in R before upload) and this loop 
 * launches one export task per batch.
 *
 * Each batch exports a separate CSV named 'soilgrids_xy_batchNN'. 
 * Merge the CSVs in R after download.
 *
 * If one batch fails, only that batch needs retrying - the 
 * others are still valid.
 */
 
// 4.1 Load XY points. Asset must contain a 'batch' property
// with integer values in the range [0, nBatches - 1].
var xyPoints = ee.FeatureCollection(
  "projects/ee-bgcasey-abmi/assets/non_abmi_sites_xy_batch"
);
 
/* Test points fallback */
// var xyPoints = ee.FeatureCollection([
//   ee.Feature(ee.Geometry.Point([-113.50, 55.25]), {id: 'pt1', batch: 0}),
//   ee.Feature(ee.Geometry.Point([-113.20, 55.10]), {id: 'pt2', batch: 0}),
//   ee.Feature(ee.Geometry.Point([-112.90, 55.40]), {id: 'pt3', batch: 1})
// ]);
 
// 4.2 Extraction parameters
var extractScale = nativeScale;   // 250 m (use coarseScale for 1 km)
var tileScale = 16;               // higher tileScale -> more tiles, 
                                  // lower per-tile memory.
var nBatches = 100;                // Set to match the number of 
                                  // batches assigned in R.
 
// 4.3 Diagnostic: inspect the batch column to confirm type and 
// value range. If "Distinct batch values" prints strings (e.g. 
// '1', '2', ...) instead of numbers, the column is stored as 
// character and the Filter.eq calls below need to pass strings 
// (see note in section 4.4).
print('Total points:', xyPoints.size());
print('First feature properties:', xyPoints.first());
print(
  'Distinct batch values:',
  xyPoints.aggregate_array('batch').distinct().sort()
);
 
// 4.4 Launch one export task per batch. Loop runs 1..nBatches 
// (inclusive) to match the 1-indexed batch values assigned in R.
//
// If the diagnostic above shows batch as a string, change the 
// filter call to:
//   ee.Filter.eq('batch', ee.Number(b).format())
// or hardcoded strings, e.g.:
//   ee.Filter.eq('batch', String(b))
for (var b = 1; b <= nBatches; b++) {
  var batchPts = xyPoints.filter(ee.Filter.eq('batch', b));
 
  var extracted = soilgrids.sampleRegions({
    collection: batchPts,
    scale: extractScale,
    tileScale: tileScale,
    geometries: false
  });
 
  // Zero-pad batch number to 2 digits for tidy filenames
  var batchStr = ('00' + b).slice(-2);
 
  Export.table.toDrive({
    collection: extracted,
    description: 'soilgrids_xy_batch' + batchStr,
    folder: folder,
    fileNamePrefix: 'soilgrids_xy_batch' + batchStr,
    fileFormat: 'CSV'
  });
}
 
/* 5. Aggregate to 1000 m (Alberta only)
 * Clip to AOI first so aggregation only operates on Alberta 
 * pixels. setDefaultProjection is required before
 * reduceResolution when aggregating by more than a factor of 64.
 */
 
var soilgridsAB = soilgrids.clip(aoi);
 
var soilgrids1km = soilgridsAB
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
 
/* 6. Export Raster Outputs
 * Export native-resolution and 1000 m images (Alberta only) to 
 * Google Drive. Native-resolution exports over Alberta are large; 
 * monitor the Tasks tab and expect substantial processing time.
 */
 
// 6.1 Native resolution (~250 m), Alberta only
Export.image.toDrive({
  image: soilgridsAB,
  description: 'SoilGrids_AB_250m',
  folder: folder,
  fileNamePrefix: 'soilgrids_ab_250m',
  region: aoi,
  scale: nativeScale,
  crs: crs,
  maxPixels: 1e13
});
 
// 6.2 1000 m aggregated, Alberta only
Export.image.toDrive({
  image: soilgrids1km,
  description: 'SoilGrids_AB_1000m',
  folder: folder,
  fileNamePrefix: 'soilgrids_ab_1000m',
  region: aoi,
  scale: coarseScale,
  crs: crs,
  maxPixels: 1e13
});
 
/* End of script */