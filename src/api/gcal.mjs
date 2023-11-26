// Imports
import axios from 'axios';
import { google } from 'googleapis';
import auth from './auth.mjs';
import { DateTime } from 'luxon';
import fetch from 'node-fetch';
import ical from 'node-ical';

const calendar = google.calendar( {
    version: 'v3',
    auth: await auth.getAuthClient()
});

async function getUpcomingEvents(name, range) {
  const calId = await getCalIdByName(name);
  if(!calId){
    console.log("Could not find cal with given name.");
    return;
  }
  const validEvents = await getCalendarEvents(calId);
  const upcoming = [];

  for(const event of validEvents){
    const secondsUntil = compareEventTimeWithCurrent(event, "America/Chicago");
    if(secondsUntil <= range){
      upcoming.push({id: event.id, secondsUntil, status: event.summary})
    }
  }
  return upcoming;
}

async function sync(name, url) {

  //Fetch Cals to find the one to reset and sync with url
  let syncCalendarId = await getCalIdByName(name);

  if(!syncCalendarId){
    console.log("No Calendars found with provided name. Creating one with name:", name);
    syncCalendarId = await createNewCalendar(name);
    if(!syncCalendarId) return false;
  }

  console.log("Syncing Cal Id:", syncCalendarId);

  // Force sync by clearing existing cal, creating a new one, and adding iCal data
  if(syncCalendarId){
    const successfullyCleared = await clearCalendar(syncCalendarId);
    if (successfullyCleared) {
      // Add imported iCal events to empty cal
      const successfullyAdded = await addICalToGoogleCalendar(url, syncCalendarId);
      if(successfullyAdded) return true;
    }
    return false;
  }

  return false;
}


async function getCalIdByName(name){
   const calendarList = await listCalendars();

   for( var cal of calendarList) {
       if( cal.summary === name ){
         return cal.id;
       }
   }

   return false;
}

async function listCalendars() {
  try {
      
       // Acquire an auth client, and bind it to all future calls
      // const authClient = await auth.getAuthClient();
      // google.options({auth: authClient});

      // Fetch cals and return if present
      const res = await calendar.calendarList.list();
      if(res.data && res.data.items.length ){
        return res.data.items;
      }
      
      console.log("No calendars found for user.")
      return [];
  } catch (error) {
      console.error('Error fetching calendar list:', error);
      return [];
  }
}

async function getCalendarEvents(id) {
  try {
      
       // Acquire an auth client, and bind it to all future calls
      // const authClient = await auth.getAuthClient();
      // google.options({auth: authClient});
      const res = await calendar.events.list({
        calendarId: id,
        timeMin: (new Date()).toISOString(),
        maxResults: 100,
        singleEvents: true,
        orderBy: 'startTime',
    });

    const events = res.data.items;
    const validEvents = [];
    if (events.length) {
        events.forEach((event) => {
            if(event.start.dateTime){
              validEvents.push(event);
            }
        });
    } 

    return validEvents;
  } catch (error) {
      console.error('Error fetching calendar:', error);
      throw error;
  }
}

async function createNewCalendar(name) {
  try {

      // Acquire an auth client, and bind it to all future calls
      // const authClient = await auth.getAuthClient();
      // google.options({auth: authClient});

      const res = await calendar.calendars.insert({
          requestBody: {
              summary: name, 
              timeZone: 'America/Chicago'
          }
      });

      const calendarId = res.data.id;
      console.log(`New calendar created: ${name} (ID: ${calendarId})`);
      return calendarId;
  } catch (error) {
      console.error('Error occurred while creating new calendar:', error);
      return false;
  }
}

async function clearCalendar(calendarId) {
  try {
      // List all events in the calendar
      const events = await getCalendarEvents(calendarId);

      if (events.length) {
        console.log("Deleting", events.length, `event(s) from calendar: ${calendarId}`);

        // Delete each event
        for (const event of events) {
          await deleteCalEvent(calendarId, event.id);
        }
        console.log('All events deleted successfully.');
      } else {
        console.log('No events found in the calendar.');
      }

      return true;
  } catch (error) {
      console.error('Error occurred while clearing calendar:', error);
      return false;
  }
}


async function deleteCalEvent(calendarId, eventId){
  try {
      await calendar.events.delete({
        calendarId: calendarId,
        eventId
      });
      return true;
  } catch (error) {
      console.error('Error occurred while deleting calendar event:', error);
      return false;
  }

}

async function addICalToGoogleCalendar(icalUrl, calendarId) {
  try {
      // Fetch the iCal data
      const response = await fetch(icalUrl);
      const icalData = await response.text();

      // Parse the iCal data
      const icalParse = ical.parseICS(icalData);
      const events = Object.values(icalParse);
      let eventsAdded = 0;
      // Loop through the events and add them to Google Calendar
      for (const event of events) {
          if(!event.start || event.datetype !== "date-time") continue;
          
          const requestBody = {
            summary: event.summary,
            start: { dateTime: event.start.toISOString(), timeZone:  "America/Chicago" },
            end: { dateTime: event.end.toISOString() },
            
          };
   
          const timeDif = compareEventTimeWithCurrent(requestBody, "America/Chicago");
          if(timeDif > 108000 || timeDif < 0) continue;

          // Convert the event to Google Calendar format and add it
          await calendar.events.insert({
              calendarId,
              requestBody
          }); 
          eventsAdded += 1;
      }
      console.log("Added", eventsAdded, "event(s) to cal.");
      return true;
  } catch (error) {
      console.error('Error occurred:', error);
      return false;
  }
}

// Function to compare event time with current time in a specific timezone
function compareEventTimeWithCurrent(eventData, myTimeZone) {
  // Parse the event time
  const eventTime = DateTime.fromISO(eventData.start.dateTime, { zone: eventData.start.timeZone });

  // Get the current time in your timezone
  const currentTime = DateTime.now().setZone(myTimeZone);

  // Calculate the difference in milliseconds
  const diffInMilliseconds = eventTime.diff(currentTime).milliseconds;

  // Convert milliseconds to a more readable format, e.g., minutes
  const diffInSeconds = diffInMilliseconds / 1000;
  return parseInt(diffInSeconds);
}

export default { getUpcomingEvents, sync };