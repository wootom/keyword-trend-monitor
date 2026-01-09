const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const firebaseConfig = {
    apiKey: "AIzaSyBQnDMvtDnQDd9p4clijvVZsZcspRtiFIk",
    authDomain: "keyword-trend-monitor.firebaseapp.com",
    projectId: "keyword-trend-monitor",
    storageBucket: "keyword-trend-monitor.firebasestorage.app",
    messagingSenderId: "476155824835",
    appId: "1:476155824835:web:ff9e01a10ca6eb1119d02a"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function listTasks() {
    console.log('Listing global tasks...');
    const querySnapshot = await getDocs(collection(db, "globalTasks"));

    if (querySnapshot.empty) {
        console.log('No tasks found.');
        return;
    }

    querySnapshot.forEach((doc) => {
        console.log(`Task ID: ${doc.id}`);
        console.log(`Data: ${JSON.stringify(doc.data())}`);
        console.log('---');
    });
}

listTasks().then(() => process.exit(0)).catch((e) => {
    console.error(e);
    process.exit(1);
});
