<!--
<img src="https://drive.google.com/uc?id=1fgYuG7jpnekZrkoL_PdVUnSiUFBFX-vI" alt="Logo" width="150" style="float: left; margin-right: 10px;">
-->

<img src="https://drive.google.com/uc?id=1szqLViKqTX5C1XF8uV7HbIst0i6Xvv7g" alt="Logo" width="300">

# Processing Remote Sensing Data with Google Earth Engine

This vignette describes how to setup GEE and load and run the ABMI Science Centre scripts and helper functions [^1] from within the [Google Earth Engine Code Editor](code.earthengine.google.com). It describes methoids for processing MODIS, Landsat, and Sentinel-2 satellite imagery using Google Earth Engine (GEE). It demonstrates how to calculate vegetation indices, analyze band statistics, visualize data, and export results to Google Drive. 

---


## Table of Contents
- [1. Accessing Google Earth Engine JavaScript Files](#1-accessing-google-earth-engine-javascript-files)
  - [1.1 Adding Scripts to the GEE Code Editor](#11-adding-scripts-to-the-gee-code-editor)
  - [1.2 Editing Scripts](#12-editing-scripts)
  - [1.3 Understanding Script Dependencies](#13-understanding-script-dependencies)
- [2. Landsat Time Series](#2-landsat-time-series)
  - [2.1 Setup](#21-setup)
  - [2.2 Landsat Time Series Processing](#22-landsat-time-series-processing)
  - [2.3 Check Calculated Bands](#23-check-calculated-bands)
  - [2.4 Export Time Series to Google Drive](#24-export-time-series-to-google-drive)
- [3. Sentinel-2 Time Series](#3-sentinel-2-time-series)
  - [3.1 Setup](#31-setup)
  - [3.2 Sentinel-2 Time Series Processing](#32-sentinel-2-time-series-processing)
  - [3.3 Check Calculated Bands](#33-check-calculated-bands)
  - [3.4 Export Sentinel-2 Time Series to Google Drive](#34-export-sentinel-2-time-series-to-google-drive)
- [4. MODIS Annual Land Cover Dynamics (2001-2023)](#4-modis-annual-land-cover-dynamics-2001-2023)
  - [4.1 Setup](#41-setup)
  - [4.2 Load MODIS MCD12Q2 Dataset](#42-load-modis-mcd12q2-dataset)
  - [4.3 Apply Scaling to Dataset](#43-apply-scaling-to-dataset)
  - [4.3 Check Processed Bands](#43-check-processed-bands)
  - [4.4 Export Time Series to Google Drive](#44-export-time-series-to-google-drive)
  
---

# 1. Accessing Google Earth Engine JavaScript Files

JavaScript files for processing Landsat, Sentinel-2, and MODIS imagery can be accessed and used directly in the Google Earth Engine (GEE) Code Editor. The scripts are read-only but can be referenced or copied into your own GEE repositories for modification.

## 1.1 Adding Scripts to the GEE Code Editor

To use the provided scripts, visit the following link:

- [https://code.earthengine.google.com/?accept_repo=users/bgcasey/science_centre](https://code.earthengine.google.com/?accept_repo=users/bgcasey/science_centre)

This will automatically add the repository to your GEE Code Editor under the **Reader** section of the **Scripts** tab. The repository contains:

- `functions/`: Contains helper functions used across multiple scripts for tasks like exporting image collections, calculating indices, and processing images.
- `landsat_time_series.js`: Main script for processing Landsat imagery.
- `sentinel_time_series.js`: Main script for processing Sentinel-2 imagery.
- `modis_time_series.js`: Main script for processing MODIS land cover dynamics.

## 1.2 Editing Scripts

The provided scripts are **read-only**. To modify them:

1. **Copy the Script**: Open the desired script in the GEE Code Editor, select all the code, and copy it.
2. **Create a New Script**: In your GEE Code Editor, click the **Scripts** tab, select **New**, and choose **File**.
3. **Paste the Code**: Paste the copied code into the new script file.
4. **Save to Your Repo**: Save the new script to your own repository for editing and execution.

## 1.3 Understanding Script Dependencies

The main scripts (e.g., `landsat_time_series.js` and `sentinel_time_series.js`) depend on helper functions located in the `functions/` folder. These helper functions are imported at the beginning of each main script. For example:

```javascript
var utils = require("users/bgcasey/science_centre:functions/utils");
var landsatTimeSeries = require("users/bgcasey/science_centre:functions/landsat_time_series");
var landsatIndicesAndMasks = require("users/bgcasey/science_centre:functions/landsat_indices_and_masks");
```

- **`utils`**: Provides utility functions such as `createDateList` for generating date intervals and `exportImageCollection` for exporting images to Google Drive.
- **`landsatTimeSeries`** and **`sentinelTimeSeries`**: Contain the main functions to process Landsat and Sentinel-2 imagery, respectively.
- **`landsatIndicesAndMasks`** and **`sentinelIndicesAndMasks`**: Provide functions to calculate various spectral indices and apply masking for cloud, snow, and other quality filters.

The helper functions all contain descriptions and example code.

## 1.4 Best Practices for Script Management
- **Keep Helper Functions Modular**: When copying scripts into your repository, maintain the folder structure and keep helper functions separate for better organization and easier debugging.
- **Test in Small AOIs First**: If modifying processing parameters or functions, run the scripts on smaller areas of interest (AOIs) to minimize processing time and avoid timeouts.

---


# 2. Landsat Time Series
Below is a simple, step-by-step guide to processing Landsat satellite imagery using Google Earth Engine (GEE) and the landsat_time_series.js script found in [https://code.earthengine.google.com/?accept_repo=users/bgcasey/science_centre](https://code.earthengine.google.com/?accept_repo=users/bgcasey/science_centre). The following code snippets are meant to be copied into the GEE code editor.

## 2.1 Setup

### 2.1.1 Load Helper Functions

Load helper functions to simplify various tasks like date generation, image processing, and exporting results.

- `functions/utils`: Provides utility functions for satellite imagery and various geospatial analyses:

    - **`createDateList`**: Generates a list of dates for time series analysis based on a specified start date, end date, interval, and unit.
    - **`exportImageCollection`**: Exports an image collection to Google Drive, supporting custom file naming and export parameters.
    - **`focalStats`**: Computes focal statistics (e.g., mean) over a specified kernel size, helping to smooth or aggregate spatial data.

- `functions/landsatTimeSeries`: Processes Landsat imagery by harmonizing spectral reflectance values, calculating vegetation indices, and merging results. The script processes Landsat satellite imagery (Landsat 5, 7, 8, and 9), harmonizes spectral reflectance values from different sensors, calculates selected vegetation indices, and merges the results into a single image collection. The process prioritizes using Landsat 5, 8, and 9 over Landsat 7 due to the latter's Scan Line Corrector (SLC) failure.
    
    **Steps performed by the script:**
    
    1. Retrieves and harmonizes Landsat Surface Reflectance (SR) collections for the specified time period and area of interest (AOI).
    2. Combines harmonized Landsat 5, 7, 8, and 9 collections, prioritizing Landsat 5, 8, and 9 over 7.
    3. Processes the combined collection and calculates composites of selected vegetation indices and merges them into a single image collection.
    
    
- `functions/landsatIndicesAndMasks`: This script defines functions to calculate various spectral indices and apply masks to a time-series of Landsat images. The indices include vegetation, moisture, and stress-related indices. Masks are used for cloud, snow, and QA filtering to ensure accurate data analysis. The functions included in this script are automatically called by `functions/landsatTimeSeries.js`
    

```javascript
var utils = require("users/bgcasey/science_centre:functions/utils");
var landsatTimeSeries = require("users/bgcasey/science_centre:functions/landsat_time_series");
var landsatIndicesAndMasks = require("users/bgcasey/science_centre:functions/landsat_indices_and_masks");
```

### 2.1.2 Define Area of Interest (AOI)

This section sets the geographic area for analysis. The time series of Landsat images will be extracted for this region. The following code defines and area of interest around Calling Lake, Alberta, Canada.

```javascript
var aoi = ee.Geometry.Polygon([
  [-113.5, 55.5],  // Top-left corner
  [-113.5, 55.0],  // Bottom-left corner
  [-112.8, 55.0],  // Bottom-right corner
  [-112.8, 55.5]   // Top-right corner
]);
```

### 2.1.3 Create Date List for Time Series

Use the `utils.createDateList` function create a list of starting points for time intervals used to extract a time series of satelite images. The `createDateList` function generates a list of dates at a specified interval, beginning on the provided start date and ending on the end date. 

**Function Arguments:**

- `Date_Start`: The start date of the time series (e.g., `ee.Date('2023-06-01')`).
    
- `Date_End`: The end date of the time series (e.g., `ee.Date('2024-06-01')`).
    
- `interval`: The step size to advance between dates (e.g., 1).
    
- `intervalType`: The unit for the interval (e.g., `'years'`, `'months'`, `'weeks'`).
    

``` js
var dateList = utils.createDateList(
  ee.Date('2020-06-01'), ee.Date('2024-06-01'), 1, 'years'
);
print("Start Dates", dateList);
```
### 2.1.4 Define Reducer Statistic

Specifies how to summarize pixel values over time. Options include 'mean', 'median', 'max', etc.

```javascript
var statistic = 'mean'; // Options: 'mean', 'median', 'max', etc.
```

## 2.2 Landsat Time Series Processing

### 2.2.1 Calculate Spectral Indices

The `landsatTimeSeries.ls_fn` function processes Landsat images and calculates various spectral indices over the dates defined in `var dateList`.

**Function Arguments:**

- `dates`: The list of start dates for each interval in the time series.
    
- `interval`: The number of units to advance for the end date of each interval (e.g., 121 days).
    
- `intervalType`: The type of interval ('days', 'weeks', 'months', 'years').
    
- `aoi`: The area of interest for clipping the processed images.
    
- `selectedIndices`: An array of indices to calculate (e.g., ['NDVI', 'BSI']).
    
- `statistic`: The statistical method to apply for summarizing data ('mean', 'median', 'max').

**Available Spectral Indices:**

- `BSI`: Bare Soil Index

- `DRS`: Distance Red & SWIR
- `DSWI`: Disease Stress Water Index
- `EVI`: Enhanced Vegetation Index
- `GNDVI`: Green Normalized Difference Vegetation Index
- `LAI`: Leaf Area Index
- `NBR`: Normalized Burn Ratio
- `NDMI`: Normalized Difference Moisture Index
- `NDSI`: Normalized Difference Snow Index
- `NDVI`: Normalized Difference Vegetation Index
- `NDWI`: Normalized Difference Water Index
- `SAVI`: Soil Adjusted Vegetation Index
- `SI`: Shadow Index
  
The function harmonizes Landsat 5, 7, 8, and 9 imagery, applies cloud and snow masks, calculates selected indices, and outputs a combined image collection summarized by the specified statistic for each time interval.

For each **start date** in the `dateList`, the function calculates an **end date** by advancing the start date by the specified `interval` and `intervalType`. For example, if the start date is `'2019-06-01'` and the interval is `121` days, the end date will be `'2019-09-30'`. The function then retrieves all Landsat images (from Landsat 5, 7, 8, and 9) within each start-end date range, applies cloud and snow masking, and calculates the selected spectral indices. Each interval is processed independently, producing a **composite image** summarized using the specified `statistic` (e.g., 'mean' or 'median') for the selected indices and raw bands. The result is an image collection where each image represents one processed time interval.
  
```javascript
var ls = landsatTimeSeries.ls_fn(
  dateList, 121, 'days', aoi,
  ['BSI', 'DRS', 'DSWI', 'EVI', 'GNDVI', 'LAI', 'NBR', 'NDMI', 'NDSI', 'NDVI', 'NDWI', 'SAVI', 'SI'],
  statistic
)
  .map(function(image) {
    var filteredBandNames = image.bandNames().filter(ee.Filter.neq('item', 'QA_PIXEL')); // remove QA pixels from output
    return image.select(filteredBandNames).toFloat(); // Ensures consistent data type
  });

//print("Landsat Time Series:", ls);  
```

## 2.3 Check Calculated Bands

Here users can view summary statistics calculated incices and view them in the map viewer window.
### 2.3.1 Check Band Summary Statistics

For each band in the image collection, calculate summary statistics (minimum, maximum, and standard deviation) to ensure values fall within expected ranges.

```js
var reducer = ee.Reducer.min()
  .combine(ee.Reducer.max(), '', true).
  .combine(ee.Reducer.stdDev(), '', true);

var collectionStats = utils.calculateImageCollectionStats(ls, aoi, 1000, 1e13, reducer);
print(collectionStats, "Image Statistics");

// Export statistics to CSV for further review
utils.exportStatsToCSV(collectionStats, 'image_stats');
```

### 2.3.2 Check Band Data Types

Ensure all bands have consistent data types. All bands need to be the same data type  to be exported as multiband rasters.

```js
var image_first = ls.first();
print("Band Names", image_first.bandNames());
print("Band Types", image_first.bandTypes());
```

### 2.3.3 Visualize NDVI

Visualize the NDVI for the first image in the collection.

```js
var ndviVisParams = {
  min: -0.5,
  max: 1.0,
  palette: ['blue', 'white', 'green']
};

var ndvi_first = image_first.select('NDVI');

// Reduce resolution for easier visualization
var ndvi_firstLowRes = ndvi_first.reproject({
  crs: ndvi_first.projection(),
  scale: 2000
});

// Center map on AOI and add NDVI layer
Map.centerObject(aoi, 7);
Map.addLayer(ndvi_first, ndviVisParams, 'NDVI (Low Res)');

// Visualize missing pixels
var missingPixelsMask = ndvi_first.mask().not();
Map.addLayer(missingPixelsMask, {min: 0, max: 1, palette: ['white', 'black']}, 'Missing Pixels');
```


## 2.4 Export Time Series to Google Drive

This section demonstrates how to export each image in the processed collection as multiband GeoTIFFs to Google Drive by using the function `utils.exportImageCollection`.

**Function Arguments:**

- `collection`: The image collection to export.
    
- `aoi`: The area of interest to which images will be clipped.
    
- `folder`: The name of the folder in Google Drive where images will be saved.
    
- `scale`: The spatial resolution of the exported images, in meters.
    
- `crs`: The coordinate reference system for the exported images.
    
- `fileNameFn`: A custom function to generate file names based on image metadata (e.g., year).
    

The function processes each image by:

1. Clipping it to the specified AOI.
    
2. Applying the custom naming convention.
    
3. Exporting it to Google Drive as a multiband GeoTIFF with the specified scale and CRS.

```js
/* Export parameters */
var folder = 'gee_exports';
var scale = 30; // 30-meter resolution
var crs = 'EPSG:4326'; // WGS 84 CRS

/* Define file naming function */
var fileNameFn = function(img) {
  var year = img.get('year').getInfo() || 'unknown';
  return 'landsat_multiband_' + year;
};

/* Export images to Google Drive */
utils.exportImageCollection(ls, aoi, folder, scale, crs, fileNameFn);
```

---

# 3. Sentinel-2 Time Series

Below is a simple, step-by-step guide to processing Sentinel-2 satellite imagery using Google Earth Engine (GEE) and the sentinel_time_series.js script found in https://code.earthengine.google.com/?accept_repo=users/bgcasey/science_centre. The following code snippets are designed to be copied into the GEE code editor for streamlined analysis.

### 3.1 Setup

#### 3.1.1 Load Helper Functions

Load helper functions to simplify tasks like date generation, image processing, and exporting results.

- `functions/utils`: Provides utility functions for satellite imagery and geospatial analyses:
    
    - **`createDateList`**: Generates a list of dates for time series analysis based on a specified start date, end date, interval, and unit.
    - **`exportImageCollection`**: Exports an image collection to Google Drive, supporting custom file naming and export parameters.
    
- `functions/sentinelTimeSeries`: Processes Sentinel-2 imagery by calculating vegetation indices and merging results into a single image collection for a specified period and AOI.
    
    - **Steps performed by the script:**
        
        1. Retrieves the Sentinel-2 collection for the specified date range and AOI.
            
        2. Applies cloud masking to the images.
            
        3. Calculates the selected indices for each image in the collection.
            
        4. Merges the results into a single image collection, providing the median composite for each date range.
        
- `functions/sentinelIndicesAndMasks`: Defines functions to calculate spectral indices and apply masks to Sentinel-2 images. Masks are used for cloud, snow, and QA filtering.
    

```javascript
var utils = require("users/bgcasey/science_centre:functions/utils");
var sentinelTimeSeries = require("users/bgcasey/science_centre:functions/sentinel_time_series");
var sentinelIndicesAndMasks = require("users/bgcasey/science_centre:functions/sentinel_indices_and_masks");
```

####  3.1.2 Define Area of Interest (AOI)

This section sets the geographic area for analysis. The time series of Landsat images will be extracted for this region. The following code defines and area of interest around Calling Lake, Alberta, Canada.

```javascript
var aoi = ee.Geometry.Polygon([
  [-113.5, 55.5],  // Top-left corner
  [-113.5, 55.0],  // Bottom-left corner
  [-112.8, 55.0],  // Bottom-right corner
  [-112.8, 55.5]   // Top-right corner
]);
```

#### 3.1.3 Create Date List for Time Series

Generate a list of start dates for the time intervals used in the time series analysis.

```javascript
var dateList = utils.createDateList(
  ee.Date('2019-06-01'), ee.Date('2020-06-01'), 1, 'years'
);
print("Start Dates", dateList);
```

#### 3.1.4 Define Reducer Statistic

Specify the statistic to summarize pixel values over each time interval.

```javascript
var statistic = 'mean';
```

### 3.2 Sentinel-2 Time Series Processing

Calculate selected spectral indices for each time interval using the `sentinelTimeSeries.s2_fn` function. The `sentinelTimeSeries.s2_fn` function processes Sentinel-2 imagery over a series of time intervals, calculating selected vegetation indices for each period and merging the results into a single image collection.

**Function Arguments:**

- **`dates`** (`Array`): A list of start dates for the time intervals in the time series. Each date marks the beginning of a time window over which Sentinel-2 imagery is processed.
    
- **`interval`** (`number`): The number of units to advance from each start date to define the end of the time interval. For example, if `interval = 121` and `intervalType = 'days'`, each interval will span 121 days.
    
- **`intervalType`** (`string`): The type of time unit for the interval (e.g., `'days'`, `'weeks'`, `'months'`, `'years'`). This determines how the interval is calculated from the start date.
    
- **`aoi`** (`ee.Geometry`): The area of interest for which imagery will be processed and clipped.
    
- **`selectedIndices`** (`Array`): A list of spectral indices to calculate for each image (e.g., `['NDVI', 'EVI']`).
  
  **Available Spectral Indices:**

- `CRE`: Chlorophyll Red Edge Index
- `DRS`: Distance Red & SWIR
- `DSWI`: Disease Stress Water Index
- `EVI`: Enhanced Vegetation Index
- `GNDVI`: Green Normalized Difference Vegetation Index
- `LAI`: Leaf Area Index
- `NBR`: Normalized Burn Ratio
- `NDRE1`, `NDRE2`, `NDRE3`: Normalized Difference Red-Edge Indices
- `NDVI`: Normalized Difference Vegetation Index
- `NDWI`: Normalized Difference Water Index
- `RDI`: Ratio Drought Index

For each **start date** in the `dateList`, the function calculates an **end date** by advancing the start date by the specified `interval` and `intervalType`. For example, if the start date is `'2019-06-01'` and the interval is `121` days, the end date will be `'2019-09-30'`. The function then retrieves all Sentinel-2 images within each start-end date range, applies cloud masking, and calculates the selected indices. Each interval is processed independently, producing a **median composite** of the selected indices and raw bands for that specific period. The final result is an image collection where each image represents one processed time interval.

```javascript
var s2 = sentinelTimeSeries.s2_fn(
  dateList, 121, 'days', aoi,
  ['CRE', 'DRS', 'DSWI', 'EVI', 'GNDVI', 'LAI', 'NBR',
   'NDRE1', 'NDRE2', 'NDRE3', 'NDVI', 'NDWI', 'RDI']
)
.map(function(image) {
  return image.toFloat();
});
```

### 3.3 Check Calculated Bands

#### 3.3.1 Check Band Summary Statistics

```javascript
var image_first = s2.first();
var stats_first = image_first.reduceRegion({
  reducer: ee.Reducer.min()
    .combine(ee.Reducer.max(), '', true)
    .combine(ee.Reducer.stdDev(), '', true),
  geometry: aoi,
  scale: 1000,
  bestEffort: true,
  maxPixels: 1e13
});
print('Summary Statistics for First Image:', stats_first);
```

#### 3.3.2 Check Band Data Types

```javascript
print("Band Names", image_first.bandNames());
print("Band Types", image_first.bandTypes());
```

#### 3.3.3 Visualize NDVI

```javascript
var ndviVisParams = {
  min: -0.1,
  max: 1.0,
  palette: ['blue', 'white', 'green']
};

var ndvi_first = image_first.select('NDVI');
var ndvi_firstLowRes = ndvi_first.reproject({
  crs: ndvi_first.projection(),
  scale: 100
});

Map.centerObject(aoi, 9);
Map.addLayer(ndvi_firstLowRes, ndviVisParams, 'NDVI (Low Res)');
```

### 3.4 Export Sentinel-2 Time Series to Google Drive

Use the `exportImageCollection` function to export each image in the ImageCollection to Google Drive.

**Function Arguments:**

- `collection`: The image collection to export.
- `aoi`: The area of interest for clipping images.
- `folder`: The target folder in Google Drive.
- `scale`: The spatial resolution in meters.
- `crs`: The coordinate reference system for export.
- `fileNameFn`: Function to define custom file names based on im

```javascript
var folder = 'gee_exports';
var scale = 10;
var crs = 'EPSG:4326';

var fileNameFn = function(img) {
  var year = img.get('year').getInfo() || 'unknown';
  return 'sentinel2_multiband_' + year;
};

utils.exportImageCollection(s2, aoi, folder, scale, crs, fileNameFn);
```
---

# 4. MODIS Annual Land Cover Dynamics (2001-2023)

## 4.1 Setup

This section prepares the environment, defines the Area of Interest (AOI), and loads the necessary helper functions.

### 4.1.1 Load Helper Functions

Import the utility functions to assist with tasks such as exporting image collections.

```js
var utils = require("users/bgcasey/science_centre:functions/utils");
```

### 4.1.2 Define Area of Interest (AOI)

Specify the geographic region for analysis. 

```js
var aoi = ee.Geometry.Polygon([
  [-113.5, 55.5],  
  [-113.5, 55.0],  
  [-112.8, 55.0],  
  [-112.8, 55.5]   
]);
```

## 4.2 Load MODIS MCD12Q2 Dataset
   
This section demonstrates how to load and preprocess the MODIS MCD12Q2 dataset for the period 2021–2023.

### 4.2.1 Load and Clip Dataset

The dataset is filtered by date and clipped to the defined AOI. The year is extracted and added as metadata.

```js
var dataset = ee.ImageCollection('MODIS/061/MCD12Q2')
  .filter(ee.Filter.date('2021-01-01', '2023-12-31'))
  .map(function(image) {
    var year = image.date().format('yyyy');
    return image.set('year', year).clip(aoi);
  });
```

### 4.2.2 Apply Scaling Factors to Bands

Scaling factors are applied to selected bands to convert them into meaningful units.
```js
function applyScaling(image) {
  var scaledBands = image
    .select(['EVI_Minimum_1']).multiply(0.0001).rename('EVI_Minimum_1')
    .addBands(image.select(['EVI_Minimum_2']).multiply(0.0001).rename('EVI_Minimum_2'))
    .addBands(image.select(['EVI_Amplitude_1']).multiply(0.0001).rename('EVI_Amplitude_1'))
    .addBands(image.select(['EVI_Amplitude_2']).multiply(0.0001).rename('EVI_Amplitude_2'))
    .addBands(image.select(['EVI_Area_1']).multiply(0.1).rename('EVI_Area_1'))
    .addBands(image.select(['EVI_Area_2']).multiply(0.1).rename('EVI_Area_2'));
    
  return image.addBands(scaledBands, null, true)
              .copyProperties(image, image.propertyNames());
}

dataset = dataset.map(applyScaling);

```

### 4.2.3 Convert Bands to Float32

Ensure all bands are consistent in data type for export.

```js
function convertToFloat(image) {
  return image.toFloat();
}

dataset = dataset.map(convertToFloat);
```


## 4.3 Check Processed Bands

### 4.3.1 Visualize Vegetation Peak Band for 2023

Visualize the `Peak_1` band in the map viewer.

```js
var vegetationPeak = dataset.filter(ee.Filter.date('2023-01-01', '2023-12-31')).select('Peak_1').mosaic();

var vegetationPeakVis = {
  min: 19364,
  max: 19582,
  palette: ['0f17ff', 'b11406', 'f1ff23']
};

Map.setCenter(-113.0, 55.25, 8);
Map.addLayer(vegetationPeak, vegetationPeakVis, 'Vegetation Peak 2023');
```

### 4.3.2 Calculate summary statistics 

Print summary statistics to verify value ranges.

```js
dataset.filter(ee.Filter.date('2023-01-01', '2023-12-31'))
  .mosaic().bandNames().evaluate(function(bands) {
    bands.forEach(function(band) {
      var stats = dataset.filter(ee.Filter.date('2023-01-01', '2023-12-31')).mosaic().select(band).reduceRegion({
        reducer: ee.Reducer.minMax(),
        geometry: aoi,
        scale: 500,
        maxPixels: 1e13
      });
      stats.evaluate(function(result) {
        print(band + ' Min and Max (2023):', result);
      });
    });
  });
```

## 4.4 Export Time Series to Google Drive

This section shows how to export each annual image as a multiband GeoTIFF to Google Drive.

### 4.4.1 Define Export Parameters

```js
var folder = 'gee_exports';
var scale = 500;
var crs = 'EPSG:4326';
```

### 4.4.2 Define File Naming Function

Create custom file names based on the image year.

```js
var fileNameFn = function(img) {
  var year = img.date().format('yyyy').getInfo();
  return 'MODIS_MCD12Q2_' + year;
};
```

####  4.4.3 Export Image Collection

```js
utils.exportImageCollection(dataset, aoi, folder, scale, crs, fileNameFn);
```

---

[^1]: The Google Earth Engine JavaScript files can be added directly to your Google Earth Engine Code Editor using [https://code.earthengine.google.com/?accept_repo=users/bgcasey/science_centre](https://code.earthengine.google.com/?accept_repo=users/bgcasey/science_centre).

