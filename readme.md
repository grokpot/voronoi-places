### [Description of project](https://ryanprater.com/blog/voronoi-places)

### Files:
* index.html: basic HTML. Styled for responsiveness and optimized for iframe usage
* main.js: Where the magic happens. Heavily commented because this stuff gets confusing.

### Description of Infrastructure:
* GCP Project "Voronoi Places"
  * JS Maps API Enabled
  * Places API Enabled
  * Geocoder API Enabled
  * API domain restriction set to prevent usage outside of my use
* GCP org level
  * API Billing notification trigger set in case the blog post goes viral
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
 
