// Save env vars from .env
import 'dotenv/config'
const calURL = process.env["CAL_URL"]; // .ics URL
const calName = process.env["CAL_NAME"]; // Unique String Name
const timeZone = process.env["TIME_ZONE"]; // E.g. America/Chicago
const timeRange = parseInt(process.env["TIME_RANGE"]);  // Seconds from NOW until future time limit
const alertRange = parseInt(process.env["ALERT_RANGE"]);  // Seconds until event 
const warningRange = parseInt(process.env["WARNING_RANGE"]); // Seconds until event 

if (calURL === undefined || calName === undefined || timeZone === undefined ||
    timeRange == 0 || (alertRange == 0 && warningRange == 0) ) {
      console.error("Missing Required env var(s).")
}

// Import Modules
import hue from './utils/hue.mjs';
import calendar from './utils/gcal.mjs';
import cron from 'node-cron';

syncCal();
checkEvents();

// Check events every minute (M-F, 8am-5pm)
cron.schedule('* 8-17 * * 0-5', async () => {
    await checkEvents();
});

// Sync Cal every hour (M-F, 7am-5pm)
cron.schedule('0 6-17 * * 0-5', async () => {
  await syncCal();
});

async function checkEvents() {  
  try{
    console.log("Checking for events...")
    const events = await calendar.getUpcomingEvents(calName, timeRange, timeZone);

    if(events.length > 0){
      console.log(`Found ${events.length} events. Next event in ${events[0].secondsUntil} seconds.`);
      await updateLights(events);
    } else {
      console.log("No events found.");
    }
  }catch(e){
    console.error("Error in checking events:", e);
  }
}

async function syncCal(){
  console.log("Syncing Cal...")
  await calendar.sync(calName, calURL, timeRange, timeZone);
  console.log("Finished Sync.")
}

async function updateLights(events){

  for(const event of events) {
    const startTime = event.secondsUntil;
    if( alertRange > 0 && startTime < alertRange && startTime > 0){
      hue.changeLightsScene("Miami");
      break;
    }
  
    if( warningRange > 0 && startTime < warningRange && startTime > 0){
      hue.changeLightsScene("Midsummer sun");
      break;
    }
  }
}