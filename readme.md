* GCP Project "Voronoi Places"
  * JS Maps API Enabled
  * Places API Enabled
  * Geocoder API Enabled
* GCP org level
  * Billing auto emails me when budget exceeded, but does not turn off API
  * API quotas set:
    * 10000 requests daily
    * 50 requests per 100 seconds, user agnostic
    * 50 requests per 100 seconds, per user
* Hosted on GCP Storage
  * https://cloud.google.com/storage/docs/hosting-static-website
* JS Modules must be served. `python3 -m http.server 8000` ran in directory is easiest.

### Resources
 * https://developers.google.com/maps/documentation/javascript/customoverlays
 * https://developers.google.com/maps/documentation/javascript/reference/overlay-view
 * https://developers.google.com/maps/documentation/javascript/places#PlaceSearchPaging
 * https://github.com/d3/d3-delaunay
 * https://github.com/d3/d3-voronoi (deprecated)
 * https://observablehq.com/collection/@d3/d3-delaunay
 * http://bl.ocks.org/shimizu/5610671