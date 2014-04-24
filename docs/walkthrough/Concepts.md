MAGE concepts
==============

Applications
------------

A MAGE application can host any number of
sub-applications. These may include:

* Custom applications (a game, a website, etc)
* A Content Management System (or CMS) tool
* Customer Relation Management (or CRM) tool
* Development tools and documentation

And so on.

Applications may fall under two categories:

* Single-page applications (such as interactive games)
* Multiple-pages applications (such as content websites)

### Single-page application

The following model is an example of what is commonly used
for building large SPA which will required a large quantity
of pages, files and assets.

Technically, all pages are equals: very small applications
may be built without an index page as described below, or even
without a landing page.

#### The index page

The index page is the base HTML, JavaScript and
CSS code which gets loaded when you access your application
from a specific URL. Also known as application loader or game loader,
It acts as your index page for your application.

In there, you should normally only put the bare minimal for your
application to render properly on first access. Normally, that means
you should not have any customisation to add in there; however, you
may decide to add some of the following elements in here:

* Static header and/or footers
* Static toolbars

Note that all the elements which you will put in the main page should
normally always remain visible or in operation: other elements should
be stuck either on pages or in modules.

The application loader, for any pages you load,
also controls the following application events:

1. **Offline/online event**: If your application connectivity changes
2. **Maintenance**: What should we do when we put the application in maintenance mode?
3. **Unrecoverable errors**: What do we do when there is a critical MAGE loader error? This may include:
  1. **Headers**: HTTP headers could not be parsed properly
  2. **Page load failure**: We try to load a page a page but fail to do so

#### The landing page

The landing page is what loads the bare minimal code and data
we need to run and render the game properly. This might include:

* Authentication (local, to third-party APIs, etc)
* Base assets (images, sound files)
* Some MAGE modules
* Game static data (game balance, game content, etc)

It will also pre-load the main page (and any other pages
you may choose to pre-render) in the background,
so that it is ready to display.

Please note that the MAGE modules you load in this phase
should be at least what you need to run the landing page;
however, you can also choose to pre-load as many MAGE
modules as you want here, which will make the loading phase
longer, but would make future page displays faster. You will
want to tune this up for your application according
to its perfomance specification.

Different application designs will request different landing
process, both in terms of what data and operations are required
and how the transition to the main page will be done (either
through displaying a "Start" button or through automatically
displaying the main page onces everything has been loaded).

In terms of page content, it should normally have:

* A loading bar (while during assets)
* A start button
* Splash screen elements (background, etc)

#### The main page

The main page is essentially your application itself: everything
which has been loaded during the execution of the landing page
is now available for display.

In here, you will want to put the main construct of your application,
i.e. things which should remain pretty much the same throughout the
execution of your application. This might include a view system
built with the following components:

* [wui-DOM](https://github.com/Wizcorp/wui-Dom)
* [wui-View](https://github.com/Wizcorp/wui-View)
* [NavTree](https://github.com/Wizcorp/NavTree)

Or any libraries of your choosing (Angular.js, jQuery, etc).

#### Other pages

From there, you can add any number of pages as you want: each pages
represent a screen which will be shown or hidden as you navigate
within your application's UI (unless you have chosen to do this
through your own view system).
