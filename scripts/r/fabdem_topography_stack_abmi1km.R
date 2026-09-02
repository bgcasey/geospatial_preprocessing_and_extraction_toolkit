# ---
# title: Stack FABDEM Topographic Rasters into One Multiband File
# author: Brendan Casey
# created: 2026-09-02
# inputs:
#   - Ten single-band FABDEM topographic GeoTIFFs in
#     _temp/, each already on the ABMI 1 km grid (EPSG:3400,
#     1000 m, 1234 x 695): elevation, slope, tri, twi, tpi at
#     250/1000/2000 m, and dev at 250/1000/2000 m.
# outputs:
#   - fabdem_topography_alberta_abmi1km.tif, a 10-band GeoTIFF
#     written to the same _temp/ folder. Bands follow the order
#     set in section 1.3 and keep the source layer names.
# notes:
#   Repackaging only: no reprojection, resampling, cropping, or
#   masking. Inputs share one grid, so cell values are carried
#   through unchanged.
#
#   Band order groups the variables (elevation, slope, tri, twi,
#   then tpi and dev by increasing radius) rather than following
#   the alphabetical file order.
#
#   The stack is written to local disk and copied to the share.
#   Set overwrite_existing to TRUE to rebuild an output that is
#   already there.
# ---

# 1. Setup ----

## 1.1 Load packages ----
library(terra) # raster handling (version: 1.9.34)
library(sciSpatialR) # reference grid, alignment (version: 0.1.0)

## 1.2 Define paths ----
# Inputs and output share one folder on the science drive.
source_dir <- "//ABMI-DATA2/science/spatial_data/_temp"

output_dir <- source_dir

out_name <- "fabdem_topography_alberta_abmi1km.tif"

## 1.3 Set parameters ----
# Input files in output band order.
input_files <- c(
  "fabdem_elevation_alberta_abmi1km.tif",
  "fabdem_slope_alberta_abmi1km.tif",
  "fabdem_tri_alberta_abmi1km.tif",
  "fabdem_twi_alberta_abmi1km.tif",
  "fabdem_tpi_alberta_r250_abmi1km.tif",
  "fabdem_tpi_alberta_r1000_abmi1km.tif",
  "fabdem_tpi_alberta_r2000_abmi1km.tif",
  "fabdem_dev_alberta_r250_abmi1km.tif",
  "fabdem_dev_alberta_r1000_abmi1km.tif",
  "fabdem_dev_alberta_r2000_abmi1km.tif"
)

# Rebuild an output that already exists on the share.
overwrite_existing <- FALSE

# GeoTIFF creation options. INTERLEAVE = BAND keeps each
# variable contiguous, for reading a few bands at a time.
gdal_opts <- c(
  "COMPRESS=DEFLATE",
  "PREDICTOR=3",
  "TILED=YES",
  "INTERLEAVE=BAND",
  "BIGTIFF=IF_SAFER"
)

## 1.4 Load the reference grid ----
ref <- ab_grid()


# 2. Functions ----

## 2.1 Open the input layers ----

#' Open the topographic inputs as one stack
#'
#' Reads the files named in `files` from `dir` in the given
#' order, stopping when one is missing or sits on a different
#' grid than the first.
#'
#' @param dir Character; folder holding the input GeoTIFFs.
#' @param files Character; file names in output band order.
#' @return A `SpatRaster` with one band per input, named for the
#'   source layer.
#'
#' @examples
#' \dontrun{
#' stk <- open_inputs(source_dir, input_files)
#' }
open_inputs <- function(dir, files) {
  # Refuse a run with anything missing
  paths <- file.path(dir, files)
  missing <- files[!file.exists(paths)]
  if (length(missing) > 0L) {
    stop(
      "Input files not found: ",
      paste(missing, collapse = ", "),
      call. = FALSE
    )
  }

  # Check every input against the geometry of the first
  geom <- rast(paths[1])
  for (i in seq_along(paths)[-1]) {
    same_grid <- compareGeom(
      rast(paths[i]),
      geom,
      crs = TRUE,
      ext = TRUE,
      rowcol = TRUE,
      stopOnError = FALSE,
      messages = FALSE
    )
    if (!isTRUE(same_grid)) {
      stop(
        "Grid of ", files[i], " differs from ", files[1],
        call. = FALSE
      )
    }
  }

  stk <- rast(paths)

  return(stk)
}


# 3. Build the multiband raster ----
# One 10-band file on the ABMI 1 km grid.

share_out <- file.path(output_dir, out_name)

if (file.exists(share_out) && !overwrite_existing) {
  message("Skipping build; ", out_name, " already exists.")
} else {
  message("Stacking ", length(input_files), " layers ...")
  stk <- open_inputs(source_dir, input_files)
  message("Bands: ", paste(names(stk), collapse = ", "))

  # Write locally, then copy the finished file to the share
  stage_dir <- file.path(tempdir(), "fabdem_topography")
  dir.create(stage_dir, recursive = TRUE, showWarnings = FALSE)
  local_out <- file.path(stage_dir, out_name)

  writeRaster(
    stk,
    local_out,
    overwrite = TRUE,
    datatype = "FLT4S",
    gdal = gdal_opts
  )

  if (!file.copy(local_out, share_out, overwrite = TRUE)) {
    stop("Failed to copy ", out_name, " to ", output_dir,
      call. = FALSE
    )
  }

  unlink(stage_dir, recursive = TRUE, force = TRUE)
  message("Wrote ", share_out)
}


# 4. Verify the output ----
# Confirm the file sits on the reference grid, carries the
# expected named bands, and matches the source cell values.

out <- rast(share_out)
aligned <- check_alignment(out, ref, verbose = FALSE)

expected <- vapply(
  file.path(source_dir, input_files),
  function(p) names(rast(p)),
  character(1),
  USE.NAMES = FALSE
)

# Compare every band against its source file
values_ok <- TRUE
for (i in seq_along(input_files)) {
  a <- values(out[[i]])
  b <- values(rast(file.path(source_dir, input_files[i])))
  values_ok <- values_ok &&
    identical(is.na(a), is.na(b)) &&
    isTRUE(all.equal(a[!is.na(a)], b[!is.na(b)]))
}

message(
  out_name,
  ": ",
  nlyr(out),
  " bands; aligned = ",
  all(aligned),
  "; names match = ",
  identical(names(out), expected),
  "; values match = ",
  values_ok,
  "; ",
  round(file.size(share_out) / 1e6, 1),
  " MB"
)

# End of script ----
