
import {onRequest} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

admin.initializeApp();
const userId = "testUserId"
export const LastWeeksData = onRequest((request, response) => {
  const db = admin.firestore();
  const colpath = `screentime/${userId}/${userId}`;
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // every day since 7 days ago in 'DD-MM-YYYY' format
  const dates = Array.from({length: 7}, (_, i) => {
    const date = new Date(sevenDaysAgo);
    date.setDate(date.getDate() + i);
    return date.toLocaleDateString("en-US");
  });

  const categories = ["music", "video", "programming", "social",
    "gaming", "other", "productivity"];
  const awClients = ["aw-server", "aw-server-rust"];
  const os = ["linux", "windows", "macos", "android", "ios"];

  const promises = [];
  for (const date of dates) {
    const jsonObj = JSON.parse(`{
      "date": "${date}",
      "userId": "${userId}",
      "public": true,
      "events": [
        {
          "timestamp": ${Date.parse(date) + Math.floor(
    Math.random()*1000*60*60*24)},
          "duration": ${Math.floor(Math.random() * 100000)},
          "data": {
            "category": "${categories[Math.floor(
    Math.random() * categories.length)]}",
            "client": "${awClients[Math.floor(
    Math.random() * awClients.length)]}",
            "os": "${os[Math.floor(Math.random() * os.length)]}"
          }
        },
        {
          "timestamp": ${Date.parse(date) + Math.floor(
    Math.random()*1000*60*60*24)},
          "duration": ${Math.floor(Math.random() * 100000)},
          "data": {
            "category": "${categories[Math.floor(
    Math.random() * categories.length)]}",
            "client": "${awClients[Math.floor(
    Math.random() * awClients.length)]}",
            "os": "${os[Math.floor(
    Math.random() * os.length)]}"
          }
        }
      ]
    }`);

    const promise = db.collection(colpath).add(jsonObj);
    promises.push(promise);
  }
  Promise.all(promises).then(() => {
    response.send("done\n");
  }).catch(() => {
    response.send("error\n");
  });
});
