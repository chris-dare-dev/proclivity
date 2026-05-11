/// <reference types="chrome" />

const ALARM_PREFIX = "proclivity:reminder:";

chrome.runtime.onInstalled.addListener(() => {
  console.log("[proclivity] service worker installed");
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (!alarm.name.startsWith(ALARM_PREFIX)) return;
  const id = alarm.name.slice(ALARM_PREFIX.length);
  chrome.notifications.create(alarm.name, {
    type: "basic",
    iconUrl: "public/icon-128.png",
    title: "Proclivity",
    message: `Reminder ${id}`,
    priority: 2,
  });
});

export {};
