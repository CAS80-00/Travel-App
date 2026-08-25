import { BrowserRouter, Routes, Route } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import CityPage from "./pages/CityPage";
import CountryPage from "./pages/Countrypage";
import ProfilePage from "./pages/ProfilePage";
import DashboardPage from "./pages/DashboardPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/city/:city" element={<CityPage />} />
        <Route path="/country/:country" element={<CountryPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
