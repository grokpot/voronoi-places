var GooglePlaces = require('node-googleplaces');

const places = new GooglePlaces('AIzaSyBna5IEkqyDHckh6znjJ8gIA_rL4y3T9bI');

const request = {
    location: '48.1351, 11.5820',
    radius: '500',
    type: ['transit_station']
  };

places.nearbySearch(request).then((res) => {
	console.log(res.body);
})
