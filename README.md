<!--
<img src="https://drive.google.com/uc?id=1fgYuG7jpnekZrkoL_PdVUnSiUFBFX-vI" alt="Logo" width="150" style="float: left; margin-right: 10px;">
-->

<img src="https://drive.google.com/uc?id=1szqLViKqTX5C1XF8uV7HbIst0i6Xvv7g" alt="Logo" width="300">

</br>

# Geospatial Preprocessing and Extraction Toolkit 

![In Development](https://img.shields.io/badge/Status-In%20Development-yellow) 
![Languages](https://img.shields.io/badge/Languages-R%20%7C%20GEE%20JavaScript-blue)


Here is a collection of scripts and resources designed to streamline geospatial data workflows, from preprocessing raw remote sensing data to extracting relevant features for analysis. This repository focuses on leveraging tools like Google Earth Engine (GEE), and the `terra` and `sf` R packages to handle common geospatial tasks efficiently and reproducibly.

This is a sibling repository to the Science Centre's [Spatial Data Catalog and Management Guide](https://github.com/bgcasey/spatial_data_catalog).

## Features

### **Preprocessing Scripts**
Preprocessing scripts include general functions for preparing raw geospatial data for analysis, including:
- **Spectral Index Calculation**: Compute common vegetation indices (e.g., NDVI, EVI) from satellite imagery.
- **Focal Statistics**: Derive neighborhood-based metrics (e.g., mean, standard deviation) for raster data.
- **Mosaic Creation**: Merge downloaded raster tiles into a single continuous layer.

### **Extraction Vignette**
Here is a [vignette](geospatial_extraction.md) for extracting geospatial data using established libraries like `terra` and `sf`. The vignette guides users through:
- Extracting raster values to point locations.
- Summarizing raster data within polygons.
- Getting raster summary statistics.
---

## Contents
| File | Description |
|------|-------------|
| **Google Earth Engine** [^1] | |
| [functions](https://github.com/bgcasey/geospatial_preprocessing_and_extraction_toolkit/tree/main/scripts/preprocessing/gee/functions) | Various utility functions. |
| [.gee_git_clone.sh](https://github.com/bgcasey/geospatial_preprocessing_and_extraction_toolkit/blob/main/scripts/preprocessing/gee/.gee_git_clone.sh) | Script to clone a GEE repository to a local directory. |
| [global_geomorphometric_layers.js](https://github.com/bgcasey/geospatial_preprocessing_and_extraction_toolkit/blob/main/scripts/preprocessing/gee/global_geomorphometric_layers.js) | Loads geomorphometric layers from the Geomorpho90m dataset, mosaics them, clips them to a specified area of interest (AOI), and combines them into a single multiband image.|
| [hydrologically_adjusted_elevation.js](https://github.com/bgcasey/geospatial_preprocessing_and_extraction_toolkit/blob/main/scripts/preprocessing/gee/hydrologically_adjusted_elevation.js) | Extracts the hydrologically adjusted elevations (Height Above Nearest Drainage - HAND) from the MERIT Hydro dataset. |
| [landsat_time_series.js](https://github.com/bgcasey/geospatial_preprocessing_and_extraction_toolkit/blob/main/scripts/preprocessing/gee/landsat_time_series.js) | Generates a time series of Landsat satellite imagery, calculates user-defined spectral indices, and outputs results as multiband images. |
| [modis_land_cover_dynamics.js](https://github.com/bgcasey/geospatial_preprocessing_and_extraction_toolkit/blob/main/scripts/preprocessing/gee/modis_land_cover_dynamics.js) | Extracts all bands from the MODIS MCD12Q2 dataset for a given time period and AOI.|
| [nrcan_topographic_indices.js](https://github.com/bgcasey/geospatial_preprocessing_and_extraction_toolkit/blob/main/scripts/preprocessing/gee/nrcan_topographic_indices.js) | Calculates terrain metrics including slope, aspect, and northness using the NRCan/CDEM dataset.|
| [sentinel2_time_series.js](https://github.com/bgcasey/geospatial_preprocessing_and_extraction_toolkit/blob/main/scripts/preprocessing/gee/sentinel2_time_series.js) | Generates a time series of Sentinel-2 satellite imagery, calculates user-defined spectral indices, and outputs results as multiband images.|
| [topographic_wetness_index.js](https://github.com/bgcasey/geospatial_preprocessing_and_extraction_toolkit/blob/main/scripts/preprocessing/gee/topographic_wetness_index.js) | Calculates the Topographic Wetness Index (TWI) using the MERIT Hydro dataset. The index is derived as ln(α/tanβ), where α is the upslope area and β is the slope. |
| **R** | |
| [mosaic_raster_time_series.R](https://github.com/bgcasey/geospatial_preprocessing_and_extraction_toolkit/blob/main/scripts/preprocessing/r/mosaic_raster_time_series.R) | Mosaics a time series of tiled raster files. |
| [mosaic_rasters.R](https://github.com/bgcasey/geospatial_preprocessing_and_extraction_toolkit/blob/main/scripts/preprocessing/r/mosaic_rasters.R) | Functions to mosaic rasters from a directory or a list of files. |

---


[^1]: The Google Earth Engine JavaScript files can be added directly to your Google Earth Engine Code Editor using [https://code.earthengine.google.com/?accept_repo=users/bgcasey/science_centre](https://code.earthengine.google.com/?accept_repo=users/bgcasey/science_centre).


