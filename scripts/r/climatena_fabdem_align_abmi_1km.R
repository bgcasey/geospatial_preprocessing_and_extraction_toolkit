# ---
# title: Align ClimateNA FABDEM Rasters to the ABMI 1 km Grid
# author: Brendan Casey
# created: 2026-08-30
# inputs:
#   - ClimateNA rasters downscaled with FABDEM, one folder per
#     period under fab_dem_us_canada_int/ (Normal_1991_2020,
#     Year_2000, Year_2005, Year_2010, Year_2015, Year_2020,
#     Year_2024). Each folder holds 85 single-band GeoTIFFs in
#     lon/lat WGS 84 covering the US and Canada.
#   - ABMI 1 km reference grid, sciSpatialR::ab_grid()
#     (EPSG:3400, 1000 m, 1234 x 695).
# outputs:
#   - One multiband GeoTIFF per period, written to
#     _temp/climatena_fabdem_ab/abmi1km/ as
#     climatena_fabdem_ab_<period>_abmi1km.tif. Bands are the 85
#     ClimateNA variables in alphabetical order, named for the
#     source file, on the reference grid and masked to it.
# notes:
#   Each source layer is cropped to the Alberta window,
#   reprojected to EPSG:3400, then placed on the reference grid
#   with sciSpatialR::resample_to_grid(). Outputs are masked to
#   the grid, so every grid cell carries a value.
#
#   Band order is checked against the first period, so band i is
#   the same variable in every output.
#
#   Periods are assembled on local disk and copied to the share.
#   Those whose output already exists are skipped; set
#   skip_existing to FALSE to rebuild. A period interrupted
#   during the final copy leaves a short file that would be
#   skipped on a rerun, so delete a suspect output before
#   rerunning.
#
#   Staging and terra scratch live under scratch_root, swept
#   during each period and removed in section 6.
# ---

# 1. Setup ----

## 1.1 Load packages ----
library(terra) # raster handling (version: 1.9.34)
library(sciSpatialR) # reference grid, alignment (version: 0.1.0)

## 1.2 Define paths ----
# Source root holds one folder per ClimateNA period.
source_root <- file.path(
  "//ABMI-DATA2/science/spatial_data",
  "climatologyMeteorologyAtmosphere/climate_na",
  "fab_dem_us_canada_int"
)

output_dir <- file.path(
  "//ABMI-DATA2/science/spatial_data/_temp",
  "climatena_fabdem_ab/abmi1km"
)

if (!dir.exists(output_dir)) {
  dir.create(output_dir, recursive = TRUE)
}

## 1.3 Set parameters ----
# Periods to process, in output order.
periods <- c(
  "Normal_1991_2020",
  "Year_2000",
  "Year_2005",
  "Year_2010",
  "Year_2015",
  "Year_2020",
  "Year_2024"
)

# Skip periods whose output file is already on the share.
skip_existing <- TRUE

# Cells kept beyond the reference grid when cropping the source.
edge_cells <- 5

# GeoTIFF creation options.
gdal_opts <- c(
  "COMPRESS=DEFLATE",
  "PREDICTOR=3",
  "TILED=YES",
  "BIGTIFF=IF_SAFER"
)

## 1.4 Set scratch and memory behaviour ----
# Scratch holds terra's spilled intermediates and the staged
# layers, and is swept during the run and removed in section 6.
scratch_root <- file.path(tempdir(), "climatena_abmi1km")
terra_temp <- file.path(scratch_root, "terra")
stage_root <- file.path(scratch_root, "stage")

for (d in c(terra_temp, stage_root)) {
  if (!dir.exists(d)) {
    dir.create(d, recursive = TRUE)
  }
}

terraOptions(tempdir = terra_temp, memfrac = 0.6)

# Layers processed between scratch sweeps inside a period.
clean_every <- 20

## 1.5 Load the reference grid ----
ref <- ab_grid()


# 2. Define the Alberta crop window ----
# The reference grid reprojected to the source CRS and widened
# by edge_cells, used to crop the continental sources.

source_template <- rast(
  list.files(
    file.path(source_root, periods[1]),
    pattern = "\\.tif$",
    ignore.case = TRUE,
    full.names = TRUE
  )[1]
)

