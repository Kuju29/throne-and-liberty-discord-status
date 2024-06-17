const { ActivityType } = require('discord.js');
const request = require('request');
const https = require('https');

let cache = { searchTime: null, schedule: [] };
let currentStatus = '';
let searchTime = null;

class Guild {
  async fetchDates() {
    const url = 'https://api-goats.plaync.com/tl/v2.0/game/schedule/term?locale=ko-KR';
    const agent = new https.Agent({
      rejectUnauthorized: false,
      secureOptions: require('constants').SSL_OP_LEGACY_SERVER_CONNECT
    });

    const options = {
      url: url,
      agent: agent,
      headers: {
        'User-Agent': 'request'
      }
    };

    return new Promise((resolve, reject) => {
      request.get(options, (error, response, body) => {
        if (error) {
          console.error('Error fetching API Day:', error.name);
          return resolve(null);
        }

        try {
          const dates = JSON.parse(body);
          resolve(dates);
        } catch (e) {
          console.error('Error parsing JSON:', e.name);
          reject(e);
        }
      });
    });
  }

  async fetchApi(date) {
    const url = `https://api-goats.plaync.com/tl/v2.0/game/schedule/23?locale=en-US&date=${date}&scheduleType=&minLevel=&maxLevel=`;
    // console.log(url);
    const agent = new https.Agent({
      rejectUnauthorized: false,
      secureOptions: require('constants').SSL_OP_LEGACY_SERVER_CONNECT
    });

    const options = {
      url: url,
      agent: agent,
      headers: {
        'User-Agent': 'request'
      }
    };

    return new Promise((resolve, reject) => {
      request.get(options, (error, response, body) => {
        if (error) {
          console.error('Error fetching API Data:', error.name);
          return resolve(null);
        }

        try {
          const parsedBody = JSON.parse(body);
          resolve(parsedBody);
        } catch (e) {
          console.error('Error parsing JSON:', e.name);
          reject(e);
        }
      });
    });
  }

  async fetchAllApis() {
    try {
      const dates = await this.fetchDates();
      if (!dates || dates.length < 2) {
        throw new Error('Not enough dates available from the API');
      }

      const todayData = await this.fetchApi(dates[0]);
      const tomorrowData = await this.fetchApi(dates[1]);

      if (!todayData || !tomorrowData) {
        throw new Error('API data fetch failed');
      }

      if (!todayData.schedule || !tomorrowData.schedule) {
        throw new Error('Schedule data is missing in one of the API responses');
      }

      cache = {
        searchTime: todayData.searchTime,
        schedule: [...todayData.schedule, ...tomorrowData.schedule]
      };

      searchTime = todayData.searchTime;
    } catch (error) {
      console.error('Error fetching data from API:', error.name);
    }
  }
}

function incrementSearchTime() {
  if (searchTime) {
    searchTime = new Date(new Date(searchTime).getTime() + 1000).toISOString();
  } else {
    searchTime = new Date().toISOString();
  }
}

function shortenName(name, eventTypeName) {
  const colonIndex = name.indexOf(':');
  const shortName = colonIndex !== -1 ? name.split(': ')[1].split(' ')[0] : name.split(' ')[0];
  const eventTypeInitial = eventTypeName ? eventTypeName.charAt(1) : 'N';
  return `${shortName}[${eventTypeInitial}]`;
}

