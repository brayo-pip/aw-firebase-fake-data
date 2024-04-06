import {onRequest} from "firebase-functions/v2/https";
import {onObjectFinalized} from "firebase-functions/v2/storage";
import {onSchedule} from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import * as genKey from "generate-api-key";
import {info, error} from "firebase-functions/logger";
import {RawEvent, Event, defaultCategories} from "./types";

admin.initializeApp();
let userId = "testUserId";

exports.onUserCreated = functions.auth.user().onCreate((user) => {
  info("User created: ", user.uid);
  const db = admin.firestore();
  const colpath = "users";
  const docpath = user.uid;
  const apiKey = genKey.generateApiKey();
  const jsonObj = JSON.parse(`{"apiKey": "${apiKey}"}`);
  return db.collection(colpath).doc(docpath).set(jsonObj);
});

exports.onUserDeleted = functions.auth.user().onDelete((user) => {
  info("User deleted: ", user.uid);
  const db = admin.firestore();
  const colpath = "users";
  const docpath = user.uid;
  return db.collection(colpath).doc(docpath).delete();
});

// eslint-disable-next-line require-jsdoc
function generateRandomString(length: number) {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"+
  "abcdefghijklmnopqrstuvwxyz"+"123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

export const LastWeeksData = onRequest((request, response) => {
  const db = admin.firestore();
  const colpath = `screentime/${userId}/${userId}`;
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // every day since 7 days ago in 'YYYY-MM-DD' format
  const dates = Array.from({length: 7}, (_, i) => {
    const date = new Date(sevenDaysAgo);
    date.setDate(date.getDate() + i);
    return date.toISOString().split("T")[0].replace(/\//g, "-"); // Not yet tested
  });

  const categories = [
    "music",
    "video",
    "programming",
    "social",
    "gaming",
    "other",
    "productivity",
  ];
  const awClients = ["aw-server", "aw-server-rust"];
  const os = ["linux", "windows", "macos", "android", "ios"];

  const promises = [];
  for (let numOfDocsPerUser = 0; numOfDocsPerUser < 10; numOfDocsPerUser++) {
    for (const date of dates) {
      const jsonObj = JSON.parse(`{
      "date": "${date}",
      "userId": "${userId}",
      "public": true,
      "events": [
        {
          "timestamp": ${
  Date.parse(date) + Math.floor(Math.random() * 1000 * 60 * 60 * 24)
},
          "duration": ${Math.floor(Math.random() * 100000)},
          "data": {
            "category": "${
  categories[Math.floor(Math.random() * categories.length)]
}",
            "client": "${
  awClients[Math.floor(Math.random() * awClients.length)]
}",
            "os": "${os[Math.floor(Math.random() * os.length)]}"
          }
        },
        {
          "timestamp": ${
  Date.parse(date) + Math.floor(Math.random() * 1000 * 60 * 60 * 24)
},
          "duration": ${Math.floor(Math.random() * 100000)},
          "data": {
            "category": "${
  categories[Math.floor(Math.random() * categories.length)]
}",
            "client": "${
  awClients[Math.floor(Math.random() * awClients.length)]
}",
            "os": "${os[Math.floor(Math.random() * os.length)]}"
          }
        }
      ]
    }`);

      const promise = db.collection(colpath).doc(date).set(jsonObj);
      promises.push(promise);
    }
  }
  Promise.all(promises)
    .then(() => {
      response.send("done\n");
    })
    .catch(() => {
      response.send("error\n");
    });
});

export const LeaderboardData= onRequest((request, response) => {
  const db = admin.firestore();
  const promises = [];
  const categories = [
    "music",
    "video",
    "programming",
    "social",
    "gaming",
    "other",
    "productivity",
  ];
  for (let i = 0; i < 10; i++) {
    userId = generateRandomString(20);
    info("userId: ", userId);
    const colpath = "leaderboard";
    const jsonObj = JSON.parse(`{
    "userId": "${userId}",
    "CategoryTotals" : {
      "${categories[Math.floor(Math.random() * categories.length)]}":
       ${Math.floor(Math.random() * 0.5 * 60* 60 * 24)},
      "${categories[Math.floor(Math.random() * categories.length)]}":
        ${Math.floor(Math.random() * 0.5 * 60 * 60 * 24)},
      "${categories[Math.floor(Math.random() * categories.length)]}":
        ${Math.floor(Math.random() * 0.5 * 60 * 60 * 24)}
    }
  }`);
    const promise = db.collection(colpath).doc(userId).set(jsonObj);
    promises.push(promise);
  }
  Promise.all(promises)
    .then(() => {
      response.send("done\n");
    })
    .catch(() => {
      response.send("error\n");
    });
});

export const UpdateLeaderboardData = onSchedule("every day 00:00", async (event) => {
  // WIP
    info("Updating leaderboard data");
      const db = admin.firestore();
      const destinationColpath = "leaderboard";
      const screentimeColpath = "screentime/";
      const screenTimeDocs = await db.collection(screentimeColpath).listDocuments();
      let totals = new Map<string, number>();
      const promises = [];
      for (const userDoc of screenTimeDocs){
        const sourceColpath = "screentime/" + userDoc.id + "/" + userDoc.id;
        const screenTimeUserDocs = await db.collection(sourceColpath).listDocuments();
        for (const screenTimeUserDoc of screenTimeUserDocs) {
          const doc = await screenTimeUserDoc.get();
          const events = doc.data()?.events as Event[];
          // info("events: ", events);
          totals.set("total", 0);
          for (const event of events) {
            const category = event.category.length > 0 ? event.category[0] as string : "Other";
            // info("category: ", category)";
            totals.set(category, (totals.get(category) || 0) + event.duration);
            totals.set("total", (totals.get("total") || 0) + event.duration);
          }
        // const total = totals.get("Total");
        const userId = (await screenTimeUserDoc.get()).data()?.userId;
        const date = (await screenTimeUserDoc.get()).data()?.date;
        totals.delete("total");
        for (const [category, total] of totals.entries()) {
          const docpath = date;
          const docref = db.collection(destinationColpath).doc(docpath);
          const doc = await docref.get();
          if (doc.exists) {
            const categoryTotals = doc.data()?.CategoryTotals as { [key: string]: number };
            const keys  = Object.keys(categoryTotals);
              if (keys.includes(category)) {
                categoryTotals[category] += total;
              } else {
                categoryTotals[category] = total;
              }
            const promise = docref.update({CategoryTotals: categoryTotals, total: total + doc.data()?.total});
            promises.push(promise);
          } else {
            const jsonObj = Object.fromEntries(totals);
            const promise = docref.set({CategoryTotals: jsonObj, total: total, userId: userId, date: date});
            promises.push(promise);
          }
        }
      
      } 
      await Promise.all(promises);
      }
    }
  );
export const getApiKey = functions.https.onCall(async (_, context) => {
  /** A callable function only executed when the user is logged in */
  info("Getting ApiKey");
  info("Request data: ", context);
  if (!context.auth) {
    error("Not authenticated");
    return {error: "Not authenticated"};
  }
  const db = admin.firestore();
  const colpath = "users";
  const docpath = context.auth?.uid;
  const docref = db.collection(colpath).doc(docpath);
  const doc = await docref.get();
  if (doc.exists && doc.data() && doc.data()?.apiKey) {
    info("ApiKey found and sent to client");
    return {apiKey: doc.data()?.apiKey};
  } else {
    const apiKey = genKey.generateApiKey();
    await docref.set({apiKey: apiKey});
    info("ApiKey set and sent to client");
    return {apiKey: apiKey};
  }
});
export const rotateApiKey = functions.https.onCall(async (_, context) => {
  /** A callable function only executed when the user is logged in */
  info("Rotating ApiKey");
  info("Request data: ", context);
  if (!context.auth) {
    error("Not authenticated");
    return {error: "Not authenticated"};
  }
  const db = admin.firestore();
  const colpath = "apiKeys";
  const docpath = context.auth?.uid;
  const docref = db.collection(colpath).doc(docpath);
  const doc = await docref.get();
  if (doc.exists && doc.data() && doc.data()?.apiKey) {
    const apiKey = genKey.generateApiKey();
    await docref.update({apiKey: apiKey});
    info("ApiKey rotated and sent to client");
    return {apiKey: apiKey};
  } else {
    await docref.set({apiKey: genKey.generateApiKey()});
    info("ApiKey set and sent to client");
    return {apiKey: doc.data()?.apiKey};
  }
});

exports.uploadData = onRequest(async (request, response) => {
  info("Storing data");
  info("Request data: ", request.body);
  if (!request.body.apiKey) {
    error("No apiKey provided!");
    response.status(400).send({error: "No apiKey provided!"});
    return;
  }
  if (!request.body.data) {
    error("No data provided to store!");
    response.status(400).send({error: "No data provided!"});
    return;
  }

  const apiKey = request.body.apiKey;
  const db = admin.firestore();
  const querySnapshot = await db.collection("users")
    .where("apiKey", "==", apiKey)
    .get();
  info("QuerySnapshot: ", querySnapshot);
  if (querySnapshot.empty) {
    error("Invalid apiKey provided!");
    response.status(403).send({error: "Invalid apiKey provided!"});
    return;
  }
  const userId = querySnapshot.docs[0].id;
  const bucket = admin.storage().bucket();
  const dataToStore = request.body.data;

  const filename = `${userId}/${Date.now()}.json`;
  const file = bucket.file(filename);
  await file.save(dataToStore);

  response.send({message: "Data stored successfully!"});
});

exports.onUploadData = onObjectFinalized(
  {cpu: 4}, async (event) => {
    info("Processing uploaded data");
    const file = event.data;
    const bucket = admin.storage().bucket();
    const data = await bucket.file(file.name).download();
    const userId = file.name.split("/")[0];
    const dataString = data.toString();
    const jsonData: [RawEvent] = JSON.parse(dataString);
    const db = admin.firestore();
    const batch = db.batch();
    const colpath = `screentime/${userId}/${userId}`;
    const promises = [];
    const dateMap = new Map<string, Event[]>();
    for (const rawEvent of jsonData) {
      // reduce from type RawEvent to Event
      let category = [] as string[];
      for (const cat of defaultCategories) {
        if (cat.rule.regex?.test(rawEvent.data?.app)) {
          category = cat.name;
          break;
        }
      }
      const event:Event = {
        timestamp: rawEvent.timestamp,
        duration: rawEvent.duration,
        data: rawEvent.data,
        category: category,
      };

      let date = new Date(event.timestamp).toISOString().split("T")[0];
      date = date.replace(/\//g, "-");
            if (dateMap.has(date)) {
              dateMap.get(date)?.push(event);
          } else {
              dateMap.set(date, [event]);
          }
    }
      const dates = dateMap.entries();
      for (const [date, events] of dates) {
        const promise = db.collection(colpath).doc(date).get().then((doc) => {
          if (doc.exists) {
            const events = doc.data()?.events as Event[];
            events.push(...events);
            batch.update(doc.ref, {events: events});
          } else {
              batch.set(db.collection(colpath).doc(date), {
              events: [...events],
              userId: userId,
              date: date,
              public: true,
            });
          }
        });
        promises.push(promise);
      }
    await Promise.all(promises);
    await batch.commit();
    info("Data processed successfully");
  });
