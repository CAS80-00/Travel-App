import React from "react";
import {
  GeoapifyContext,
  GeoapifyGeocoderAutocomplete,
} from "@geoapify/react-geocoder-autocomplete";

const AppLayout = ({ children }) => {
  return (
    <div>
      {/* Global search bar */}
      <div className="global-searchbar">
        <GeoapifyContext apiKey={process.env.REACT_APP_GEOAPIFY_KEY}>
          <GeoapifyGeocoderAutocomplete
            placeholder="Search a city or country..."
            placeSelect={(place) => {
              if (!place || !place.properties) return;
              const props = place.properties;
              const name =
                props.city ||
                props.country ||
                props.name ||
                props.address_line1;

              if (!name) return;

              if (props.result_type === "country") {
                window.location.href = `/country/${name}`;
              } else {
                window.location.href = `/city/${name}`;
              }
            }}
          />
        </GeoapifyContext>
      </div>

      {/* Page content */}
      <div className="page-content">{children}</div>
    </div>
  );
};

export default AppLayout;
