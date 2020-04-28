// https://github.com/d3/d3-delaunay
import {Delaunay} from "https://unpkg.com/d3-delaunay@5.2.1?module";

/**
 * CONTROL FLOW:
 * 
 * Entrypoint is called at the bottom of the file - `initApis()`
 * 
 * Once map is rendered for the first time, the `idle` event is fired
 * 
 * In the `idle` listener, `performRenderCycle()` is called. This simply calls `derender()` and then `render()`
 * `derender()` removes the connection between `overlay` and `map`, sets `overlay` to null, and removes markers from the map.
 * `render()` does the opposite: makes a call to Places API and turns the results into map markers, sets `overlay` to a new instance of `VoronoiOverlay`, and connects `map` to `overlay`
 * 
 * When map is manipulated (dragged, zoomed, etc.), `idle` is again fired when the UI action is complete
 */

/** RESOURCES
 * https://developers.google.com/maps/documentation/javascript/customoverlays
 * https://developers.google.com/maps/documentation/javascript/reference/overlay-view
 * https://developers.google.com/maps/documentation/javascript/places#PlaceSearchPaging
 * https://github.com/d3/d3-delaunay
 * https://github.com/d3/d3-voronoi (old)
 * https://observablehq.com/collection/@d3/d3-delaunay
 * http://bl.ocks.org/shimizu/5610671
**/

/**
 * TODO
 * Replace nearbysearch with findplace
    * https://developers.google.com/maps/documentation/javascript/places#place_search_requests
    * Can we get more results with this API?
    * Does the tight clustering problem below go away?
 * Make responsive (must look good on mobile)
 * Searching for "taxi" or "food" sends back a tight cluster (this might be if there's no results)
 * Location Search
 */


// The map is made global to prevent from constant reconstruction
let map;
// Google Places service made global so we can make calls upon UI interaction
var service = null;
// An array of markers on the map
var activeMarkers = [];
// The type of Place to use as Voronoi vertices. Instantiate to subway stations
var places_query_string = 'subway_station';
// The singleton Overlay that we'll attach/remove from the map
let overlay;

const initApis = () => {
    // Init map
    var munich = {lat: 48.1351, lng: 11.5820};
    map = new google.maps.Map(document.getElementById('map'), {
        center: munich,
        zoom: 14,
        minZoom: 12
    }); 

    // Listen to event when the user's drag is complete. This is also fired the first time the map loads
    // https://learntech.imsu.ox.ac.uk/blog/google-maps-api-v3-capturing-viewport-change-use-idle-not-bounds_changed/
    google.maps.event.addListener(map, 'idle', function() {
        performRenderCycle();
    });
}


VoronoiOverlay.prototype = new google.maps.OverlayView();

/** @constructor */
function VoronoiOverlay(map) {
    this.map_ = map;
    this.bounds_ = map.getBounds();
  
    // Define a property to hold the image's div. We'll
    // actually create this div upon receipt of the onAdd()
    // method so we'll leave it null for now.
    this.div_ = null;
  
    // Explicitly call setMap on this overlay.
    this.setMap(map);
}

// onAdd is called when the map's panes are ready and the overlay has been added to the map.
VoronoiOverlay.prototype.onAdd = function() {
    
    // Create div to be a container of our svg. Not yet attached to the DOM
    let div = document.createElement('div');
    div.style.position = 'absolute'
    
    // https://stackoverflow.com/questions/18455282/how-to-create-svg-object-without-appending-it
    let svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    // Stretch the svg to cover the div
    svg.style.width = '100%';
    svg.style.height = '100%';
    svg.style.position = 'absolute';
    div.appendChild(svg)

    // Make the svg object D3 enabled
    svg = d3.select(svg)

    const overlayProjection = this.getProjection();
    
    // d3-delaunay assumes points are from 0,0 to +x,+y, SW to NE, so we need to translate
    let markerSvgPoints = activeMarkers.map(m => {
        var pixelCoordinates = overlayProjection.fromLatLngToContainerPixel(m.getPosition());
        return [pixelCoordinates.x, pixelCoordinates.y];
    });
    const delaunay = Delaunay.from(markerSvgPoints);
    // Note the coordinate translation from screen reference (NW, SE) to div reference (SW, NE)
    // Note we're using fromLatLngToContainerPixel instead of fromLatLngToDivPixel
    const swCont = overlayProjection.fromLatLngToContainerPixel(this.bounds_.getSouthWest());
    const neCont = overlayProjection.fromLatLngToContainerPixel(this.bounds_.getNorthEast());
    const voronoi = delaunay.voronoi([swCont.x, neCont.y, neCont.x, swCont.y]);
    
    // Draw the voronoi lines
    svg.append("path")
      .attr("stroke", "#ff0000")
      .attr("stroke-width", 3)
      .attr("d", voronoi.render());

    // Resize the div to cover the overlay. Note we're using fromLatLngToDivPixel
    const swDiv = overlayProjection.fromLatLngToDivPixel(this.bounds_.getSouthWest());
    const neDiv = overlayProjection.fromLatLngToDivPixel(this.bounds_.getNorthEast());
    div.style.left = swDiv.x + 'px';
    div.style.top = neDiv.y + 'px';
    div.style.width = (neDiv.x - swDiv.x) + 'px';
    div.style.height = (swDiv.y - neDiv.y) + 'px';
    this.div_ = div;

    // Add the element to the "overlayLayer" pane.
    var panes = this.getPanes();
    panes.overlayLayer.appendChild(div);
};

// Called when overlay's map property set to `null`
VoronoiOverlay.prototype.onRemove = function() {
    // Can't use getPanes() here
    this.div_.parentNode.removeChild(this.div_);
    this.div_ = null;
};

// Clears and then repopulates map
const performRenderCycle = () => {
    derender();
    render();
}

// Removes the overlay from the map and clears markers
const derender = () => {
    if (overlay) {
        overlay.setMap(null);
        overlay = null;
    }

    clearMarkers();
}

// Clears all markers from the map
const clearMarkers = () => {
    while (activeMarkers.length) {
        activeMarkers.pop().setMap(null);
    }
}

// Queries for new places, creates markers, creates new overlay, assigns overlay to map
const render = async () => {
    const places = await getPlaces();
    createMarkers(places);
    overlay = new VoronoiOverlay(map);
    overlay.setMap(map);
}

// Makes Places API call, returns a promise
const getPlaces = options => {
    var options = {location: map.getCenter(), type: [places_query_string], rankBy: google.maps.places.RankBy.DISTANCE};
    if (places_query_string === 'beer garden') {
        options.keyword = places_query_string;
    } else {
        options.type = [places_query_string];
    }

    return new Promise((resolve, reject) => {
        // Init Places service
        service = new google.maps.places.PlacesService(map);
        service.nearbySearch(options, (results, status, pagination) => {
            if (status === 'OK') {
                // const getNextPage = pagination.hasNextPage && function () {
                //     pagination.nextPage();
                // };
                // const getNextPage = false;
                // if (getNextPage) {
                //     performSearch();
                // }
                resolve(results);
            } else {
                reject(new Error('Error querying Places API with options: ' + address));
            }
        });
    })
}

// Adds map markers to queried locations
const createMarkers = places => {
    for (var i = 0, place; place = places[i]; i++) {
        var marker = new google.maps.Marker({
            map: map,
            title: place.name,
            position: place.geometry.location
        });
        activeMarkers.push(marker);
    }
}

document.getElementById('search-form').addEventListener("submit", (e) => {
    e.preventDefault();
    places_query_string = document.getElementById('search-input').value;
    performRenderCycle();
});

// Entrypoint
initApis();
