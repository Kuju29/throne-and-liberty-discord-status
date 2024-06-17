![image](https://github.com/Kuju29/throne-and-liberty-discord-status/assets/22098092/db23aac2-7d9b-4ed1-8db4-f41448a54378)

You need to change the api to your server number.

`https://api-goats.plaync.com/tl/v2.0/game/schedule/23?locale=en-US&date=${date}&scheduleType=&minLevel=&maxLevel=`

You can view your server's API number here.

https://api-goats.plaync.com/tl/v2.0/game/server?locale=en-US


how to use:
```js
const { Client } = require("discord.js");
const { startStatusUpdates } = require('./status');

client.once('ready', async () => {
  startStatusUpdates(client);
});
```
