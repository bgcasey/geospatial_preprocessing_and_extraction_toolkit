<!--
<img src="https://drive.google.com/uc?id=1fgYuG7jpnekZrkoL_PdVUnSiUFBFX-vI" alt="Logo" width="150" style="float: left; margin-right: 10px;">
-->

<img src="https://drive.google.com/uc?id=1szqLViKqTX5C1XF8uV7HbIst0i6Xvv7g" alt="Logo" width="250">


# Geospatial Preprocessing and Extraction Toolkit 

![In Development](https://img.shields.io/badge/Status-In%20Development-yellow)

Here is a collection of scripts and resources designed to streamline geospatial data workflows, from preprocessing raw remote sensing data to extracting relevant features for analysis. This repository focuses on leveraging tools like Google Earth Engine (GEE), and the `terra` and `sf` R packages to handle common geospatial tasks efficiently and reproducibly.

This is a sibling repository to the Science Centre's [Spatial Data Catalog and Management Guide](https://github.com/bgcasey/spatial_data_catalog).

## Features

### **Preprocessing Scripts**
The preprocessing scripts include general functions for preparing raw geospatial data for analysis, including:
- **Spectral Index Calculation**: Compute common vegetation indices (e.g., NDVI, EVI) from satellite imagery.
- **Focal Statistics**: Derive neighborhood-based metrics (e.g., mean, standard deviation) for raster data.
- **Mosaic Creation**: Merge downloaded raster tiles into a single continuous layer.

### **Extraction Vignette**
Instead of reinventing the wheel, this toolkit provides a detailed vignette on how to extract geospatial data using established libraries like `terra` and `sf`. The vignette guides users through:
- Extracting raster values to point locations.
- Summarizing raster data within polygons.
- Getting raster summary statistics.
---
