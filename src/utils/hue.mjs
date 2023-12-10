import axios from 'axios';
axios.defaults.baseURL = process.env["HUE_API_URL"]; 

async function printLights() {
  const lights = await listLights();
  const ids = Object.keys(lights);
  for(const id of ids){
    console.log(lights[id].name);
  }
  return lights;
}

async function changeLightsScene(name) {
  const scenes = await listScenes();
  const sceneBasic = Object.entries(scenes).find(([key, value]) => value.name === name);

  if(sceneBasic.length < 2){
    console.error(`No scene found with given name: ${name}`);
    return false;
  }

  const scene = await getScene(sceneBasic[0]);

  if(scene.lightstates == null || Object.keys(scene.lightstates).length < 1 ){
    console.error(`No lightstates found for scene with id: ${sceneBasic[0]}`);
    return false;
  }

  const lights = Object.keys(scene.lightstates);

  for(const id of lights){
    const result = await setLight(id, scene.lightstates[id]);
  }
}

async function changeLightsHue(hue) {
  const lights = await listLights();
  const ids = Object.keys(lights);
  for(const id of ids){
    await setLightHue(id, hue)
  }
}


async function listLights() {
  try {
      const response = await axios.get(`/lights`);
      return response.data;
  } catch (error) {
      console.error('Error fetching user data:', error);
      throw error;
  }
}



async function listScenes() {
  try {
      const response = await axios.get(`/scenes`);
      return response.data;
  } catch (error) {
      console.error('Error fetching user data:', error);
      throw error;
  }
}


async function getScene(id) {
  try {
      const response = await axios.get(`/scenes/${id}`);
      return response.data;
  } catch (error) {
      console.error('Error fetching user data:', error);
      throw error;
  }
}


async function setLightHue(id, hue) {
  try {
      const response = await axios.put(`/lights/${id}/state`, {
        "sat": 254,
        "bri": 254,
        "hue": hue
      });

      return response.data;
  } catch (error) {
      console.error('Error fetching user data:', error);
      throw error;
  }
}

async function setLight(id, state) {
  try {
      const response = await axios.put(`/lights/${id}/state`, {
        "sat": 254,
        "on": state.on,
        "bri": state.bri,
        "xy": state.xy
      });

      return response.data;
  } catch (error) {
      console.error('Error fetching user data:', error);
      throw error;
  }
}


export default { printLights, changeLightsHue, changeLightsScene };