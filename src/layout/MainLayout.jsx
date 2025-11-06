import Navbar from "../components/NavBar.jsx";
import { Outlet } from "react-router-dom";
import Footer from "../components/Footer.jsx";

const MainLayout = () => {
  return (
    <>
        <Navbar />
        <Outlet />
        <Footer />
    </>
  )
}

export default MainLayout
