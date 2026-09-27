"""
VigilAI - Automated Application Screenshot Capture Script
Uses Playwright to capture high-fidelity desktop screenshots of the working system.
"""

import time
from pathlib import Path
from playwright.sync_api import sync_playwright

OUTPUT_DIR = Path(__file__).resolve().parent.parent / "docs" / "screenshots"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
BASE_URL = "http://localhost:3000"

def capture():
    print(f"Saving screenshots to: {OUTPUT_DIR}")
    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path=CHROME_PATH,
            headless=True,
            args=["--disable-web-security"]
        )
        context = browser.new_context(
            viewport={"width": 1440, "height": 900},
            device_scale_factor=1.25,
        )
        page = context.new_page()

        # 1. Login
        print("Navigating to login...")
        page.goto(f"{BASE_URL}/login")
        page.wait_for_selector('input[type="email"]')
        page.fill('input[type="email"]', "admin@vigilai.local")
        page.fill('input[type="password"]', "vigilai_dev_2024")
        page.click('button[type="submit"]')

        # 2. Wait for Dashboard
        print("Waiting for dashboard redirect...")
        page.wait_for_url("**/dashboard", timeout=15000)
        time.sleep(3)  # Allow dashboard charts and live metrics to populate
        dash_path = OUTPUT_DIR / "dashboard.png"
        page.screenshot(path=str(dash_path))
        print(f"Captured: {dash_path}")

        # 3. Live Surveillance Monitor
        cam_id = "6f88b059-68e0-49ff-9e4e-fc9cf232241d"
        print(f"Navigating to camera monitor: {cam_id}...")
        page.goto(f"{BASE_URL}/cameras/{cam_id}")
        page.wait_for_selector("img[alt='Live Surveillance Feed'], div.aspect-video", timeout=15000)
        time.sleep(4)  # Allow stream frames and tracking detections to render
        monitor_path = OUTPUT_DIR / "live-monitor.png"
        page.screenshot(path=str(monitor_path))
        print(f"Captured: {monitor_path}")

        # 4. Spatial Zone & Virtual Tripwire Editor
        print(f"Navigating to camera geometry configuration...")
        page.goto(f"{BASE_URL}/cameras/{cam_id}/configure")
        page.wait_for_selector("canvas", timeout=15000)
        time.sleep(3)  # Allow zones, points, and canvas overlay to draw
        zones_path = OUTPUT_DIR / "spatial-zones.png"
        page.screenshot(path=str(zones_path))
        print(f"Captured: {zones_path}")

        # 5. Events Dossier
        print("Navigating to events audit dossier...")
        page.goto(f"{BASE_URL}/events")
        time.sleep(3)  # Allow table and event badges to populate
        events_path = OUTPUT_DIR / "event-dossier.png"
        page.screenshot(path=str(events_path))
        print(f"Captured: {events_path}")

        # 6. Analytics Overview
        print("Navigating to analytics charts...")
        page.goto(f"{BASE_URL}/analytics")
        time.sleep(3)  # Allow charts to render
        analytics_path = OUTPUT_DIR / "analytics.png"
        page.screenshot(path=str(analytics_path))
        print(f"Captured: {analytics_path}")

        # 7. System & Worker Health
        print("Navigating to system telemetry...")
        page.goto(f"{BASE_URL}/system")
        time.sleep(2)
        system_path = OUTPUT_DIR / "system-health.png"
        page.screenshot(path=str(system_path))
        print(f"Captured: {system_path}")

        browser.close()
        print("All screenshots successfully captured!")

if __name__ == "__main__":
    capture()
