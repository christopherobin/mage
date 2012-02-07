(function($) {
  jQuery.fn.contextMenu = function ( name, actions, options ) {
    var me = this,
    menu = $('<ul id="'+name+'" class="context-menu"></ul>').hide().appendTo('body'),
    activeElement = null, // last clicked element that responds with contextMenu
    hideMenu = function() {
      $('.context-menu').each(function() {
        $(this).trigger("closed");
        $(this).hide();
      });
      $('body').unbind('click', hideMenu);
    },
    default_options = {
      disable_native_context_menu: false // disables the native contextmenu everywhere you click
    },
    options = $.extend(default_options, options);

    $(document).bind('contextmenu', function(e) {
      if (options.disable_native_context_menu) {
        e.preventDefault();
		}
      hideMenu();
    });

    $.each(actions, function(me, itemOptions) {
      var menuItem = $('<li><a href="#">'+me+'</a></li>');

      if (itemOptions.klass) {
        menuItem.attr("class", itemOptions.klass);
		}

	  if (itemOptions.data) {
		 for (var da in itemOptions.data) {
			menuItem.attr(da, itemOptions.data[da]);
		 }
	  }

      menuItem.appendTo(menu).bind('click', function(e) {
        itemOptions.click(activeElement, menuItem);
        e.preventDefault();
      });
    });


    return me.bind('contextmenu', function(e){
      // Hide any existing context menus
      hideMenu();

      activeElement = $(this); // set clicked element

      if (options.showMenu) {
        options.showMenu.call(menu, activeElement);
      }

      // Bind to the closed event if there is a hideMenu handler specified
      if (options.hideMenu) {
        menu.bind("closed", function() {
          options.hideMenu.call(menu, activeElement);
        });
      }

      menu.show(0, function() { $('body').bind('click', hideMenu); }).css({
        position: 'absolute',
        top: e.pageY,
        left: e.pageX,
        zIndex: 5000
      });
      return false;
    });
  };
})(jQuery);
