import mapboxgl from 'https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
console.log('Mapbox GL JS Loaded', mapboxgl);


mapboxgl.accessToken = 'pk.eyJ1IjoibXJvbmEyMiIsImEiOiJjbWFvYTMwd3AwNHRyMmtvamp2N3E1bnY2In0.hekAnvHFlDI4E2b6brkdTQ';

let departuresByMinute = Array.from({ length: 1440 }, () => []);
let arrivalsByMinute = Array.from({ length: 1440 }, () => []);
// Initialize the map
const map = new mapboxgl.Map({
    container: 'map', 
    style: 'mapbox://styles/mrona22/cmaofeuvv01a901sp6rjib1ex', 
    center: [-71.09415, 42.36027], 
    zoom: 12,
    minZoom: 5,
    maxZoom: 18,
    });


map.on('load', async () => {
  map.addSource('boston_route', {
    type: 'geojson',
    data: 'https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson',
      });
    map.addLayer({
      id: 'bike-lanes',
      type: 'line',
      source: 'boston_route',
      paint: {
          'line-color': 'black',
          'line-width': 1,
          'line-opacity': 0.4,
        },
  });
  map.addSource('cambridge_route', {
    type: 'geojson',
    data: 'https://raw.githubusercontent.com/cambridgegis/cambridgegis_data/main/Recreation/Bike_Facilities/RECREATION_BikeFacilities.geojson',
      });
    map.addLayer({
      id: 'bike-lanes_cambridge',
      type: 'line',
      source: 'cambridge_route',
      paint: {
          'line-color': 'black',
          'line-width': 1,
          'line-opacity': 0.4,
        },
    });
});
map.on('load', async () => {
  //let dataURL = "https://dsc106.com/labs/lab07/data/bluebikes-stations.json";

  let jsonData;
  try {
    const jsonurl = "https://dsc106.com/labs/lab07/data/bluebikes-stations.json";

    // Await JSON fetch
    const jsonData = await d3.json(jsonurl);


    let stations = jsonData.data.stations;
    console.log('Stations Array:', stations);

    let trips = await d3.csv(
      'https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv',
      (trip) => {
        trip.started_at = new Date(trip.started_at);
        trip.ended_at = new Date(trip.ended_at);
        let startedMinutes = minutesSinceMidnight(trip.started_at);
        let endedMinutes = minutesSinceMidnight(trip.ended_at)
        departuresByMinute[startedMinutes].push(trip)
        arrivalsByMinute[endedMinutes].push(trip)
        return trip;
      },
    );


    stations = computeStationTraffic(jsonData.data.stations)

      

    const radiusScale = d3
      .scaleSqrt()
      .domain([0, d3.max(stations, (d) => d.totalTraffic)])
      .range([0, 25]);

    let svg = d3.select("#map").select('svg');

    let stationFlow = d3.scaleQuantize().domain([0, 1]).range([0, 0.5, 1]);

    const circles = svg
      .selectAll('circle')
      .data(stations, (d) => d.short_name)
      .enter()
      .append('circle')
      .attr('r', d => radiusScale(d.totalTraffic)) // Radius of the circle
      .attr('fill', 'steelblue') // Circle fill color
      .attr('stroke', 'white') // Circle border color
      .attr('stroke-width', 1) // Circle border thickness
      .attr('opacity', 0.9) // Circle opacity
      .each(function (d) {
    // Add <title> for browser tooltips
        d3.select(this)
          .append('title')
          .text(
            `${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`,
          );
      })
      .style('--departure-ratio', (d) =>
        stationFlow(d.departures / d.totalTraffic),
      );
    
      // Function to update circle positions when the map moves/zooms
      function updatePositions() {
        circles
          .attr('cx', (d) => getCoords(d).cx) // Set the x-position using projected coordinates
          .attr('cy', (d) => getCoords(d).cy); // Set the y-position using projected coordinates
      }

      // Initial position update when map loads
      updatePositions();

      map.on('move', updatePositions);
      map.on('zoom', updatePositions);
      map.on('resize', updatePositions);
      map.on('moveend', updatePositions); // Final adjustment after movement ends

      const timeSlider = document.getElementById('time-slider');
      console.log(timeSlider.value)
      const selectedTime = document.getElementById('selected-time');
      const anyTimeLabel = document.getElementById('any-time');

      function updateTimeDisplay() {
        const timeFilter = Number(timeSlider.value); // Get slider value

        if (timeFilter === -1) {
          selectedTime.textContent = ''; // Clear time display
          anyTimeLabel.style.display = 'block'; // Show "(any time)"
        } else {
          selectedTime.textContent = formatTime(timeFilter); // Display formatted time
          anyTimeLabel.style.display = 'none'; // Hide "(any time)"
        }

          // Trigger filtering logic which will be implemented in the next step
          updateScatterPlot(timeFilter);      
        }


        function updateScatterPlot(timeFilter) {
        // Get only the trips that match the selected time filter
          const filteredStations = computeStationTraffic(stations, timeFilter);

          timeFilter === -1 ? radiusScale.range([0, 25]) : radiusScale.range([3, 50]);

          // Update the scatterplot by adjusting the radius of circles
          circles
            .data(filteredStations, (d) => d.short_name)
            .join('circle') // Ensure the data is bound correctly
            .attr('r', (d) => radiusScale(d.totalTraffic)) // Update circle sizes
            .style('--departure-ratio', (d) =>
              stationFlow(d.departures / d.totalTraffic),
            );
          }

        timeSlider.addEventListener('input', updateTimeDisplay);
        updateTimeDisplay();


  } catch (error) {
    console.error('Error loading JSON:', error); // Handle errors
  }

});



