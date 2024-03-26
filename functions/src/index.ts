import {onRequest} from "firebase-functions/v2/https";
import { onCall } from "firebase-functions/v2/https";
import {onDocumentCreated} from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import * as genKey from "generate-api-key";
import { info,error } from "firebase-functions/logger";

admin.initializeApp();
let userId = "testUserId";

// eslint-disable-next-line require-jsdoc
function generateRandomWord(length: number) {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"+
  "abcdefghijklmnopqrstuvwxyz"+"123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}
exports.CalculateCategoryTotals = onDocumentCreated(
  "leaderboard/{userId}", (event) => {
    info("Calculating totals");
    const snapshot = event.data;
    if (!snapshot) {
      error("Document does not exist");
      return;
    }
    const data = snapshot.data();
    const categoriesTotals = data.CategoryTotals as { [key: string]: number };
    let total = 0;
    for (const category in categoriesTotals) {
      /* eslint guard-for-in: 1 */
      total += categoriesTotals[category];
    }
    const db = admin.firestore();
    const colpath = "leaderboard";
    db.collection(colpath).doc(snapshot.id).update({total: total}).then(() => {
      info("Total updated");
    }).catch((error) => {
      error("Error updating total: ", error);
    });
  });
exports.UpdateCategoryTotals = onDocumentUpdated(
  "leaderboard/{userId}", (event) => {
    logger.info("Updating totals on document update");
    const snapshot = event.data;
    if (!snapshot) {
      logger.error("Document does not exist");
      return;
    }
    const data = snapshot.after.data();
    const categoriesTotals = data.CategoryTotals as { [key: string]: number };
    let total = 0;
    for (const category in categoriesTotals) {
      /* eslint guard-for-in: 1 */
      total += categoriesTotals[category];
    }
    const db = admin.firestore();
    const colpath = "leaderboard";
    db.collection(colpath).doc(snapshot.after.id).update({total: total}).then(() => {
      logger.info("Total updated");
    }).catch((error) => {
      logger.error("Error updating total: ", error);
    });
  });

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

      const promise = db.collection(colpath).add(jsonObj);
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
    userId = generateRandomWord(20);
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

exports.generateApiKey = onCall((request) => {
  // has to be authenticated
  // check the user does not already have an api key
  // if user has key, return that key
  // else generate a new key and return it

  if(!request.data.auth) {
    error("Not authenticated");
    return {error:"Not authenticated"};
  }
  const db = admin.firestore();
  const colpath = "apiKeys";
  const docpath = request.data.auth.uid;
  const docref = db.collection(colpath).doc(docpath);
  docref.get().then((doc) => {
    if(doc.exists) {
      const data = doc.data();
      if(data && data.apiKey) {
        return {apiKey: data.apiKey};
      } else {
        error("No apiKey found");
        return {error: "No apiKey found"};
      }
    } else {
      const apiKey = genKey.generateApiKey();
      docref.set({apiKey: apiKey}).then(() => {
        return {apiKey: apiKey};
      }).catch((error) => {
        error("Error setting document:", error);
        return {error: error};
      });
      return {apiKey: apiKey}; // for all paths error fix
  }}).catch((error) => {
    error("Error generating ApiKey:", error);
    return {error: error};
  });
  return {error: "Error"}; // for all paths error fix
  }
);

exports.requestApiKey = onRequest((_, response) => {
  /** only included for testing purposes */
  const db = admin.firestore();
  const colpath = "apiKeys";
  const docpath = "testUserID4613";
  const docref = db.collection(colpath).doc(docpath);

  docref.get().then((doc) => {
      if (doc.exists) {
        const data = doc.data();
        if (data && data.apiKey) {
          response.send({ apiKey: data.apiKey });
        } else {
          error("No apiKey found");
          response.send({ error: "No apiKey found" });
        }
      } else {
        const apiKey = genKey.generateApiKey();
        docref
          .set({ apiKey: apiKey })
          .then(() => {
            info("ApiKey set and sent to client");
            response.send({ apiKey: apiKey });
          })
          .catch((error) => {
            error("Error setting document:", error);
            response.send({ error: error });
          });
        response.send({ apiKey: apiKey }); // for all paths error fix
      }
    })
    .catch((error) => {
      error("Error generating ApiKey:", error);
      response.send({ error: error });
    });
});