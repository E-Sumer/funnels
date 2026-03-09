import { Outlet } from "react-router";
import { Sidebar } from "../components/layout/Sidebar";

export function Root() {
  return (
    <div className="flex h-screen overflow-hidden bg-[#fafafa]">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Outlet />
      </div>
    </div>
  );
}
