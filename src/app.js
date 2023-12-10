// Save env vars from .env
import 'dotenv/config'
const calURL = process.env["CAL_URL"];
const calName = process.env["CAL_NAME"];
const timeZone = process.env["TIME_ZONE"];
const timeRange = parseInt(process.env["TIME_RANGE"]);
const alertRange = parseInt(process.env["ALERT_RANGE"]);
const warningRange = parseInt(process.env["WARNING_RANGE"]);

if (calURL === undefined || calName === undefined || timeZone === undefined ||
    timeRange == 0 || (alertRange == 0 && warningRange == 0) ) {
      console.error("Missing Required env var(s).")
}

// Import Modules
import hue from './utils/hue.mjs';
import calendar from './utils/gcal.mjs';
import cron from 'node-cron';
import chalk from 'chalk';
import chalkAnimation from 'chalk-animation';

const checkRainbow = chalkAnimation.rainbow("");
const syncAnimation = chalkAnimation.glitch("");

syncCal()
checkEvents();

// Check events every minute (M-F, 8am-5pm)
cron.schedule('* 8-17 * * 0-5', async () => {
    checkRainbow.start();
    checkRainbow.replace("Checking for events...");
    await checkEvents();
    checkRainbow.render();
    checkRainbow.stop();
});

// Sync Cal every hour (M-F, 7am-5pm)
cron.schedule('0 6-17 * * 0-5', async () => {
  syncAnimation.start();
  syncAnimation.replace("Syncing Cal...")
  await syncCal();
  syncAnimation.replace("Finished Sync.")
  syncAnimation.render();
  syncAnimation.stop();
});

async function checkEvents() {  
  try{
    const events = await calendar.getUpcomingEvents(calName, timeRange, timeZone);

    if(events.length > 0){
      checkRainbow.replace(`Found ${events.length} events. Next event in ${events[0].secondsUntil} seconds.`)
      await updateLights(events);
    } else {
      checkRainbow.replace("No events found.");
    }
  }catch(e){
    console.error("Error in checking events:", e);
  }
}

async function syncCal(){
  await calendar.sync(calName, calURL, timeRange, timeZone);
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

  hue.changeLights(30000)
}