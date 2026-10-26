import { initializeApp }
from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";

const firebaseConfig = {
    apiKey: "AIzaSyBmqPjry4Jz0WbETT8ZS6VJX6m-tdhyEFI",
    authDomain: "olf-staff-connect-b1d54.firebaseapp.com",
    projectId: "olf-staff-connect-b1d54",
    storageBucket: "olf-staff-connect-b1d54.firebasestorage.app",
    messagingSenderId: "820294263204",
    appId: "1:820294263204:web:6eef8a42bdad524debe131"
};

export const app =
    initializeApp(firebaseConfig);