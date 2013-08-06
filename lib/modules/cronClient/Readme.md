# Cron Client


## What's this all about?

A common challenge in game development is the ability to schedule particular operations. Think for
example of Weekly Rankings, that needs to be generated every Monday morning at 0:05 am. Easy enough,
right?

The simple way to write this:

```javascript
var nextDueDate = new Date('good', 'luck', 'with', 'that');

setTimeout(function () {
	mage.ranking.generateWeekly();
}, nextDueDate.getTime() - Date.now());
```

The problem is: where do we put this code? If we have 10 game servers all running the same code,
they will **all** start generating weekly rankings on Monday morning and your database will
collapse.


## Meet Shokoti

[Shokoti](https://github.com/Wizcorp/shokoti) is a companion application to MAGE that can manage
scheduled tasks for you. The idea is simple:

> Allow any amount of processes to schedule the same operation with a centralized service. Then have
> it call back to a single game server once it's time to run the job.

The Shokoti application has a module called Cron Server that is the counter part to this module.


## API

Cron Client only has a single API for you to use:

### setJob(uniqueId, schedule, callback)

The schedule argument is either a valid crontab syntax (optionally preceeded by a seconds-column),
or a unix timestamp which may be in seconds or in milliseconds.

```javascript
// run weekly ranking every week on Monday at 0:05am.

mage.cronClient.setJob('weeklyRanking', '5 0 * * mon', function (state, cb) {
	mage.ranking.generateWeekly(state, cb);
});
```


## Crontab schedule syntax

Crontab schedules can be a bit tricky, but they are very powerful. The Cron Server uses the
[cron](https://npmjs.org/package/cron) module, which accepts [unix crontab](http://crontab.org)
syntax.


## Configuration

To use Cron Client, please call `mage.useModules('cronClient');` and provide the following
configuration:

```yaml
module:
    cronClient:
        clientAppId: game
        serverAppId: shokoti
        serverBaseUrl: "http://shokoti.example.com"
```

| entry         | description                                                             |
|---------------|-------------------------------------------------------------------------|
| clientAppId   | The App ID that you have given your game in the `apps` configuration.   |
| serverAppId   | The App ID of the Shokoti server.                                       |
| serverBaseUrl | The `expose` configuration entry for the Shokoti server's `clientHost`. |
