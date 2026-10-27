import { initializeApp }
from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";

const firebaseConfig = {
    apiKey: "AIzaSyBmqPjry4Jz0WbETT8ZS6VJX6m-tdhyEFI",
    authDomain: "olf-staff-connect-b1d54.firebaseapp.com",
    projectId: "olf-staff-connect-b1d54",
    storageBucket: "olf-staff-connect-b1d54.firebasestorage.app",
    messagingSenderId: "820294263204",
    appId: "1:820294263204:web:6eef8a42bdad524debe131",
    measurementId: "G-4WKWE3B2PE"
};

export const app =
    initializeApp(firebaseConfig);

/* ====================================
   GOOGLE ANALYTICS
   Loaded with a dynamic import inside try/catch so that if an ad
   blocker (Brave, uBlock etc.) blocks the Analytics script, the rest
   of Staff Connect still loads normally - only tracking is skipped.
   send_page_view is off because the app is a single page: each page
   view is logged from navigate() in app.js instead.
==================================== */

let analytics = null;
let logEventFn = null;

const analyticsReady = (async () => {
    try {
        const m = await import(
            "https://www.gstatic.com/firebasejs/11.0.0/firebase-analytics.js"
        );
        if (await m.isSupported()) {
            analytics = m.initializeAnalytics(app, {
                config: { send_page_view: false }
            });
            logEventFn = m.logEvent;
        }
    } catch (e) {
        console.warn("[Analytics] not available (blocked or offline):", e);
    }
})();

/** Send an Analytics event. Safe to call even if Analytics is blocked. */
export function trackEvent(name, params = {}) {
    analyticsReady.then(() => {
        if (analytics && logEventFn) logEventFn(analytics, name, params);
    });
}