crop_window <- ext(
  project(ref, crs(source_template), method = "near")
)
crop_window <- crop_window +
  edge_cells * max(res(source_template))

rm(source_template)


# 3. Functions ----

## 3.1 Clear scratch files ----

#' Drop unreferenced scratch files and free memory
#'
#' Removes the terra scratch files no live `SpatRaster` points at
#' and returns freed memory to the OS. Rasters still in use are
#' left alone, so this is safe to call mid-run.
#'
#' @param report Logical; if `TRUE`, message memory and scratch
#'   use after clearing. Default `TRUE`.
#' @return The scratch size in MB after clearing, invisibly.
#'
#' @examples
#' \dontrun{
#' clear_scratch()
#' }
clear_scratch <- function(report = TRUE) {
  # Drop scratch files nothing references
  suppressWarnings(tmpFiles(orphan = TRUE, remove = TRUE))

  # Return freed memory to the OS
  used_mb <- sum(gc(verbose = FALSE)[, 2])

  # Measure what is left behind
  left <- list.files(terra_temp, recursive = TRUE, full.names = TRUE)
  left_mb <- sum(file.size(left), na.rm = TRUE) / 1e6

  if (report) {
    message(
      "  memory ",
      round(used_mb),
      " MB; scratch ",
      round(left_mb, 1),
      " MB in ",
      length(left),
      " files"
    )
  }

  return(invisible(left_mb))
}

## 3.2 List the layers of one period ----

#' List the source rasters for one ClimateNA period
#'
#' Returns the GeoTIFFs in a period folder, ordered by variable
#' name so band order is the same for every period.
#'
#' @param period Character; a folder name under `source_root`.
#' @return A character vector of file paths, alphabetically
#'   ordered by variable name.
#'
#' @examples
#' \dontrun{
#' files <- period_layers("Year_2024")
#' }
period_layers <- function(period) {
  # Locate the period folder
  period_dir <- file.path(source_root, period)
  if (!dir.exists(period_dir)) {
    stop("Period folder not found: ", period_dir, call. = FALSE)
  }

  # List rasters, ignoring Thumbs.db and other stray files
  files <- list.files(
    period_dir,
    pattern = "\\.tif$",
    ignore.case = TRUE,
    full.names = TRUE
  )
  if (length(files) == 0L) {
    stop("No .tif files in ", period_dir, call. = FALSE)
  }

  # Order by variable name
  files <- files[order(
    tools::file_path_sans_ext(basename(files))
  )]

  return(files)
}

## 3.3 Align one layer ----

#' Align one ClimateNA layer to the reference grid
#'
#' Crops a source layer to the Alberta window, reprojects it to
#' the reference CRS, and places it on the reference grid.
#'
#' @param path Character; path to a source GeoTIFF.
#' @param ref A `SpatRaster` used as the target grid.
#' @param window A `SpatExtent` in the CRS of `path`.
#' @param quiet Logical; suppress the message naming the
#'   resampling method. Default `TRUE`.
#' @return A `SpatRaster` on the geometry of `ref`, named for the
#'   source variable.
#'
#' @examples
#' \dontrun{
#' lyr <- align_layer(period_layers("Year_2024")[1], ab_grid(),
#'   crop_window,
#'   quiet = FALSE
#' )
#' }
align_layer <- function(path, ref, window, quiet = TRUE) {
  # Read and trim to the Alberta window
  r <- rast(path)
  r <- crop(r, window, snap = "out")

  # Reproject to the reference CRS
  r <- project(r, ab_crs(), method = "bilinear")

  # Place on the reference grid
  r <- resample_to_grid(r, ref, quiet = quiet)

  names(r) <- tools::file_path_sans_ext(basename(path))

  return(r)
}

## 3.4 Build one multiband period raster ----

