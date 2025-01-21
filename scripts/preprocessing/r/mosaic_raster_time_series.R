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
library(parallel)
source("scripts/preprocessing/r/mosaic_rasters_functions.R")

# Set a custom temporary directory for terra
# terraOptions(tempdir = "D:/r_temp")

## 1.2 Define input and output directories ----
# Input directory containing raster files.
input_directory <- "X:/samba/abmisc/spatial_data/temp/landsat_summer_mean_indices_2000_2024"
# input_directory <- "X:/samba/abmisc/spatial_data/temp/test"

# Output directory to save mosaicked rasters.
output_directory <- "X:/samba/abmisc/spatial_data/imageryBaseMapsEarthCover/landsat_summer_mean_indices_2000_2024/"
if (!dir.exists(output_directory)) {
  dir.create(output_directory, recursive = TRUE)
}

# Define output file prefix
output_file_prefix <- "landsat_summer_mean_"

## 1.3 Set up parallel processing ----
# check the number of cores available
detectCores()

# Set the number of cores
num_cores <- 9 

# Create a cluster
cl <- makeCluster(num_cores)

# Load required libraries on each worker
clusterEvalQ(cl, {
  library(terra)  # Load terra package
})

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

## 2.3 Export necessary variables and functions to the cluster ----
clusterExport(cl, c("raster_files", 
                    "output_directory", 
                    "output_file_prefix",
                    "mosaic_rasters_in_list"))

## 2.4 Parallel loop to mosaic rasters ----
# Define a function for mosaicking by year to be run in parallel.
mosaic_by_year <- function(year) {
 
  ### 2.4.1 Filter raster files for the current year ----
  year_files <- raster_files[grepl(
    paste0("_", year, "-"),
    basename(raster_files)
  )]
  
  # Skip processing if no files are found for the year.
  if (length(year_files) == 0) {
    return(NULL)
  }
  
  ### 2.4.2 Define output filename for the mosaic ----
  export_filename <- file.path(
    output_directory,
    paste0(output_file_prefix, year, ".tif")
  )
  
  ### 2.4.3 Mosaic raster files ----
  # Call the mosaic function to create the raster mosaic.
  mosaic <- mosaic_rasters_in_list(
    raster_files = year_files,
    export_filename = export_filename,
    fun = "mean"
  )
  
  ### 2.4.4 Return progress message ----
  return(paste("Mosaic for year", year, "saved to:", export_filename))
}

# Use parallel processing to apply the function to each year.
parLapply(cl, years, mosaic_by_year)

# Stop the cluster
stopCluster(cl)

# End of script ----

