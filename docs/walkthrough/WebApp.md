# Creating a web app

MAGE is well suited for single-page web apps. The built-in web builder is designed around this
concept and integrates with Component.io to help you manage your dependencies (both within the app,
and with external libraries). Below follow different workflows, that you may choose to apply
depending on your needs.


## The simplest single-page app

The idea of a single-page web app, is that your app consists of a single index.html file (with HTML,
CSS and JavaScript parts), which communicates with a server through Ajax or Websocket calls, rather
than navigating between different HTML pages. MAGE facilitates this, and makes the communication
part a bit simpler by providing real RPC. That is, you have the ability to expose JavaScript
functions on the server directly to the browser.

But let's start at the beginning. You want to make your index.html file for your web app which we'll
call "game" throughout this guide. The following file structure is just an example, but it seems to
serve people well. You may follow this pattern if you like.

```
/www
  /game  (the name of the app)
    index.html
```

Feel free to put any HTML in your index.html file. In your MAGE server code (lib/index.js), you need
to expose this file to the world. You can do that through the `addIndexPage` function that the app
instance carries.

```javascript
mage.setup(function (error, apps) {
  // instruct to build from the HTML file(s) in the given folder
  var indexPage = apps.game.addIndexPage('game', './www/game');

  // make this app the endpoint for the "/" route
  indexPage.routes.push('/');
});
```

You can now access this application at `http://localhost/app/game` (change the host and port
according to your configuration). Because we added a custom route, we can also access it by simply
going to `http://localhost/`.


## Separate HTML, CSS and JavaScript parts

The MAGE build system allows you to embed files into other files through macros. MAGE exposes
particular build-strategies by a name, and allows you to limit which files can be included through
a file context. For example, the following example embeds a single CSS file into a `<style>` tag
using the "file" macro and "css" context, and it embeds *all* JavaScript files in this folder into
a `<script>` tag using the "dir" macro and "js" context.

```html
<html>
  <body></body>
  <style>
$file.css('./styles.css');
  </style>
  <script>
$dir.js('.');
  </script>
</html>
```