#' Build and write the multiband raster for one period
#'
#' Aligns every layer of a period, stacks them in variable order,
#' masks the stack to the grid, and copies the result to
#' `output_dir`. Layers are staged on local disk.
#'
#' @param period Character; a folder name under `source_root`.
#' @param ref A `SpatRaster` used as the target grid.
#' @param window A `SpatExtent` in the source CRS.
#' @param variables Character; expected variable names, used to
#'   confirm band order matches the other periods.
#' @return The path of the written file, invisibly.
#'
#' @examples
#' \dontrun{
#' build_period("Year_2024", ab_grid(), crop_window, variables)
#' }
build_period <- function(period, ref, window, variables) {
  files <- period_layers(period)
  found <- tools::file_path_sans_ext(basename(files))

  # Refuse a period whose variables differ
  if (!identical(found, variables)) {
    stop(
      "Variables in ",
      period,
      " differ from the reference set. ",
      "Missing: ",
      paste(setdiff(variables, found), collapse = ", "),
      "; unexpected: ",
      paste(setdiff(found, variables), collapse = ", "),
      call. = FALSE
    )
  }

  # Stage aligned layers on local disk. on.exit() clears the
  # directory even when a period fails part way through.
  stage_dir <- file.path(stage_root, period)
  dir.create(stage_dir, recursive = TRUE, showWarnings = FALSE)
  on.exit(
    unlink(stage_dir, recursive = TRUE, force = TRUE),
    add = TRUE
  )

  staged <- file.path(stage_dir, basename(files))
  for (i in seq_along(files)) {
    message("  [", i, "/", length(files), "] ", found[i])
    lyr <- align_layer(files[i], ref, window, quiet = i > 1L)
    writeRaster(lyr, staged[i], overwrite = TRUE, datatype = "FLT4S")

    rm(lyr)
    if (i %% clean_every == 0L) {
      clear_scratch(report = FALSE)
    }
  }

  # Stack in variable order and mask to the grid
  stk <- rast(staged)
  names(stk) <- found
  stk <- mask(stk, ref)

  # Write locally, then copy the finished file to the share
  out_name <- period_filename(period)
  local_out <- file.path(stage_dir, out_name)
  writeRaster(
    stk,
    local_out,
    overwrite = TRUE,
    datatype = "FLT4S",
    gdal = gdal_opts
  )

  # Release the stack before sweeping scratch
  rm(stk)
  clear_scratch()

  share_out <- file.path(output_dir, out_name)
  if (!file.copy(local_out, share_out, overwrite = TRUE)) {
    stop(
      "Failed to copy ", out_name, " to ", output_dir,
      call. = FALSE
    )
  }

  return(invisible(share_out))
}

## 3.5 Name the output file for a period ----

#' Build the output file name for one period
#'
#' @param period Character; a folder name under `source_root`.
#' @return A character file name.
#'
#' @examples
#' period_filename("Year_2024")
period_filename <- function(period) {
  paste0(
    "climatena_fabdem_ab_",
    tolower(period),
    "_abmi1km.tif"
  )
}


# 4. Build the multiband rasters ----
# One 85-band file per period.

variables <- tools::file_path_sans_ext(
  basename(period_layers(periods[1]))
)

message(
  "Aligning ",
  length(variables),
  " variables for ",
  length(periods),
  " periods."
)

for (period in periods) {
  share_out <- file.path(output_dir, period_filename(period))

  if (skip_existing && file.exists(share_out)) {
    message("Skipping ", period, "; output already exists.")
    next
  }

  message("Processing ", period, " ...")
  build_period(period, ref, crop_window, variables)
  message("Wrote ", share_out)
}


# 5. Verify the outputs ----
# Confirm each file sits on the reference grid, carries the
# expected named bands, and covers every grid cell.

grid_cells <- global(!is.na(ref), "sum")[[1]]

for (period in periods) {
  share_out <- file.path(output_dir, period_filename(period))
  if (!file.exists(share_out)) {
    message(period, ": MISSING")
    next
  }

  out <- rast(share_out)
  aligned <- check_alignment(out, ref, verbose = FALSE)
  covered <- global(!is.na(out[[1]]), "sum")[[1]]

  message(
    period,
    ": ",
    nlyr(out),
    " bands; aligned = ",
    all(aligned),
    "; names match = ",
    identical(names(out), variables),
    "; cells = ",
    covered,
    "/",
    grid_cells
  )

  # Close the file before opening the next one
  rm(out)
}


# 6. Tear down scratch ----
# Remove the scratch tree once the outputs are verified.

clear_scratch()
unlink(scratch_root, recursive = TRUE, force = TRUE)

# Restore terra's session temp directory
terraOptions(tempdir = tempdir())

if (dir.exists(scratch_root)) {
  warning("Scratch directory not fully removed: ", scratch_root)
}

# End of script ----
