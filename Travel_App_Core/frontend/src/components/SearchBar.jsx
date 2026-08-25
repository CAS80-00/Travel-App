import React from "react";
import {
  GeoapifyContext,
  GeoapifyGeocoderAutocomplete,
} from "@geoapify/react-geocoder-autocomplete";
import "@geoapify/geocoder-autocomplete/styles/minimal.css";
import { useNavigate } from "react-router-dom";

export default function SearchBar({ type, placeholder = "Search a city or country..." }) {
  const navigate = useNavigate();

  const handleSelect = (place) => {
    if (!place || !place.properties) return;

    const props = place.properties;
    const name =
      props.city || props.country || props.name || props.address_line1;

    if (!name) return;

    if (props.result_type === "country" || type === "country") {
      navigate(`/country/${name}`);
    } else {
      navigate(`/city/${name}`, {
        state: {
          cityName: name,
          country: props.country,
          lon: props.lon,
          lat: props.lat,
        },
      });
    }
  };

  return (
    <GeoapifyContext apiKey={process.env.REACT_APP_GEOAPIFY_KEY}>
      <GeoapifyGeocoderAutocomplete
        placeholder={placeholder}
        placeSelect={handleSelect}
        type={type}
      />
    </GeoapifyContext>
  );
}