> Please note that the build process will treat macros literally as find & replace. That means that
> simply putting "//" in front of it, will not comment out its contents, and "/* */" is likely not
> to work when the macro is replaced by text that contains comment symbols. If you want to turn off
> a macro, you must either remove it, or comment it out after renaming it (for example by putting a
> space between the "$" symbol and the rest of the macro.

Your file structure now looks something like this:

```
/www
  /game
    index.html
    styles.css
    index.js
```

## Dependency management with Component.io

If you want to create a more complex app, the example above becomes problematic. Your files will
quickly grow out of proportion, making them harder and harder to manage and wrap your head around.
[Component.io](https://github.com/component/component) can help you with this, and MAGE supports it
out of the box. Before you continue, please make sure you understand how Component.io works, and
that you are able to write your codebase in component-style.

On the browser-side, we need to create an entry point for the application. This is where the builds
will flow from and where your dependency component installations will begin. This first component
doesn't *have* to contain any code or CSS. It may simply be a reference to other components that you
wish to build.

This is an example "/www/game/component.json" file that achieves this.

```json
{
  "name": "mygame",
  "description": "My Amazing Game",
  "local": ["boot"],
  "paths": ["pages"]
}
```

The component that is linked to is called "boot" in the folder "/www/game/pages". That component
kicks off our application logic. We don't need JavaScript or CSS in our entry point itself, but we
do need to make the built component bundle (which starts at "boot") part of our "index.html" page.
We can do that by embedding it using another macro.

```html
  <style>
$component.css('www/game/pages/boot');
  </style>
  <script>
$component.js('www/game/pages/boot');
require('boot');
  </script>
```

This example does a few things.

1. The $component.css macro embeds the generated CSS build of components into the style tag.
2. The $component.js macro embeds the "require" function implementation into the script tag.
3. The $component.js macro also embeds the generated JavaScript build of components into the script
   tag.
4. After having embedded the JavaScript and CSS parts of the component build, we simply call
   `require('boot');` to start the application.

Your file structure now looks something like this:

```
/www
  /game
    component.json
    index.html
    /components       (we can put our game's components here)
    /pages
      /boot
        component.json
        styles.css
        index.js
```

> When working with Component.io, it may become clear that using component.json files is not the
> easiest thing to maintain. Wizcorp has developed and maintains
> [component-hint](https://www.npmjs.org/package/component-hint) to make your life a bit easier.


## Creating a mobile friendly Component.io single-page app

Especially on mobile devices, downloading a full application such as a game can take a considerable
amount of bytes and time. MAGE allows you to split up your app into multiple packages, allowing you
to quickly display content, while downloading the remainder of your app in the background (while
informing your user about updates, news, campaigns, etc). This system also includes a smart caching
layer, ensuring that no big downloads happen needlessly. The API that enables this is called the
MAGE Loader.

In essence, the MAGE Loader does a few things (in order):

- It downloads and caches your packages.
- It manages the connection, emits status events and retries failed downloads.
- It injects the HTML part into your browser's document.
- It runs the JavaScript part.
- It manages the visibility of the HTML part.
- It injects and ejects the CSS when the HTML part changes visibility.

To split up your application into multiple packages, you need MAGE to create multiple component
builds. They may depend on each other, but their inter-dependencies may not be mentioned in
"component.json". If you did add such a dependency, every component would end up in the same build.
In the example that follows, we will split up our game into two packages:

- "boot" (containing the loader and a welcome and "loading" message)
- "main" (containing the actual game)

Our landing page will be quite like the example we have seen before. In our "boot" component, we
will refer to the MAGE Loader (a component called "loader"), so that we can download additional
packages. The "/www/game/pages/boot/component.json" file now looks like this:

```json
{
  "name": "index",
  "description": "Loader of the game",
  "local": ["loader"],
  "paths": ["../../../../node_modules/mage/lib"],
  "scripts": ["index.js"],
  "main": "index.js"
}
```

Please note that this component file does *not* refer to the "main" component. While you should
create the main package as a component in "/www/game/pages/main", this inter-dependency is a weak
one which we will establish outside of any component.json file. We do this in MAGE.

Your file structure now looks something like this:

```
/www
  /game
    component.json
    index.html
    /components
    /pages
      /boot
        component.json
        styles.css
        index.js
      /main
        component.json
        styles.css
        index.js
```

To make this work, we need to tell MAGE that the "main" package depends on the "boot" package. This
is for the following reasons.

- Components that "main" depends on, but were already embedded in "boot" will not be embedded again.
- Just like the initial "index.html" is a starting point for a build which will embed "boot", so is
  the "main" component the starting point for a build.

The server-side API for doing this operates on top of the index page we created at the start:

```javascript
var indexPage = apps.game.addIndexPage('game', './www/game');
indexPage.registerComponent('main', './www/game/pages/main');
```

Now the MAGE server is aware of both builds. The next step is to set up the MAGE loader to download
the "main" package. We added the MAGE loader to the "boot" component earlier, so we can now start to
use it as follows.

```javascript
var loader = require('loader');

// transmit this build's language and screen settings to the loader (don't worry about this for now)

loader.configure(window.mageConfig);

// start downloading the "main" package

loader.loadPage('main');

loader.once('main.loaded', function () {
  // this is where the two packages meet

  window.require('main');
});
```

The loader must be configured through a call to `loader.configure`. You can copy that line as is in
the example above. The MAGE component builder automatically makes `window.mageConfig` available
thanks to the $component.js macro you used in "index.html". You start the download of the "main"
package by calling `loadPage`. Once that download has finished, the "main.loaded" event will fire.

> The name of the event adapts to the names you give to your packages ("packagename.loaded").

It was mentioned earlier that the "boot" component should *not* refer to the "main" component. You
may have wondered how we can then `require('main')` once it has been downloaded. This can be done
through `window.require`, which has access to every build's entry point component. You can call
this, the moment you know that the package has been downloaded.

Now that your "main" package logic is running, you can continue implementing your loading screen and
the game itself, knowing that mobile users will get a user experience better fit for their hardware
and connection.

### Further experimentation

You can create components for your game in a folder called "/www/game/components". You probably
don't want to put them inside the "boot" or "main" folder. Leave it to the component builder to
traverse the dependency tree and inject components into the build when needed. If you want to share
components between multiple applications, you could add a "/www/shared/components" folder to place
these in and refer to them from your apps.

You could split up the application further if you wanted to. But keep in mind that because of
inter-dependencies, packages must always be loaded in the exact same order. So you could decide to
add a complex tutorial as a separate package (avoiding a download after having finished playing it),
but you should put it last in the chain. The components in the "main" package are not allowed to
depend on an optional package.

## Next chapter

[The State class](./State.md)
