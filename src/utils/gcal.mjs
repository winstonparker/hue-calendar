// Imports
import axios from 'axios';
import { google } from 'googleapis';
import auth from './auth.mjs';
import { DateTime } from 'luxon';
import fetch from 'node-fetch';
import ical from 'node-ical';
import moment from 'moment-timezone';
import rrule from 'rrule';
const { RRule } = rrule;


const calendar = google.calendar( {
    version: 'v3',
    auth: await auth.getAuthClient()
});

async function getUpcomingEvents(name, range, timeZone) {
  const calId = await getCalIdByName(name);
  if(!calId){
    console.error("Could not find cal with given name.");
    return;
  }
  const validEvents = await getCalendarEvents(calId);
  const upcoming = [];

  for(const event of validEvents){
    const secondsUntil = compareEventTimeWithCurrent(event, timeZone);
    if(secondsUntil <= range){
      upcoming.push({id: event.id, secondsUntil, status: event.summary})
    }
  }
  return upcoming;
}

async function sync(name, url, timeRange, timeZone) {

  // Fetch Cals to find the one to reset and sync with iCal url
  let syncCalendarId = await getCalIdByName(name);

  // If first time syncing, create a secondary calendar for upcoming iCal events
  if(!syncCalendarId){
    // console.log("No Calendars found with provided name. Creating new one with name:", name);
    syncCalendarId = await createNewCalendar(name, timeZone);
    if(!syncCalendarId) return false;
  }

  // console.log("Syncing Cal Id:", syncCalendarId);

  // Force sync by clearing existing calendar and adding upcoming events from iCal
  if(syncCalendarId){
    const successfullyCleared = await clearCalendar(syncCalendarId);
    
    // Add imported iCal events to empty cal
    if (successfullyCleared) {
      const successfullyAdded = await addICalToGoogleCalendar(url, syncCalendarId, timeRange, timeZone);
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

// Get list of all a user's calendars
async function listCalendars() {
  try {
      const res = await calendar.calendarList.list();
      if(res.data && res.data.items.length ){
        return res.data.items;
      }
      
      // console.log("No calendars found for user.")
      return [];
  } catch (error) {
      console.error('Error fetching calendar list:', error);
      return [];
  }
}

// Get future events (excludes "All Day" events)
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

// Creates a new secondary calendar
async function createNewCalendar(name, timeZone) {
  try {
      const res = await calendar.calendars.insert({
          requestBody: {
              summary: name, 
              timeZone
          }
      });

      const calendarId = res.data.id;
      // console.log(`New calendar created: ${name} (ID: ${calendarId})`);
      return calendarId;
  } catch (error) {
      console.error('Error occurred while creating new calendar:', error);
      return false;
  }
}

// clears all events from a secondary calendar (USE WITH CAUTION)
async function clearCalendar(calendarId) {
  try {
      // List all events in the calendar
      const events = await getCalendarEvents(calendarId);

      if (events.length) {
        // console.log("Deleting", events.length, `event(s) from calendar: ${calendarId}`);

        // Delete each event
        for (const event of events) {
          await deleteCalEvent(calendarId, event.id);
        }

        // console.log('All events deleted successfully.');
      } else {
        // console.log('No events found in the calendar.');
      }

      return true;
  } catch (error) {
      console.error('Error occurred while clearing calendar:', error);
      return false;
  }
}

// deletes an event from a secondary calendar (USE WITH CAUTION)
async function deleteCalEvent(calendarId, eventId){
  try {
      await calendar.events.delete({
        calendarId: calendarId,
        eventId
      });
      return true;
  } catch (error) {
      // console.error('Error occurred while deleting calendar event:', error);
      return false;
  }

}

// Fetches data from an iCal URL. 
// Adds events occuring in the timeRange (excludes "All Day" events) 
async function addICalToGoogleCalendar(icalUrl, calendarId, timeRange, timeZone) {
  try {
      // Fetch the iCal data
      const response = await fetch(icalUrl);
      const icalData = await response.text();

      // Parse the iCal data
      const icalParse = ical.parseICS(icalData);
      // const icalExpander = new IcalExpander({ ics: icalData, maxIterations: 10 });

      let events = Object.values(icalParse);
      const allEvents = [];

      events.forEach((event) => {   
            if (event.type === 'VEVENT') {
              if (event.rrule) {
                  // Process recurring event
                  const rule = RRule.fromString(event.rrule.toString());
                  const occurrences = rule.between(moment().toDate(), moment().add(timeRange, 'seconds').toDate());
                  let startTime = moment(event.start);
                  let endTime = moment(event.end);

                  occurrences.forEach(occurrence => {

                    // TODO - CONVERT the occurence time to a UTC time for google
                    // right now it is in the timezone of whoever created it and google thinks I am giving it a UTC time (so the time comes way earlier than it should)


                    const duration = endTime.diff(startTime, "minutes");
                    const end = new Date(occurrence.getTime());
                    end.setMinutes(end.getMinutes() + duration);
                    
                    const newEvent = {
                        ...event,
                        start: occurrence,
                        end
                    };
                    // console.log("________________________________________________");
                    allEvents.push(newEvent);
                    return;
                  });
              } 
          }
          allEvents.push(event);
          
      });

      let eventsAdded = 0;
      // Loop through the events and add them to Google Calendar
      for (const event of allEvents) {

          if(!event.start || event.datetype !== "date-time") continue;
          
          const requestBody = {
            summary: event.summary,
            start: { dateTime: event.start.toISOString(), timeZone },
            end: { dateTime: event.end.toISOString() , timeZone}
          };

          const timeDif = compareEventTimeWithCurrent(requestBody, timeZone);
          if(timeDif > timeRange || timeDif < 0) continue;

          console.log(requestBody);
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