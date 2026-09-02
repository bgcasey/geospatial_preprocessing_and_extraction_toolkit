<!--
<img src="https://drive.google.com/uc?id=1fgYuG7jpnekZrkoL_PdVUnSiUFBFX-vI" alt="Logo" width="150" style="float: left; margin-right: 10px;">
-->

<img src="https://drive.google.com/uc?id=1szqLViKqTX5C1XF8uV7HbIst0i6Xvv7g" alt="Logo" width="300">

# Geospatial Cookbook

![In Development](https://img.shields.io/badge/Status-In%20Development-yellow)
![Languages](https://img.shields.io/badge/Languages-R-blue)

A working collection of **single-use geospatial scripts** — one-off jobs
that generate, repackage, align, or extract a specific data product.

Scripts are grouped by language and named for the **data product** they
handle, so everything touching one product sorts together (currently all
four `climatena_*.R` scripts).

---


## Scripts

### R — [`scripts/r/`](scripts/r/)

| Script | Description |
|---|---|
| [climatena_generate_annual_rasters.R](scripts/r/climatena_generate_annual_rasters.R) | Generates annual and seasonal ClimateNA rasters from a DEM (EPSG:4326) using `ClimateNAr`, one folder of single-band GeoTIFFs per period. |
| [climatena_fabdem_stack_native.R](scripts/r/climatena_fabdem_stack_native.R) | Repackages those per-period folders into one 85-band GeoTIFF each, on the native lon/lat grid. No reprojection, resampling, cropping, or masking — cell values are untouched. |
| [climatena_fabdem_align_abmi_1km.R](scripts/r/climatena_fabdem_align_abmi_1km.R) | Crops to Alberta, reprojects to EPSG:3400, and resamples onto the ABMI 1 km reference grid, giving one masked 85-band GeoTIFF per period. |
| [climatena_extract_annual_to_xy.R](scripts/r/climatena_extract_annual_to_xy.R) | Extracts annual ClimateNA values directly to lat/lon point locations from a CSV, returning a CSV of climate variables. |
| [fabdem_topography_stack_abmi1km.R](scripts/r/fabdem_topography_stack_abmi1km.R) | Combines the ten single-band FABDEM topographic rasters (elevation, slope, TRI, TWI, TPI and deviation at 250/1000/2000 m) into one 10-band GeoTIFF on the ABMI 1 km grid. No reprojection or resampling — the inputs already share the grid. |

---

## Adding a script

1. Put it in the folder for its language, named for the data product it
   handles (`<product>_<what_it_does>.R`). Use no numeric prefix —
   nothing here runs in sequence.
2. Give it the standard header (`title`, `author`, `created`, `inputs`,
   `outputs`, `notes`) and numbered `----` sections, with `# 1. Setup`
   first.
3. Keep every path, period, and variable list in the Setup section so
   the next person can retarget the script without reading the body.
4. Add a row to the table above.
