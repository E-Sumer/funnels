import { useState } from "react";
import { useNavigate, useLocation } from "react-router";
import svgPaths from "../../../imports/svg-wlaq9ht641";

const NAV_GROUPS = [
  {
    title: "Menu Group Title",
    items: [
      { label: "APP Dashboard", icon: "dashboard" },
      { label: "Messages", icon: "messages1" },
      { label: "Messages", icon: "messages2" },
      { label: "Web Tools", icon: "webtools" },
      { label: "Journeys", icon: "journeys" },
      { label: "Mobile Widget", icon: "mobile" },
      { label: "Recommendation", icon: "recommendation" },
      { label: "Targeting", icon: "targeting" },
    ],
  },
  {
    title: "Menu Group Title",
    items: [{ label: "Email Marketing", icon: "email" }],
  },
  {
    title: "Menu Group Title",
    items: [
      { label: "Reports", icon: "reports" },
      { label: "Analytics", icon: "analytics", path: "/" },
      { label: "Experiences", icon: "experiences" },
    ],
  },
  {
    title: "Menu Group Title",
    items: [
      { label: "Settings", icon: "settings" },
      { label: "Developers", icon: "developers" },
      { label: "Catalog", icon: "catalog" },
      { label: "Connectors", icon: "connectors" },
      { label: "Support", icon: "support" },
    ],
  },
];

function NavIcon({ type }: { type: string }) {
  const cls = "absolute block inset-0";
  switch (type) {
    case "dashboard":
      return (
        <svg className={cls} fill="none" viewBox="0 0 16.5 16.5">
          <path d={svgPaths.pc3dd972} fill="#212121" />
        </svg>
      );
    case "messages1":
      return (
        <svg className={cls} fill="none" viewBox="0 0 20.9943 21.0003">
          <path d={svgPaths.p14675680} fill="#212121" />
        </svg>
      );
    case "messages2":
      return (
        <svg className={cls} fill="none" viewBox="0 0 19.5 17.9999">
          <path d={svgPaths.p16caa780} fill="#212121" />
        </svg>
      );
    case "webtools":
      return (
        <svg className={cls} fill="none" viewBox="0 0 19.5 20.9945">
          <path d={svgPaths.p3950a070} fill="#212121" />
        </svg>
      );
    case "journeys":
      return (
        <svg className={cls} fill="none" viewBox="0 0 18.0002 21.0084">
          <path d={svgPaths.p2906b080} fill="#212121" />
        </svg>
      );
    case "mobile":
      return (
        <svg className={cls} fill="none" viewBox="0 0 15.0115 20.2532">
          <path d={svgPaths.p300f8500} fill="#212121" />
        </svg>
      );
    case "recommendation":
      return (
        <svg className={cls} fill="none" viewBox="0 0 19.5 18">
          <path d={svgPaths.p33d1bc00} fill="#212121" />
        </svg>
      );
    case "targeting":
      return (
        <svg className={cls} fill="none" viewBox="0 0 19.5188 19.5188">
          <path d={svgPaths.p1997a200} fill="#212121" />
        </svg>
      );
    case "email":
      return (
        <svg className={cls} fill="none" viewBox="0 0 21 20.25">
          <path d={svgPaths.p34110900} fill="#212121" />
        </svg>
      );
    case "reports":
      return (
        <svg className={cls} fill="none" viewBox="0 0 16.5 21">
          <path d={svgPaths.p14108f00} fill="#212121" />
        </svg>
      );
    case "analytics":
      return (
        <svg className={cls} fill="none" viewBox="0 0 19.5 19.5">
          <path d={svgPaths.p29d40a00} fill="currentColor" />
        </svg>
      );
    case "experiences":
      return (
        <svg className={cls} fill="none" viewBox="0 0 19.5 19.5">
          <path d={svgPaths.p29d40a00} fill="#212121" />
        </svg>
      );
    case "settings":
      return (
        <svg className={cls} fill="none" viewBox="0 0 18 15">
          <path d={svgPaths.p2b36a800} fill="#212121" />
        </svg>
      );
    case "developers":
      return (
        <svg className={cls} fill="none" viewBox="0 0 18.0006 18.0004">
          <path d={svgPaths.p20036000} fill="#212121" />
        </svg>
      );
    case "catalog":
      return (
        <svg className={cls} fill="none" viewBox="0 0 20.25 16.5">
          <path d={svgPaths.p6d49400} fill="#212121" />
        </svg>
      );
    case "connectors":
      return (
        <svg className={cls} fill="none" viewBox="0 0 20.251 20.2508">
          <path d={svgPaths.pc7c5980} fill="#212121" />
        </svg>
      );
    case "support":
      return (
        <svg className={cls} fill="none" viewBox="0 0 19.5 19.5">
          <path d={svgPaths.p399c3c80} fill="#212121" />
        </svg>
      );
    default:
      return null;
  }
}