function getCoords(station) {
  const point = new mapboxgl.LngLat(+station.lon, +station.lat); // Convert lon/lat to Mapbox LngLat
  const { x, y } = map.project(point); // Project to pixel coordinates
  return { cx: x, cy: y }; // Return as object for use in SVG attributes
}

function formatTime(minutes) {
  const date = new Date(0, 0, 0, 0, minutes); // Set hours & minutes
  return date.toLocaleString('en-US', { timeStyle: 'short' }); // Format as HH:MM AM/PM
}



function computeStationTraffic(stations, timeFilter = -1) {
  // Retrieve filtered trips efficiently
  const departures = d3.rollup(
    filterByMinute(departuresByMinute, timeFilter), // Efficient retrieval
    (v) => v.length,
    (d) => d.start_station_id
  );

  const arrivals = d3.rollup(
    filterByMinute(arrivalsByMinute, timeFilter), // Efficient retrieval
    (v) => v.length,
    (d) => d.end_station_id
  );
  // Update each station..
  return stations.map((station) => {
    let id = station.short_name;
    station.arrivals = arrivals.get(id) ?? 0;
    // what you updated in step 4.2
    station.departures = departures.get(id) ?? 0;
    station.totalTraffic = station.arrivals + station.departures;
    return station;
  });
}


function minutesSinceMidnight(date) {
  return date.getHours() * 60 + date.getMinutes();
}


function filterTripsbyTime(trips, timeFilter) {
  return timeFilter === -1
    ? trips // If no filter is applied (-1), return all trips
    : trips.filter((trip) => {
        // Convert trip start and end times to minutes since midnight
        const startedMinutes = minutesSinceMidnight(trip.started_at);
        const endedMinutes = minutesSinceMidnight(trip.ended_at);

        // Include trips that started or ended within 60 minutes of the selected time
        return (
          Math.abs(startedMinutes - timeFilter) <= 60 ||
          Math.abs(endedMinutes - timeFilter) <= 60
        );
      });
  }

  function filterByMinute(tripsByMinute, minute) {
    if (minute === -1) {
      return tripsByMinute.flat(); // No filtering, return all trips
    }

    // Normalize both min and max minutes to the valid range [0, 1439]
    let minMinute = (minute - 60 + 1440) % 1440;
    let maxMinute = (minute + 60) % 1440;

    // Handle time filtering across midnight
    if (minMinute > maxMinute) {
      let beforeMidnight = tripsByMinute.slice(minMinute);
      let afterMidnight = tripsByMinute.slice(0, maxMinute);
      return beforeMidnight.concat(afterMidnight).flat();
    } else {
      return tripsByMinute.slice(minMinute, maxMinute).flat();
    }
  }




