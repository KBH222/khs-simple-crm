# US Census Address Lookup Setup

The application now includes **completely free** address lookup using the US Census Geocoding API. When you type in a street address, it will automatically lookup and populate the City, State, and ZIP fields.

## ✅ No Setup Required!

This integration uses the **free US Census Geocoding API** - no API keys, no accounts, no costs, no limits for reasonable use.

## How It Works:

1. **Type a street address** in the "Street Address" field
2. **Wait 1.5 seconds** after you stop typing (or click outside the field)
3. **Watch the magic** - City, State, and ZIP will automatically populate
4. **Visual feedback** - the address field border turns blue during lookup

## Features:

- **Completely FREE** - Uses US government's Census Geocoding API
- **No API keys required** - Works immediately out of the box
- **Debounced lookup** - Only makes requests after you stop typing (1.5 sec delay)
- **Smart behavior** - Won't overwrite existing City/ZIP if already filled
- **Desktop optimized** - Perfect for your customer input workflow
- **Fallback support** - Falls back to existing USPS validation if needed
- **US addresses only** - Works with all US addresses
- **Visual indicators** - Shows when lookup is happening

## Example Usage:

1. Type: `123 Main Street, Anytown, CA`
2. Wait 1.5 seconds or click elsewhere
3. City: `Anytown`, State: `CA`, ZIP: `12345` automatically fill in

## Benefits Over Google Maps:

- ✅ **$0 cost** vs Google's $2.83 per 1,000 requests
- ✅ **No API key setup** vs complex Google Cloud setup
- ✅ **No rate limits** vs Google's quotas
- ✅ **Government official data** vs commercial service
- ✅ **No terms of service concerns** vs Google's restrictions
- ✅ **Privacy friendly** - no tracking

## Technical Details:

- **API Endpoint**: `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress`
- **Data Source**: US Census Bureau's official address database
- **Response Format**: JSON with standardized address components
- **Debouncing**: 1.5 second delay to avoid excessive requests
- **Error Handling**: Graceful fallback to manual entry

## Troubleshooting:

- **Address not found**: The Census API may not recognize very new addresses or rural routes
- **Partial matches**: Sometimes returns standardized versions of street names
- **Network issues**: Falls back gracefully to manual entry
- **Check browser console** for any API errors or connectivity issues
