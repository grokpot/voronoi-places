// v1.2

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
 * 
 * Two UI listeners: change of location search box, and change of places search box. Each update global values and then call `performRenderCycle()`
 */

// The map is made global to prevent from constant reconstruction
let map;
let infoWindow = null;
let placesService = null;
let geocoderService = null
// Coordinates of the map location, of type {lat: x, lng: y}
let mapCenterCoords = {};
// An array of markers on the map
let activeMarkers = [];
// The type of Place to use as Voronoi vertices. Instantiate to subway stations
let placesQueryString = '';
// The singleton Overlay that we'll attach/remove from the map
let overlay;

const initApis = () => {
    mapCenterCoords = {lat: 48.1351, lng: 11.5820};   // Munich
    placesQueryString = document.getElementById('search-input-place').getAttribute('placeholder');    // Initial place is search box placeholder

    // Init Map
    map = new google.maps.Map(document.getElementById('map'), {
        center: mapCenterCoords,
        zoom: 14,
        minZoom: 12,
        streetViewControl: false,
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        mapTypeControlOptions: { mapTypeIds: [] },
        // Disables map dragging, in order to cut down on cost
        gestureHandling: "none", 
        keyboardShortcuts: false
    }); 

    // Init InfoWindow
    infoWindow = new google.maps.InfoWindow();

    // Init Places service
    placesService = new google.maps.places.PlacesService(map);

    // Init geocoder
    geocoderService = new google.maps.Geocoder();

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
    const parent = this.div_.parentNode
    while (parent.firstChild) {
        parent.firstChild.remove();
    }
    this.div_ = null;
};

// Convenience method to set error banner text
const setErrorText = text => {
    let errorBanner = document.getElementById('error-banner')
    errorBanner.innerText = text;
}

// Clears and then repopulates map
const performRenderCycle = () => {
    derender();
    render();
}

// Removes the overlay from the map and clears markers
const derender = () => {
    setErrorText(null);

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

// Adds map markers to queried locations
const createMarkers = places => {
    places.forEach(place => {
        var marker = new google.maps.Marker({
            map: map,
            title: place.name,
            position: place.geometry.location
        });
        activeMarkers.push(marker);
        marker.addListener('click', function() {
            infoWindow.setContent(marker.getTitle());
            infoWindow.open(map, marker);
        });
    })
}

// Queries for new places, creates markers, creates new overlay, assigns overlay to map
const render = async () => {
    const places = await getPlaces();
    createMarkers(places);
    overlay = new VoronoiOverlay(map);
    overlay.setMap(map);
}

// API call to Google Places service, returns a Promise
const getPlaces = options => {
    console.log('hit');
    var options = {
        bounds: map.getBounds(), 
        keyword: placesQueryString
    };
    return new Promise((resolve, reject) => {
        // nearbySearch vs textSearch: https://developers.google.com/maps/documentation/javascript/places#TextSearchRequests
        // nearbySearch seems to work better for displaying results at center of map
        // `keyword` seems to work better than `name`
        placesService.nearbySearch(options, (results, status, pagination) => {
            if (status === 'OK') {
                resolve(results);
            } else {
                if (status == 'ZERO_RESULTS') {
                    setErrorText("No results. Try searching for something else");
                } else {
                    setErrorText("Error querying Places API. This isn't normal!");
                }
            }
        });
    })
}

// API call to Google Geocode service, returns a Promise
const geocode = address => {
    return new Promise((resolve, reject) => {
        geocoderService.geocode( { 'address': address}, function(results, status) {
            if (status === 'OK') {
                resolve(results[0].geometry.location);
            } else {
                setErrorText("Error querying Geocoding API. This isn't normal!");
            }
        })
    })
}

// Event listener for Location
document.getElementById('search-form-location').addEventListener("submit", async (e) => {
    e.preventDefault();
    mapCenterCoords = await geocode(document.getElementById('search-input-location').value);
    map.setCenter(mapCenterCoords);
    performRenderCycle();
});

// Event listener for Place
document.getElementById('search-form-place').addEventListener("submit", (e) => {
    e.preventDefault();
    placesQueryString = document.getElementById('search-input-place').value;
    performRenderCycle();
});

// Entrypoint
initApis();