function formatTimeWithOffset(time, offsetHours) {
  const date = new Date(time);
  date.setHours(date.getHours() + offsetHours);
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

function generateWeeklySchedule() {
  const totalMinutesInWeek = 7 * 24 * 60;
  const periods = [];
  let startTime = 0;
  let endTime = 120;
  let currentIcon = "🌞";
  let nextIcon = "🌚";
  let duration = 120;

  while (startTime < totalMinutesInWeek) {
      periods.push({ start: startTime, end: endTime, icon: currentIcon });

      startTime = endTime;
      endTime = startTime + (duration === 120 ? 30 : 120);
      duration = duration === 120 ? 30 : 120;

      const tempIcon = currentIcon;
      currentIcon = nextIcon;
      nextIcon = tempIcon;
  }

  return periods;
}

function getCurrentWeekMinute() {
  const currentTime = new Date();
  const options = { timeZone: 'Asia/Bangkok', weekday: 'long', hour12: false, hour: '2-digit', minute: '2-digit' };
  const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(currentTime);

  let dayOfWeek, hour, minute;
  parts.forEach(({ type, value }) => {
      if (type === 'weekday') dayOfWeek = value;
      if (type === 'hour') hour = parseInt(value, 10);
      if (type === 'minute') minute = parseInt(value, 10);
  });

  const dayMapping = {
      'Sunday': 0,
      'Monday': 1,
      'Tuesday': 2,
      'Wednesday': 3,
      'Thursday': 4,
      'Friday': 5,
      'Saturday': 6
  };

  const totalMinutes = (dayMapping[dayOfWeek] * 24 * 60) + (hour * 60) + minute;
  
  const startDate = new Date('2024-05-26');
  const currentDate = new Date(currentTime.toDateString());
  const weeksElapsed = Math.floor((currentDate - startDate) / (7 * 24 * 60 * 60 * 1000));

  const weekIncrement = (weeksElapsed * 30) % 120;

  return totalMinutes + weekIncrement;
}

function getIcon() {
  const currentWeekMinute = getCurrentWeekMinute();
  const schedule = generateWeeklySchedule();

  for (let i = 0; i < schedule.length; i++) {
      if (currentWeekMinute >= schedule[i].start && currentWeekMinute < schedule[i].end) {
          const remainingTime = schedule[i].end - currentWeekMinute;

          if (schedule[i].icon === "🌞") {
              if (remainingTime <= 15) {
                  return "🌓"; 
              } else if (remainingTime <= 30) {
                  return "🌔";
              }
          }
          return schedule[i].icon;
      }
  }

  return "🌞";
}

async function getStatus() {
  try {
    const currentTime = searchTime ? new Date(searchTime) : new Date();
    // const currentTime = new Date('2024-06-08T07:00:00.815Z');
    // console.log(currentTime);
    const thirtyMinutesAfter = new Date(currentTime.getTime() - 25 * 60000);
    const thirtyMinutesBefore = new Date(currentTime.getTime() + 35 * 60000);

    const groupedEvents = {};

    cache.schedule.forEach(item => {
      const eventTime = new Date(item.triggerTime);
      if (eventTime >= thirtyMinutesAfter && eventTime <= thirtyMinutesBefore) {
        if (!groupedEvents[item.triggerTime]) {
          groupedEvents[item.triggerTime] = [];
        }
        if (item.guildName || item.guildName === "") {
          if (item.guildName === "") {
            item.guildName = "None";
          }
        
          const nameParts = item.name.split(' ');
          const firstTwoChars = nameParts[0].slice(0, 2);
          const lastFirstChar = nameParts[nameParts.length - 1].charAt(0);
        
          const guildNameParts = item.guildName.split(' ');
          const guildNameBase = guildNameParts[0];
          const secondGuildNameChar = guildNameParts.length > 1 ? guildNameParts[1].charAt(0) : '';
        
          const newGuildNameSuffix = `[${firstTwoChars}|${lastFirstChar}]`;
          // const newGuildName = guildNameParts.length > 1 ? `${guildNameBase}${secondGuildNameChar} ${newGuildNameSuffix}` : `${guildNameBase} ${newGuildNameSuffix}`;
          const newGuildName = guildNameParts.length > 1 ? `${guildNameBase} ${secondGuildNameChar}` : `${guildNameBase}`;
        
          if (!item.guildName.includes(newGuildNameSuffix)) {
            item.guildName = newGuildName;
            // console.log(item.guildName);
          }
        }

        const eventName = item.guildName || shortenName(item.name, item.eventTypeName);
        groupedEvents[item.triggerTime].push(eventName);
      }
    });

    let status;
    if (Object.keys(groupedEvents).length === 0) {
      const icon = getIcon();
      status = `${icon}No events available`;
    } else {
      for (const time in groupedEvents) {
        const eventTime = new Date(time);
        const formattedTime = formatTimeWithOffset(time, 7);
        const symbol = currentTime < eventTime ? '⏱' : '⚔';
        const icon = getIcon();
        status = `${icon}${symbol}${formattedTime}: ${groupedEvents[time].join(', ')}`;
        break;
      }
    }

    return status;
  } catch (error) {
    console.error('Fetch API error:', error);
    return 'ไม่สามารถดึงข้อมูลได้';
  }
}

async function updateStatus(client) {
  const status = await getStatus();
  if (status !== currentStatus) {
    client.user.setPresence({
      activities: [{ name: status, type: ActivityType.Custom }],
      status: 'dnd'
    });
    currentStatus = status;
    // console.log('Status set to:', status);
  } else {
    // console.log('Status unchanged:', status);
  }
}

function startStatusUpdates(client) {
  const guild = new Guild();

  const fetchApiData = async () => {
    await guild.fetchAllApis();
    await getStatus();
    updateStatus(client);
  };

  fetchApiData();
  setInterval(fetchApiData, 1200000);

  setInterval(() => {
    updateStatus(client);
  }, 20000);

  setInterval(() => {
    incrementSearchTime();
  }, 1000);
}

module.exports = { startStatusUpdates };
