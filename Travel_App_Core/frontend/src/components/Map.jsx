import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import axios from "axios";

export default function Map({ lat, lon, cityName }) {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    if (!mapRef.current) {
      mapRef.current = new maplibregl.Map({
        container: mapContainer.current,
        style: `https://maps.geoapify.com/v1/styles/osm-carto/style.json?apiKey=${process.env.REACT_APP_GEOAPIFY_KEY}`,
        center: [lon, lat],
        zoom: 12,
      });
    } else {
      mapRef.current.flyTo({
        center: [lon, lat],
        zoom: 12,
        speed: 1.2,
        curve: 1.4,
      });
    }

    const fetchPOIs = async () => {
      const url = `https://api.geoapify.com/v2/places?categories=tourism.attraction,catering.restaurant,entertainment.museum&filter=circle:${lon},${lat},5000&limit=50&apiKey=${process.env.REACT_APP_GEOAPIFY_KEY}`;

      const res = await axios.get(url);
      const pois = res.data.features;

      pois.forEach((poi) => {
        const [poiLon, poiLat] = poi.geometry.coordinates;
        const name = poi.properties.name || "Unknown place";
        const category = poi.properties.categories?.[0] || "POI";

        new maplibregl.Marker({ color: "#ff5722" })
          .setLngLat([poiLon, poiLat])
          .setPopup(
            new maplibregl.Popup().setHTML(`
              <strong>${name}</strong><br/>
              <small>${category}</small>
            `),
          )
          .addTo(mapRef.current);
      });
    };

    fetchPOIs();
  }, [lat, lon]);

  return (
    <div
      ref={mapContainer}
      style={{
        height: "70vh",
        width: "100%",
        borderRadius: "12px",
        overflow: "hidden",
        marginTop: "20px",
      }}
    />
  );
}
