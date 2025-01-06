
#' Mosaic Rasters
#'
#' This function creates a mosaic from all raster files (`.tif`) located 
#' in a specified directory. It saves the resulting mosaic to a file.
#'
#' @param path_name Character. Path to the directory containing raster files.
#' @param export_filename Character. Full path where the resulting mosaic 
#' raster will be saved.
#' @param fun Character. Function to use for aggregating overlapping 
#' raster values in the mosaic (e.g., "mean", "sum"). Defaults to 
#' "mean".
#'
#' @return A `SpatRaster` object representing the created mosaic.
#'
#' @details This function requires the following R packages:
#'          - terra
#'          
#' # Example usage of the function
#' 
#' source("scripts/preprocessing/r/mosaic_rasters.R")
#' 
#' mosaic <- mosaic_rasters(
#'   path_name = "X:/samba/abmisc/spatial_data/temp/",
#'   export_filename = "X:/samba/abmisc/spatial_data/landsat/"
#'     "all_landsat.tif",
#'   fun = "mean"
#' )
#' print(mosaic)
#' 
mosaic_rasters_in_directory <- function(path_name, export_filename, fun = "mean") {
  # Ensure the path ends with a slash
  if (!endsWith(path_name, "/")) {
    path_name <- paste0(path_name, "/")
  }
  
  # Step 1: List all .tif files in the specified directory
  fl <- list.files(path = path_name, pattern = '\\.tif$', 
                   recursive = TRUE, full.names = TRUE)
  
  # Step 2: Check if any .tif files are found
  if (length(fl) == 0) {
    stop("No .tif files found in the specified directory.")
  }
  
  # Step 3: Create a SpatRasterCollection from the .tif files
  rsrc <- terra::sprc(fl)
  
  # Step 4: Create a mosaic using the specified aggregation function
  m <- terra::mosaic(rsrc, fun = fun)
  
  # Step 5: Clear rasters from memory
  rm(rsrc)
  gc() # Run garbage collection to ensure memory is freed
  
  # Step 6: Write the mosaic to the specified export filename
  terra::writeRaster(m, filename = export_filename, 
                     overwrite = TRUE)
  
  # Step 7: Return the created mosaic
  return(m)
}


#' Mosaic Rasters from a List of Files
#'
#' This function creates a mosaic from a provided list of raster files 
#' (`.tif`). It saves the resulting mosaic to a file.
#'
#' @param raster_files Character vector. List of full paths to raster files.
#' @param export_filename Character. Full path where the resulting mosaic 
#' raster will be saved.
#' @param fun Character. Function to use for aggregating overlapping 
#' raster values in the mosaic (e.g., "mean", "sum"). Defaults to 
#' "mean".
#'
#' @return A `SpatRaster` object representing the created mosaic.
#'
#' @details This function requires the following R packages:
#'          - terra
#'
#' # Example usage of the function
#'
#' source("scripts/preprocessing/r/mosaic_rasters.R")
#'
#' raster_files <- c(
#'   "X:/samba/abmisc/spatial_data/temp/raster1.tif",
#'   "X:/samba/abmisc/spatial_data/temp/raster2.tif"
#' )
#' 
#' mosaic <- mosaic_rasters_in_list(
#'   raster_files = raster_files,
#'   export_filename = "X:/samba/abmisc/spatial_data/landsat/"
#'     "all_landsat.tif",
#'   fun = "mean"
#' )
#' print(mosaic)
#' 
mosaic_rasters_in_list <- function(raster_files, export_filename, fun = "mean") {
  # Step 1: Check if any files are provided
  if (length(raster_files) == 0) {
    stop("No raster files provided for mosaicking.")
  }
  
  # Step 2: Create a SpatRasterCollection from the raster files
  rsrc <- terra::sprc(raster_files)
  
  # Step 3: Create a mosaic using the specified aggregation function
  m <- terra::mosaic(rsrc, fun = fun)
  
  # Step 4: Clear rasters from memory
  rm(rsrc)
  gc() # Run garbage collection to ensure memory is freed
  
  # Step 5: Write the mosaic to the specified export filename
  terra::writeRaster(m, filename = export_filename, overwrite = TRUE)
  
  # Step 6: Return the created mosaic
  return(m)
}


