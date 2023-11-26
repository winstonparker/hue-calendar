// Get env vars
import 'dotenv/config'

// Import Modules
import hue from './api/hue.mjs';
import calendar from './api/gcal.mjs';

const calURL = process.env["CAL_URL"];
const calName = process.env["CAL_NAME"];

const timeRange = 164831;
const startRange = 139986;
const warningRange = 139986;

await checkEvents();

async function checkEvents(){
  const events = await calendar.getUpcomingEvents(calName,timeRange );
  await updateLights(events);
}

async function syncCal(){
  await calendar.sync(calName, calURL);
}

async function updateLights(events){

  for(const event of events) {
    const startTime = event.secondsUntil;
    if( startTime < startRange && startTime > 0){
      hue.changeLights(50000)
      break;
    }
  
    if(startTime < warningRange && startTime > 0){
      hue.changeLights(1000)
      break;
    }
  }
}