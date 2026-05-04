import { useDispatch } from "react-redux";
import { useNavigate as useRouterNavigate } from "react-router-dom";
import { setRoute, setSidebarOpen } from "../store";

export const navigateTo = (path) => {
  if (typeof window !== "undefined" && window.location.pathname !== path) {
    window.history.pushState({}, "", path);
    window.dispatchEvent(new Event("popstate"));
  }
};

export const useNavigate = () => {
  const dispatch = useDispatch();
  const navigate = useRouterNavigate();

  return (path, options) => {
    navigate(path, options);
    dispatch(setRoute(path));
    dispatch(setSidebarOpen(false));
  };
};
