# Philips Hue Light Calendar Controller

Changes Philips Hue lights to alert the user about upcoming meetings. Parses iCal data, interfaces with Google Calendar, finds events within a specified time range, and updates Hue lights based on alert settings. 

This applications was created as both a utility, for meeting alerts, and as a test of the Google Calendar APIs. As such, it can be simplied by removing the Google APIs and parsing soley iCal data. Due to Google Calendar's long refresh time (when importing 3rd Party iCals), a forced "sync" (between the iCal and Google Cal) is done by removing the existing Google Calendar events and refilling them with events found in the configurable time range.

Parsing of iCal events is complicated by Rrules. A rrule issue can result in timezones converting incorrectly when event times are updated by the event creator. This has been mostly resolved within the gcal module, but may result from unfound edge cases. Please verify your timezones are all correct. 

The cron jobs to "sync" the calendar and check for events are hardcoded in the App file. These are set to run during business hours.

Please create a Philips Hue developer account to setup your Hue Bridge API access. The setup tutorial will provide you with an API key to use in your HUE_API_URL env var. 

To auth with Google Calendar API, you will need to provide a "secret.json" file in the root of this project. The application will automatically auth using this secret and generate a "token.json" file for future use. Please visit the Google OAuth2Client docs for more information on generating secrets. 