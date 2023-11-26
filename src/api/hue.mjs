import axios from 'axios';
axios.defaults.baseURL = 'http://192.168.4.39/api/zW9NVVWo9aihvss9LEN0aRLmXrAxIeypaeJY6K29';


async function printLights() {
  const lights = await listLights();
  const ids = Object.keys(lights);
  for(const id of ids){
    console.log(lights[id].name);
  }
  return lights;
}

async function changeLights(hue) {
  const lights = await listLights();
  const ids = Object.keys(lights);
  for(const id of ids){
    await setLight(id, hue)
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


async function setLight(id, hue) {
  try {
      const response = await axios.put(`/lights/${id}/state`, {
        "sat": 254,
        "bri":254,
        "hue": hue
      });

      return response.data;
  } catch (error) {
      console.error('Error fetching user data:', error);
      throw error;
  }
}


export default { printLights, changeLights };