export function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [search, setSearch] = useState("");

  const isAnalytics =
    location.pathname === "/" ||
    location.pathname.startsWith("/funnel");

  return (
    <div
      className="flex flex-col bg-white border-r border-[#f5f5f5] overflow-y-auto flex-shrink-0"
      style={{ width: 168, height: "100vh" }}
    >
      {/* Top: Logo + collapse */}
      <div className="flex items-center justify-between px-3 py-3.5 border-b border-[#f5f5f5]">
        {/* Netmera logo using SVG paths */}
        <div className="flex flex-col gap-1.5">
          <div className="relative h-[13px] w-[90px]">
            <svg
              className="absolute inset-0"
              fill="none"
              viewBox="0 0 106.579 18"
              preserveAspectRatio="xMidYMid meet"
            >
              <path d={svgPaths.p30590f70} fill="#212121" />
              <path d={svgPaths.p3edbae80} fill="#212121" />
              <path clipRule="evenodd" d={svgPaths.p3c64fbc0} fill="#212121" fillRule="evenodd" />
              <path d={svgPaths.p30bffc80} fill="#212121" />
              <path clipRule="evenodd" d={svgPaths.p12256f00} fill="#212121" fillRule="evenodd" />
              <path d={svgPaths.p31ae62c0} fill="#212121" />
              <path clipRule="evenodd" d={svgPaths.p287b7900} fill="#212121" fillRule="evenodd" />
            </svg>
          </div>
          <p className="text-[10px] text-[#8a8a8a] font-medium leading-[15px]">
            Company name
          </p>
        </div>
        {/* Collapse arrow */}
        <div className="relative size-5 opacity-50">
          <svg className="absolute inset-0" fill="none" viewBox="0 0 17.4997 22.7505">
            <path d={svgPaths.p35587e70} fill="#D1D1D1" />
          </svg>
        </div>
      </div>

      {/* Separator */}
      <div className="h-1.5 bg-[#f5f5f5] border-y border-[#ededed]" />

      {/* App selector */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#f5f5f5]">
        <div className="flex items-center gap-1.5">
          {/* App icon */}
          <div className="relative size-[26px] flex-shrink-0">
            <svg className="absolute inset-0" fill="none" viewBox="0 0 38 38">
              <path d={svgPaths.p1d13a200} fill="#EDF9FF" />
              <path d={svgPaths.p32615c00} fill="#006BFF" />
              <path d={svgPaths.p23fb0480} fill="#006BFF" />
            </svg>
          </div>
          <div>
            <p className="text-[12px] font-semibold text-[#212121] leading-[17px]">APP</p>
            <p className="text-[10px] text-[#8a8a8a] font-medium leading-[14px]">NetmeraMain</p>
          </div>
        </div>
        <svg className="w-[10px] h-[14px] opacity-40" fill="none" viewBox="0 0 7.02007 11.25">
          <path clipRule="evenodd" d={svgPaths.pbba3a00} fill="#D1D1D1" fillRule="evenodd" />
        </svg>
      </div>

      {/* Search */}
      <div className="px-3 py-1.5">
        <div className="flex items-center justify-between bg-white border border-[#f5f5f5] rounded-md px-2 py-1.5">
          <input
            type="text"
            placeholder="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-[11px] text-[#8a8a8a] font-medium bg-transparent outline-none flex-1 placeholder-[#8a8a8a]"
          />
          <svg className="w-[14px] h-[14px]" fill="none" viewBox="0 0 14.6409 14.6409">
            <path d={svgPaths.pf022c00} fill="#C2C2C2" />
          </svg>
        </div>
      </div>

      {/* Nav groups */}
      <div className="flex-1 py-1">
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi}>
            {gi > 0 && (
              <div className="h-1.5 bg-[#f5f5f5] border-y border-[#ededed] my-1.5" />
            )}
            <div className="px-2">
              <p className="text-[10px] font-semibold text-[#8a8a8a] uppercase tracking-wider px-2 py-1.5">
                MAIN MENU
              </p>
              <div className="space-y-0.5">
                {group.items.map((item, ii) => {
                  const isActive =
                    item.path === location.pathname ||
                    (item.label === "Analytics" && isAnalytics);
                  return (
                    <button
                      key={ii}
                      onClick={() => item.path && navigate(item.path)}
                      className={`w-full flex items-center gap-1.5 h-8 px-2 py-1 rounded-md transition-colors text-left ${
                        isActive
                          ? "bg-[#EDF9FF] text-[#006bff]"
                          : "hover:bg-[#f5f5f5] text-[#212121]"
                      }`}
                    >
                      <div className="relative size-4 shrink-0">
                        <NavIcon type={item.icon} />
                      </div>
                      <span className="text-[12px] font-medium truncate">
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom bar */}
      <div>
        <div className="h-1.5 bg-[#f5f5f5] border-y border-[#ededed]" />
        {/* Logout | Notification */}
        <div className="flex border-t border-[#f5f5f5]">
          <button className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 hover:bg-[#f5f5f5] border-r border-[#f5f5f5] transition-colors">
            <svg className="size-[16px]" fill="none" viewBox="0 0 16.5 15.8125">
              <path d={svgPaths.p502ac80} fill="#8a8a8a" />
            </svg>
            <span className="text-[11px] font-medium text-[#8a8a8a]">Logout</span>
          </button>
          <button className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 hover:bg-[#f5f5f5] relative transition-colors">
            <div className="relative">
              <svg className="size-[16px]" fill="none" viewBox="0 0 16.4971 17.8742">
                <path d={svgPaths.p17e56700} fill="#8a8a8a" />
              </svg>
              <div className="absolute -top-0.5 -right-0.5 size-1.5 bg-red-500 rounded-full border border-white" />
            </div>
            <span className="text-[11px] font-medium text-[#8a8a8a]">Alerts</span>
          </button>
        </div>
        {/* User profile */}
        <div className="flex items-center justify-between px-3 py-2.5 border-t border-[#f5f5f5]">
          <div className="flex items-center gap-1.5">
            <div className="relative size-8 shrink-0">
              <svg className="absolute inset-0" fill="none" viewBox="0 0 48 48">
                <circle cx="24" cy="24" fill="#AB7CE0" r="24" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-white text-[10px] font-semibold">
                BA
              </div>
            </div>
            <div>
              <p className="text-[11px] font-medium text-[#212121]">Burak Alparslan</p>
              <p className="text-[10px] text-[#8a8a8a]">Europe/Istanbul</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}