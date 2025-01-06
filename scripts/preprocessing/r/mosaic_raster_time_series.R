# ---
# title: Mosaic Rasters by Year
# author: Brendan Casey
# created: 2025-01-06
# inputs: 
#   - Directory with a time series of tiled rasters
# outputs: 
#   - Annual raster mosaics
# notes: 
#   This script mosaics annual tiled raster files. 
#   It takes raster files from the input directory, groups them by 
#   year based on filenames, and produces mosaics for each year in 
#   the output directory
# ---

# 1. Setup ----

## 1.1 Load required packages and functions ----
library(terra)
source("scripts/preprocessing/r/mosaic_rasters.R")

## 1.2 Define input and output directories ----
# Input directory containing raster files.
input_directory <- "X:/samba/abmisc/spatial_data/temp/sentinel2_summer_mean_indices_2019_2024"

# Output directory to save mosaicked rasters.
output_directory <- "X:/samba/abmisc/spatial_data/imageryBaseMapsEarthCover/sentinel2_summer_mean_indices_2019_2024/"
if (!dir.exists(output_directory)) {
  dir.create(output_directory, recursive = TRUE)
}

# Define output file prefix
output_file_prefix <- "sentinel2_mosaic_"

#

# 2. Process and mosaic rasters ----
# This section processes raster files by year, grouping 
# them based on unique year identifiers in filenames, and creates 
# yearly mosaics saved as GeoTIFF files.

## 2.1 List raster files ----
# List all `.tif` files from the input directory.
raster_files <- list.files(
  input_directory,
  pattern = "\\.tif$",
  full.names = TRUE
)

## 2.2 Extract unique years from filenames ----
years <- unique(
  sub(".*_(\\d{4})-.*", "\\1", basename(raster_files))
)

## 2.3 Loop through years and create mosaics ----
for (year in years) {
  
  ### 2.3.1 Filter raster files for the current year ----
  year_files <- raster_files[grepl(
    paste0("_", year, "-"),
    basename(raster_files)
  )]
  
  # Skip processing if no files are found for the year.
  if (length(year_files) == 0) {
    next
  }
  
  ### 2.3.2 Define output filename for the mosaic ----
  export_filename <- file.path(
    output_directory,
    paste0(output_file_prefix, year, ".tif")
  )
  
  ### 2.3.3 Mosaic raster files ----
  # Call the mosaic function to create the raster mosaic.
  mosaic <- mosaic_rasters_in_list(
    raster_files = year_files,
    export_filename = export_filename,
    fun = "mean"
  )
  
  ### 2.3.4 Print progress ----
  # Log the progress of the mosaicking process.
  cat("Mosaic for year", year, "saved to:", export_filename, "\n")
}

# End of script ----
