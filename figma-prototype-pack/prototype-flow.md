# OxyGuard V3 Prototype Flow

## 1. Login

Purpose: secure entry screen for biomedical users.

Fields:

- Username
- Password

Valid credentials:

- Username: `admin`
- Password: `admin1234`

Primary action:

- Login -> Dashboard

Error state:

- Invalid username or password.

## 2. Dashboard

Purpose: live oxygen monitoring overview.

Main content:

- Hospital oxygen pipeline legend
- Ward cards for A&E Ward, Labour Ward, Paediatric Ward, Recovery Bay, Nurse Station
- System metrics real-time panel
- Rotating total flow per ward
- Low volume tanks
- System status

Interactions:

- Ward card click -> ward detail modal
- Reset Demo -> reset live simulation
- Sidebar Report -> Report
- Sidebar Order Summary -> Order Summary
- Sidebar Analytics -> Analytics
- Sidebar Logout -> Login

## 3. Order Summary

Purpose: automated replenishment review and approval.

Main content:

- Order automation triggered banner
- Automation protocol countdown
- Justification summary
- Projected order details
- Delivery and installation plan
- Capacity and forecast summary

Interactions:

- View Protocol Details -> protocol details overlay
- Download Summary -> downloaded prompt
- Reject Order -> rejected prompt
- Confirm Order Now -> confirmed prompt

## 4. Report

Purpose: operational report using dashboard telemetry.

Main content:

- Summary metrics
- St.Catherine Medical heat map
- Ward flow comparison
- Tank volume levels
- Alert distribution
- Ward oxygen usage table
- Leakage alerts by ward
- Tank depletion monitoring

Interactions:

- Email Report -> email sent prompt
- Print -> print preview
- Refresh Report -> update report data

## 5. Analytics

Purpose: monthly consumption and leakage cost analysis.

Main content:

- Monthly tank usage by ward for Jan-May
- Tank cost: JMD 588,000
- Monthly leakage wastage by ward
- Top ward consumption and dollar value
- Top ward wastage and dollar value
- Ward monthly totals table

Interactions:

- Refresh Analytics -> refresh analytics data

