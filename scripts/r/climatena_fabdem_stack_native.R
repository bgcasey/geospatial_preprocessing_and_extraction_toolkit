# ---
# title: Stack ClimateNA FABDEM Rasters by Period at Native Grid
# author: Brendan Casey
# created: 2026-08-31
# inputs:
#   - ClimateNA rasters downscaled with FABDEM, one folder per
#     period under fab_dem_us_canada_int/ (Normal_1991_2020,
#     Year_2000, Year_2005, Year_2010, Year_2015, Year_2020,
#     Year_2024). Each folder holds 85 single-band GeoTIFFs
#     covering the US and Canada on a 14082 x 6173 lon/lat grid
#     (OGC:CRS84, 0.009231941 x 0.00955797 degrees).
# outputs:
#   - One 85-band GeoTIFF per period, written to
#     _temp/climatena_fabdem/ca_us/native/ as
#     climatena_fabdem_ca_us_<period>_native.tif. Bands are the
#     ClimateNA variables in alphabetical order, named for the
#     source file.
# notes:
#   Repackaging only: no reprojection, resampling, cropping, or
#   masking. Every output keeps the source CRS, extent,
#   resolution, and cell values.
# ---

# 1. Setup ----

## 1.1 Load packages ----
library(terra) # raster handling (version: 1.9.34)

## 1.2 Define paths ----
# Source root holds one folder per ClimateNA period.
source_root <- file.path(
  "//ABMI-DATA2/science/spatial_data",
  "climatologyMeteorologyAtmosphere/climate_na",
  "fab_dem_us_canada_int"
)

output_dir <- file.path(
  "//ABMI-DATA2/science/spatial_data/_temp",
  "climatena_fabdem/ca_us/native"
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

# GeoTIFF creation options. INTERLEAVE = BAND keeps each
# variable contiguous, for reading a few of the 85 at a time.
gdal_opts <- c(
  "COMPRESS=DEFLATE",
  "PREDICTOR=3",
  "TILED=YES",
  "BLOCKXSIZE=512",
  "BLOCKYSIZE=512",
  "INTERLEAVE=BAND",
  "BIGTIFF=YES"
)

## 1.4 Set scratch and memory behaviour ----
# Scratch holds terra's spilled intermediates and the staged
# period file, and is removed in section 5.
scratch_root <- file.path(tempdir(), "climatena_native")
terra_temp <- file.path(scratch_root, "terra")
stage_root <- file.path(scratch_root, "stage")

for (d in c(terra_temp, stage_root)) {
  if (!dir.exists(d)) {
    dir.create(d, recursive = TRUE)
  }
}

# memfrac 0.25 sizes the write chunks; see the header note.
terraOptions(tempdir = terra_temp, memfrac = 0.25)


# 2. Functions ----

## 2.1 Clear scratch files ----

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

## 2.2 List the layers of one period ----

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

## 2.3 Name the output file for a period ----

#' Build the output file name for one period
#'
#' @param period Character; a folder name under `source_root`.
#' @return A character file name.
#'
#' @examples
#' period_filename("Year_2024")
period_filename <- function(period) {
  paste0(
    "climatena_fabdem_ca_us_",
    tolower(period),
    "_native.tif"
  )
}

## 2.4 Build one multiband period raster ----

#' Stack one period into a multiband raster and write it
#'
#' Stacks a period's layers in variable order and writes them to
#' one GeoTIFF on the source grid, then copies the result to
#' `output_dir`. terra streams the write in chunks.
#'
#' @param period Character; a folder name under `source_root`.
#' @param variables Character; expected variable names, used to
#'   confirm band order matches the other periods.
#' @param geom A `SpatRaster` whose geometry every period must
#'   match.
#' @return The path of the written file, invisibly.
#'
#' @examples
#' \dontrun{
#' build_period("Year_2024", variables, geom)
#' }
build_period <- function(period, variables, geom) {
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

  stk <- rast(files)
  names(stk) <- found

  # Refuse a period on a different grid
  same_grid <- compareGeom(
    stk,
    geom,
    crs = TRUE,
    ext = TRUE,
    rowcol = TRUE,
    stopOnError = FALSE,
    messages = FALSE
  )
  if (!isTRUE(same_grid)) {
    stop("Grid of ", period, " differs from the reference grid.", call. = FALSE)
  }

  # Stage on local disk. on.exit() clears the directory even
  # when a period fails part way through.
  stage_dir <- file.path(stage_root, period)
  dir.create(stage_dir, recursive = TRUE, showWarnings = FALSE)
  on.exit(
    unlink(stage_dir, recursive = TRUE, force = TRUE),
    add = TRUE
  )

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
    stop("Failed to copy ", out_name, " to ", output_dir, call. = FALSE)
  }

  return(invisible(share_out))
}


# 3. Build the multiband rasters ----
# One 85-band file per period.

variables <- tools::file_path_sans_ext(
  basename(period_layers(periods[1]))
)

# Geometry every period is checked against
geom <- rast(period_layers(periods[1])[1])

message(
  "Stacking ",
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
  build_period(period, variables, geom)
  message(
    "Wrote ",
    share_out,
    " (",
    round(file.size(share_out) / 1e9, 2),
    " GB)"
  )
}


# 4. Verify the outputs ----
# Confirm the source grid and band names, then compare a window
# of cells against the source to confirm values are unaltered.

check_window <- ext(-114.5, -113.5, 53.0, 54.0)

for (period in periods) {
  share_out <- file.path(output_dir, period_filename(period))
  if (!file.exists(share_out)) {
    message(period, ": MISSING")
    next
  }

  out <- rast(share_out)
  same_grid <- compareGeom(
    out,
    geom,
    crs = TRUE,
    ext = TRUE,
    rowcol = TRUE,
    stopOnError = FALSE,
    messages = FALSE
  )

  # Compare three bands against their source files
  src_files <- period_layers(period)
  probe <- c(1L, length(variables) %/% 2L, length(variables))
  values_ok <- TRUE
  for (i in probe) {
    a <- values(crop(out[[i]], check_window))
    b <- values(crop(rast(src_files[i]), check_window))
    values_ok <- values_ok &&
      identical(is.na(a), is.na(b)) &&
      isTRUE(all.equal(a[!is.na(a)], b[!is.na(b)]))
  }

  message(
    period,
    ": ",
    nlyr(out),
    " bands; grid = ",
    isTRUE(same_grid),
    "; names match = ",
    identical(names(out), variables),
    "; values match = ",
    values_ok,
    "; ",
    round(file.size(share_out) / 1e9, 2),
    " GB"
  )

  # Close the files before opening the next period
  rm(out)
}


# 5. Tear down scratch ----
# Remove the scratch tree once the outputs are verified.

clear_scratch()
unlink(scratch_root, recursive = TRUE, force = TRUE)

# Restore terra's session temp directory
terraOptions(tempdir = tempdir())

if (dir.exists(scratch_root)) {
  warning("Scratch directory not fully removed: ", scratch_root)
}

# End of script ----
