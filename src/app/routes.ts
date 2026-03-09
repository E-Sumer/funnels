import { createBrowserRouter } from "react-router";
import { Root } from "./pages/Root";
import { FunnelsListPage } from "./pages/FunnelsListPage";
import { FunnelAnalysisPage } from "./pages/FunnelAnalysisPage";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    children: [
      { index: true, Component: FunnelsListPage },
      { path: "funnel/new", Component: FunnelAnalysisPage },
      { path: "funnel/:id", Component: FunnelAnalysisPage },
    ],
  },
]);
