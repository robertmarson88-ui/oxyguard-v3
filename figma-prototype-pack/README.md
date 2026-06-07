# OxyGuard V3 Figma Prototype Pack

This folder is a Figma handoff package for the OxyGuard V3 web prototype.

## App Location

Local project folder:

`C:\Users\twcl.ssa\Desktop\OxyGuard V3`

Running prototype URL:

`http://127.0.0.1:4190/`

Login:

- Username: `admin`
- Password: `admin1234`

## Recommended Figma Setup

Create these Figma pages:

1. Cover
2. Prototype Screens
3. Components
4. Design Tokens
5. User Flow

Create these desktop frames at `1440 x 900`:

1. Login
2. Dashboard
3. Order Summary
4. Report
5. Analytics

## Fastest Import Method

Use a Figma HTML import plugin such as `html.to.design`.

Import the running page:

`http://127.0.0.1:4190/`

If the plugin cannot access localhost, open the app in your browser, capture each screen as a full-page PNG, then drag the PNGs into Figma and trace/rebuild the components.

## Prototype Links

Wire these interactions in Figma:

- Login button -> Dashboard
- Dashboard sidebar `Order Summary` -> Order Summary
- Dashboard sidebar `Report` -> Report
- Dashboard sidebar `Analytics` -> Analytics
- Sidebar `Dashboard` on any page -> Dashboard
- Sidebar `Logout` on any page -> Login
- Order Summary `Confirm Order Now` -> confirmation overlay
- Order Summary `Reject Order` -> rejected overlay
- Report `Email Report` -> email sent overlay
- Report `Print` -> print preview state

## Files In This Pack

- `prototype-flow.md`: screen-by-screen user flow
- `design-tokens.json`: colors, typography, spacing, and component guidance
- `oxyguard-prototype-map.svg`: importable visual flow map for Figma
