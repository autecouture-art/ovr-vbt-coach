#!/bin/bash

# OVR VBT Coach - App Store Connect Registration Checklist
# This script provides a checklist for registering the app on App Store Connect

echo "=========================================="
echo "OVR VBT Coach - App Store Connect Checklist"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Checklist items
checklist=(
    "Log in to App Store Connect (https://appstoreconnect.apple.com)"
    "Click 'My Apps' and then '+' button"
    "Select 'New App'"
    "Fill in app information:"
    "  - Platform: iOS"
    "  - Name: OVR VBT Coach"
    "  - Primary Language: English"
    "  - Bundle ID: space.manus.ovr.vbt.coach.app.t20260125053732"
    "  - SKU: ovr-vbt-coach-001"
    "Click 'Create'"
    "Navigate to 'App Information' tab"
    "Fill in app details (see APP_STORE_METADATA.md)"
    "Upload app icon (1024x1024px)"
    "Navigate to 'App Store' tab"
    "Fill in app description"
    "Add keywords"
    "Upload screenshots (minimum 2 per device size)"
    "Upload app preview video (optional but recommended)"
    "Set age rating"
    "Fill in copyright information"
    "Set privacy policy URL"
    "Set support URL"
    "Navigate to 'Pricing and Availability'"
    "Set price tier to 'Free'"
    "Select availability regions"
    "Navigate to 'TestFlight' tab"
    "Create 'Internal Testers' group"
    "Add tester email addresses"
    "Wait for first build to complete"
    "Add build to Internal Testers"
    "Send invitations to testers"
)

echo -e "${BLUE}App Store Connect Registration Checklist:${NC}"
echo ""

for i in "${!checklist[@]}"; do
    item=$((i + 1))
    echo -e "[ ] $item. ${checklist[$i]}"
done

echo ""
echo "=========================================="
echo "Additional Resources:"
echo "=========================================="
echo ""
echo "📄 Documentation Files:"
echo "  - APP_STORE_METADATA.md - Metadata and descriptions"
echo "  - APP_STORE_CONNECT_SETUP.md - Detailed setup guide"
echo "  - MANUS_BUILD_GUIDE.md - Manus ビルド手順"
echo "  - DEPLOYMENT_SUMMARY.md - Complete deployment flow"
echo ""
echo "📸 Screenshots:"
echo "  - assets/screenshots/screenshot-1-home.png"
echo "  - assets/screenshots/screenshot-2-ble.png"
echo "  - assets/screenshots/screenshot-3-monitoring.png"
echo "  - assets/screenshots/screenshot-4-pr.png"
echo "  - assets/screenshots/screenshot-5-summary.png"
echo ""
echo "🎨 App Assets:"
echo "  - assets/images/icon.png (1024x1024px)"
echo "  - assets/images/splash-icon.png (200x200px)"
echo "  - assets/images/favicon.png (32x32px)"
echo "  - assets/images/android-icon-foreground.png"
echo "  - assets/images/android-icon-background.png"
echo "  - assets/images/android-icon-monochrome.png"
echo ""
echo "=========================================="
echo "Next Steps:"
echo "=========================================="
echo ""
echo "1. Complete the App Store Connect registration"
echo "2. Run Manus build: https://app.manus.im"
echo "3. Wait for build completion (30-60 minutes)"
echo "4. Add build to TestFlight"
echo "5. Invite internal testers"
echo "6. Monitor tester feedback"
echo "7. Fix bugs and submit new builds as needed"
echo ""
