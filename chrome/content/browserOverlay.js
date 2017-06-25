// ./www/wwwroot/scripts/window_manager.js ./www/wwwroot/scripts/std_head.js ->> function session_timeout()
//function check_for_timeout
//if (_browser.name != "unknown") { check_for_timeout();}

//cancelar timeout
//<preferences> are not removed when rows are removed?
//check TODOs
//clean code : see repeated sections of code!
//menu and context servers: update all of them each time, instead of just one (relevant with several open windows).

if ( "undefined" == typeof( nachoSD ) ) { var nachoSD = {}; };

nachoSD.browserOverlay = {
    prefs : null,

    buildcgi : function() {
      var serverIP   = this.prefs.getCharPref( "serverIP" );
      var serverPort = this.prefs.getCharPref( "serverPort" );
      return "http://" + serverIP + ":" + serverPort + "/CAisd/pdmweb.exe";
    },

    firstRun : function()	//adds the toolbar element to the navigation toolbar on first run
	       {
		 var prefs = this.prefs;
		 function installButton( toolbarId, id, afterId )
		 {
		   prefs.setBoolPref( 'firstRun' , false );
		   if ( !document.getElementById(id) )
		   {
		     var toolbar = document.getElementById( toolbarId );

		     var before = toolbar.firstChild;
		     if ( afterId )
		     {
		       let elem = document.getElementById( afterId );
		       if ( elem && elem.parentNode == toolbar )
			 before = elem.nextElementSibling;
		     }

		     //toolbar.insertItem(id, before);
		     toolbar.insertItem(id, null, null, false);		//add at the end
		     toolbar.appendChild( document.getElementById( id ) );
		     toolbar.setAttribute( "currentset", toolbar.currentSet );
		     document.persist( toolbar.id, "currentset" );

		     if ( toolbarId == "addon-bar" )
		       toolbar.collapsed = false;
		   }
		 }

		 if ( prefs.getBoolPref( 'firstRun' ) )
		   installButton("nav-bar", "nachoSD_item_box");
	       },

    init : function()
	   {
	     nachoSD.browserOverlay.prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("extensions.nachoSD.");
	     nachoSD.browserOverlay.firstRun();
	     nachoSD.browserOverlay.initMenuSD();

	     if( gBrowser ) gBrowser.addEventListener( "DOMContentLoaded", nachoSD.browserOverlay.firefoxFix, false );
	   },

  firefoxFix : function( aEvent )					//For 12.1 on FF > 3.6
	       {
		 var prefs    = nachoSD.browserOverlay.prefs || nachoSD.opts.prefs;
		 var serverIP = prefs.getCharPref( 'serverIP' );
		 var IPlist  = prefs.getCharPref( 'fff' ).split( ',' );

		 //ADD IPS FROM THE SERVER LIST
		 var prefList= prefs.getChildList( "serverlist." , { value:null } );
		 var prefNum = prefList.length/5;

		 //Get used indexes
		 var indexes = [];
		 for ( var n = 0 ; indexes.length < prefNum ; n++ )
		 {
		   var aux = prefs.getChildList( "serverlist." + n , { value:null } );
		   if ( aux.length > 0 )
		     indexes.push( n );
		 }

		 //Save current values
		 var vals = [];
		 for( var i = 0 ; i < indexes.length ; i++ )
		 {
		   let dir  = prefs.getCharPref( 'serverlist.' + indexes[i] + '.dir' );
		   IPlist.push( dir );
		 }

		 //ADD VALUES FROM THE FIX PREFERENCE
		 //Clean empty spaces
		 for ( var i = 0 ; i < IPlist.length ; i++ )
		   IPlist[i] = IPlist[i].replace( ' ' , '' );
		 IPlist.push( serverIP );

		 var removeBases = function( doc )	//function to remove "base" tags in a document
		 {

		   var yourbases = doc.getElementsByTagName( "base" );
		   for ( var j = 0 ; j < yourbases.length ; j++ )
		     yourbases[j].parentNode.removeChild( yourbases[j] );
		 };

		 if ( aEvent )		//called from DOMContentLoaded event
		 {
		   var doc = aEvent.originalTarget;
		   for( var i = 0 ; i < IPlist.length ; i++ )
		     if ( IPlist[i].length > 0 && doc.location.toString().indexOf( IPlist[i] ) != -1 )
		       removeBases( doc );
		 }
		 else			//called from nsPref:changed
		 {
		   var docs = [];
		   for ( var i = 0 ; i < opener.gBrowser.browsers.length ; i++ )
		     docs.push( opener.gBrowser.getBrowserAtIndex(i).contentWindow.document );

		   //Process all frames in all tabs
		   for ( var i = 0 ; i < docs.length ; i++ )	
		     for( var j = 0 ; j < IPlist.length ; j++ )
		       if ( docs[i].location.toString().indexOf( IPlist[j] ) != -1 )
		       {
			 var frames = nachoSD.browserOverlay.getFrameList( opener.gBrowser.getBrowserAtIndex(i).contentWindow );
			 for ( var k = 0 ; k < frames.length ; k++ )
			   removeBases( frames[k].document );
		       }
		 }
	       },

  openSD : function() { this.login(); },

  openTicket : function()
  {
    let inp = document.getElementById( "nachoSD_item_textbox" );
    let chk = document.getElementById( "nachoSD_item_check"   );

    if ( inp.value.length > 0 )
    {
      let op = '';
      if ( chk.checked )
	op = "OP=SEARCH+FACTORY=chg+SKIPLIST=1+QBE.EQ.chg_ref_num=" + inp.value;
      else
	op = "OP=SEARCH+FACTORY=cr+SKIPLIST=1+QBE.EQ.ref_num=" + inp.value;
      this.login( op );
    }
  },

  newTicket : function() { this.login( "OP=CREATE_NEW+FACTORY=cr" ); },

  searchTicket : function() { this.login( "OP=SEARCH+FACTORY=cr" ); },

  myTickets : function()
  {
    let query = this.buildURLquery();
    if ( query != null )
    {
      let op = "OP=SEARCH+SKIPLIST=1" + query;
      this.login( op );
    }
    else
      this.popupNotif( 'NachoSD Login' , 'Debe configurar una búsqueda' );
  },

  buildURLquery : function()
		  {
		    var empty = true;
		    var obj = { value:null };
		    var prefList = this.prefs.getChildList( "query." , obj );
		    var query = "+FACTORY=" + this.prefs.getCharPref( 'factory' );
		    var prefNums = [];

		    //Look for repeated values
		    for( var i = 0 ; i < prefList.length ; i++ )
		    {
		      var exists = false;
		      if ( /query.atr|query.val/.test( prefList[i] ) )
		      {
			var num = prefList[i].substr( 9 );
			for( var j = 0 ; j < prefNums.length ; j++ )
			  if ( prefNums[j] == num )
			    exists = true;
			if ( !exists )
			  prefNums.push( num );
		      }
		    }

		    //Build query
		    for( var i = 0 ; i < prefNums.length ; i++ )
		    {
		      var atr = '';
		      var val = '';
		      var rel = 'QBE.EQ.';
		      var act = true;
		      try { atr = this.prefs.getCharPref( 'query.atr' + prefNums[i] ); }catch( e ){}
		      try { rel = this.prefs.getCharPref( 'query.rel' + prefNums[i] ); }catch( e ){}
		      try { val = this.prefs.getCharPref( 'query.val' + prefNums[i] ); }catch( e ){}
		      try { act = this.prefs.getBoolPref( 'query.act' + prefNums[i] ); }catch( e ){}
		      if( atr != '' && act )
			if( rel == 'QBE.NU.' || rel == 'QBE.NN.' )
			{
			  query += '+' + this.prefs.getCharPref( "query.rel" + prefNums[i] ) + atr + '=1';
			  empty = false;
			}
			else if( val != '' )
			{
			  query += '+' + this.prefs.getCharPref( "query.rel" + prefNums[i] ) + atr + '=' + val;
			  empty = false;
			}
		    }
		    if ( !empty )
		      return query;
		    else
		      return null;
		  },

  setServer : function( index )
	      {
		let name = this.prefs.getCharPref( 'serverlist.' + index + '.nam' );
		let dir  = this.prefs.getCharPref( 'serverlist.' + index + '.dir' );
		let port = this.prefs.getCharPref( 'serverlist.' + index + '.prt' );
		let user = this.prefs.getCharPref( 'serverlist.' + index + '.usr' );
		let alog = this.prefs.getBoolPref( 'serverlist.' + index + '.alg' );

		//Save the selection
		this.prefs.setIntPref( 'serverlistindex' , index );

		//Fill in the boxes with the server configuration
		this.prefs.setCharPref( 'serverName' , name );
		this.prefs.setCharPref( 'serverIP' , dir );
		this.prefs.setCharPref( 'serverPort' , port );
		this.prefs.setCharPref( 'user' , user );
		this.prefs.setBoolPref( 'autologin' , alog );

		//Clear the checks -- TODO make this a function
		var prefs = this.prefs.getChildList( "serverlist." , { value:null } );
		var rowNum = prefs.length/5;
		for( var i = 0 ; i < rowNum ; i++ )
		{
		  document.getElementById( 'nachoSD_menuitem_serverlist_m_' + i ).setAttribute( 'checked' , 'false' );
		  document.getElementById( 'nachoSD_menuitem_serverlist_c_' + i ).setAttribute( 'checked' , 'false' );
		}

		//Set the check on the menues
		document.getElementById( 'nachoSD_menuitem_serverlist_m_' + index ).setAttribute( 'checked' , 'true' );
		document.getElementById( 'nachoSD_menuitem_serverlist_c_' + index ).setAttribute( 'checked' , 'true' );

		//this.openSD();
	      },

  initMenuSD : function() //Generate quick access SD in menu
	    {
	      var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
		.getService(Components.interfaces.nsIWindowMediator);
	      var win = wm.getMostRecentWindow( "navigator:browser" );

	      var prefs = nachoSD.browserOverlay.prefs || nachoSD.opts.prefs;
	      var prefList = prefs.getChildList( "serverlist." , { value:null } );
	      var prefNum = prefList.length/5;

	      if ( prefNum == 0 ) return;

	      let menu1 = win.document.getElementById( 'nacho_SD_menu'    ).firstElementChild;
	      let menu2 = win.document.getElementById( 'nacho_SD_context' ).firstElementChild;
	      menu1.appendChild( document.createElement( 'menuseparator' ) );
	      menu2.appendChild( document.createElement( 'menuseparator' ) );

	      //Restore the check
	      var savedIdx = prefs.getIntPref( 'serverlistindex' );
	      for ( var i = 0 ; i < prefNum ; i++ )
	      {
		var item1 = document.createElement( 'menuitem' );
		item1.setAttribute( 'label' , prefs.getCharPref( 'serverlist.' + i + '.nam' ) );
		item1.setAttribute( 'oncommand' , 'nachoSD.browserOverlay.setServer(' + i + ')' );
		item1.setAttribute( 'type' , 'radio' );
		item1.setAttribute( 'autocheck' , 'false' );
		if ( i == savedIdx )
		  item1.setAttribute( 'checked' , 'true' );

		var item2 = item1.cloneNode( true );
		item1.setAttribute( 'id' , 'nachoSD_menuitem_serverlist_m_' + i );
		item2.setAttribute( 'id' , 'nachoSD_menuitem_serverlist_c_' + i );

		menu1.appendChild( item1 );
		menu2.appendChild( item2 );
	      }
	    },

  cleanMenuSD : function()
  {
    var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
    .getService(Components.interfaces.nsIWindowMediator);
    var win = wm.getMostRecentWindow( "navigator:browser" );

    let menu1 = win.document.getElementById( 'nacho_SD_menu'    ).firstElementChild;
    let menu2 = win.document.getElementById( 'nacho_SD_context' ).firstElementChild;
    var prefNum = menu1.childNodes.length - 8;	//items que son servidores en el menu

    for ( var i = 0 ; i < prefNum ; i++ )//opener no es lo suyo TODO
    {
      var m1 = win.document.getElementById( 'nachoSD_menuitem_serverlist_m_' + i );
      var m2 = win.document.getElementById( 'nachoSD_menuitem_serverlist_c_' + i );

      menu1.removeChild( m1 );
      menu2.removeChild( m2 );
    }
    if( prefNum >= 0 )			//remove separator 
    {
      menu1.removeChild( menu1.lastElementChild );	
      menu2.removeChild( menu2.lastElementChild );
    }
  },

  unSelectServer : function()
		 {
		   var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
		     .getService(Components.interfaces.nsIWindowMediator);
		   var win = wm.getMostRecentWindow( "navigator:browser" );
		   let menu1 = win.document.getElementById( 'nacho_SD_menu'    ).firstElementChild;
		   let menu2 = win.document.getElementById( 'nacho_SD_context' ).firstElementChild;
		   var prefNum = menu1.childNodes.length - 8;	//items que son servidores en el menu

		   for ( var i = 0 ; i < prefNum ; i++ )
		   {
		     var m1 = win.document.getElementById( 'nachoSD_menuitem_serverlist_m_' + i );
		     var m2 = win.document.getElementById( 'nachoSD_menuitem_serverlist_c_' + i );

		     m1.setAttribute( 'checked' , 'false' );
		     m2.setAttribute( 'checked' , 'false' );
		   }

		   nachoSD.opts.prefs.setIntPref( 'serverlistindex' , '-1' );
		 },

  login : function( op )
  {
    op = op || "PortalSession=+screenReader=no+OP=LOGIN";
    nachoSD.opts.savePassword();
    var user = this.prefs.getCharPref( "user" );
    var pass = nachoSD.opts.getPassword( user );

    if ( !this.prefs.getBoolPref( "autologin" ) )
    {
      gBrowser.selectedTab = gBrowser.addTab( this.buildcgi() + "?" + op );
      if ( user == '' || pass == '' )
      {
	////////////////////////////////Notification bar
	var buttons = [{
	   label: 'Configuración...',
	   accessKey: 'C',
	   popup: null,
	   callback:  function ()
	   {
	     window.open( 'chrome://nachoSD/content/options.xul', 'Opciones', 'chrome,centerscreen' );
	     content.close();
	   }
	}];
	var notifyBox = gBrowser.getNotificationBox();
	notifyBox.appendNotification( 'Puede introducir usuario y contraseña para evitar este paso...',
	    'nachoSD-reminder', 'chrome://nachoSD/skin/nachoSDlogo.png', notifyBox.PRIORITY_WARNING_MEDIUM, buttons );
      }
    }
    else
      this.autologin( op );
  },

//  autologin : function( op )
//	      {
//		var user = this.prefs.getCharPref( "user" );
//		var pass = nachoSD.opts.getPassword( user );
//		var url = "PortalSession=&USERNAME=" + user + "&screenReader=no&PIN=" + pass + "&PDA=No&OP=LOGIN&INITIAL_LOAD=";
//
//		var myRequest = new this.ajaxObject( this.buildcgi(), function( responseText, responseStatus ){
//
//		      var butfunc = function()
//		      {
//			nachoSD.browserOverlay.prefs.setBoolPref( "OSnotif" , false );
//			nachoSD.browserOverlay.prefs.setBoolPref( "popupnotif" , false );
//		      };
//
//		      if ( responseStatus != 200 )
//			nachoSD.browserOverlay.popupNotif( 'NachoSD Login' , 'Error de conexión: ' + responseStatus, butfunc, 'Desactivar Avisos' );
//		      else
//		      {
//			var matchSID = responseText.match( /SID=\d+/ ); 
//			var matchFID = responseText.match( /FID=\d+/ ); 
//			if ( matchSID != null && matchFID != null )
//			{
//			  var sid = matchSID[0].substr( matchSID[0].indexOf( '=' ) + 1 );
//			  var fid = matchFID[0].substr( matchFID[0].indexOf( '=' ) + 1 );
//
//			  var urll = "SID=" + sid + "+FID=" + fid + "+OP=REPLACE_LOGIN+HTMPL=post_menu.htmpl";
//			  //gBrowser.selectedTab = gBrowser.addTab( nachoSD.browserOverlay.buildcgi() + url );
//
//
//    ////SID=640677355&FID=2118538625&OP=MENU&POST_MENU=1
//			    var myReq = new nachoSD.browserOverlay.ajaxObject( nachoSD.browserOverlay.buildcgi(), function( responseText, responseStatus ){
//				
//			var matchSID = responseText.match( /<INPUT TYPE=HIDDEN NAME="SID" VALUE="\d+/ ); 
//			var matchFID = responseText.match( /<INPUT TYPE=HIDDEN NAME="FID" VALUE="\d+/ ); 
//			if ( matchSID != null && matchFID != null )
//			{
//			  var sid = matchSID[0].substr( matchSID[0].indexOf( 'VALUE=' ) + 7 );
//			  var fid = matchFID[0].substr( matchFID[0].indexOf( 'VALUE=' ) + 7 );
//
//			  var urlll = "SID=" + sid + "+FID=" + fid + "+OP=MENU+POST_MENU=1";
//
//			  gBrowser.selectedTab = gBrowser.addTab( nachoSD.browserOverlay.buildcgi() + '?' + urlll );
//
//			    var myReq2 = new nachoSD.browserOverlay.ajaxObject( nachoSD.browserOverlay.buildcgi(), function( responseText, responseStatus ){
//				
//				alert(responseText);
//					  var mydiv = document.createElement( 'div' );	//<div> para extraer los valores de manera sencilla
//					  mydiv.innerHTML = responseText;
//					  var nodes = mydiv.getElementsByTagName( 'infovalue' );
//					  var values = [];
//
//					  for ( var i = 0 ; i < nodes.length ; i++ )
//					  values.push( nodes[i].firstChild.nodeValue );
//
//					  //if ( processFunc )
//					  //processFunc( values );
//					  alert( values );
//
//
//							});
//			    myReq2.update(  urlll );
//			}
//			    });
//			    myReq.update(  urll );
//
//////////////
//
//
//
//			}
//			else
//			  nachoSD.browserOverlay.popupNotif( 'NachoSD Login' ,'Error de usuario y contraseña.', butfunc, 'Desactivar Avisos' );
//		      }
//		    } );
//      op = "OP=JUST_GRONK_IT+HTMPL=detail_chg.htmpl+FACTORY=cr+WC=" + escape( "ref_num='822844'" ) + '+FIELD=id';
//			  //gBrowser.selectedTab = gBrowser.addTab( nachoSD.browserOverlay.buildcgi() + '?' + url + op );
//		myRequest.update( url + op );
//	      },

//
  autologin : function( op )
	      {
		var user = this.prefs.getCharPref( "user" );
		var pass = nachoSD.opts.getPassword( user );
		var url = "PortalSession=&USERNAME=" + user + "&screenReader=no&PIN=" + pass + "&PDA=No&OP=LOGIN&INITIAL_LOAD=";

		var myRequest = new this.ajaxObject( this.buildcgi(), function( responseText, responseStatus ){

		      var butfunc = function()
		      {
			nachoSD.browserOverlay.prefs.setBoolPref( "OSnotif" , false );
			nachoSD.browserOverlay.prefs.setBoolPref( "popupnotif" , false );
		      };

		      if ( responseStatus != 200 )
			nachoSD.browserOverlay.popupNotif( 'NachoSD Login' , 'Error de conexión: ' + responseStatus, butfunc, 'Desactivar Avisos' );
		      else
		      {
			var matchSID = responseText.match( /SID=\d+/ ); 
			var matchFID = responseText.match( /FID=\d+/ ); 
			if ( matchSID != null && matchFID != null )
			{
			  var sid = matchSID[0].substr( matchSID[0].indexOf( '=' ) + 1 );
			  var fid = matchFID[0].substr( matchFID[0].indexOf( '=' ) + 1 );

			  var url = "?SID=" + sid + "+FID=" + fid + "+OP=REPLACE_LOGIN+HTMPL=post_menu.htmpl";
			  gBrowser.selectedTab = gBrowser.addTab( nachoSD.browserOverlay.buildcgi() + url );
			}
			else
			  nachoSD.browserOverlay.popupNotif( 'NachoSD Login' ,'Error de usuario y contraseña.', butfunc, 'Desactivar Avisos' );
		      }
		    } );
		myRequest.update( url + op );
	      },

  OSNotif : function( title, text )
	    {
	      title = "Service Desk Notification";
	      text = "7 Nuevas incidencias";
	      var data = "123123";
	      ////////////////////
	      try {
		Cc["@mozilla.org/alerts-service;1"].getService(Ci.nsIAlertsService).showAlertNotification(
		    "chrome://nachoSD/skin/nachoSDlogo.png",
		    title, text, true, data, nachoSD.browserOverlay, title );
	      } catch(e) {} // prevents runtime error on platforms that don't implement nsIAlertsService
	    },

  popupNotif : function( title, text, butfunc, butlabel )
	       {
		 var ary = [];
		 if ( butfunc && butlabel )
		   ary = [ { label: butlabel, accessKey: butlabel.charAt( 0 ), callback: butfunc } ];
		 PopupNotifications.show(gBrowser.selectedBrowser, "nachoSD-popup",  text, null, 
		     { label: "Configuración", accessKey: "C", callback: function() { 
		     window.open( 'chrome://nachoSD/content/options.xul', 'Opciones', 'chrome,centerscreen' ); } }
		     , ary );
	       },

  getFrameList : function ( win )
  {
    var result = [];
    for ( var i = 0 ; i < win.frames.length ; i++ )
      result.push( win.frames[i] );
    for ( var k = 0 ; k < win.frames.length ; k++ )
      result = result.concat( this.getFrameList( win.frames[k] ) );
    return result;
  },

  ajaxObject : function( url, callbackFunction )
  {
    var that=this;      
    this.updating = false;
    this.abort = function()
    {
      if (that.updating)
      {
	that.updating = false;
	that.AJAX.abort();
	that.AJAX = null;
      }
    }
    this.update = function( passData, postMethod )
    { 
      if ( that.updating ) { return false; }
      that.AJAX = null;                          
      if ( window.XMLHttpRequest )
	that.AJAX = new XMLHttpRequest();              
      else
	that.AJAX = new ActiveXObject( "Microsoft.XMLHTTP" );
      if ( that.AJAX == null )
	return false;                               
      else
      {
	that.AJAX.onreadystatechange = function()
	{  
	  if ( that.AJAX.readyState == 4 )
	  {             
	    that.updating = false;                
	    that.callback( that.AJAX.responseText,that.AJAX.status,that.AJAX.responseXML );        
	    that.AJAX=null;                                         
	  }                                                      
	}                                                        
	that.updating = new Date();                              
	if (/post/i.test(postMethod))
	{
	  var uri=urlCall+'?'+that.updating.getTime();
	  that.AJAX.open("POST", uri, true);
	  that.AJAX.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
	  that.AJAX.setRequestHeader("Content-Length", passData.length);
	  that.AJAX.send(passData);
	}
	else
	{
	  var uri=urlCall+'?'+passData+'&timestamp='+( that.updating.getTime() ); 
	  that.AJAX.open( "GET", uri, true );                             
	  that.AJAX.send( null );                                         
	}              
	return true;                                             
      }                                                                           
    }
    var urlCall = url;        
    this.callback = callbackFunction || function () { };
  }
};

////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////

nachoSD.opts = {

  prefCount : 1,
  prefs : null,

  init : function()
  { 
    nachoSD.opts.prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("extensions.nachoSD.");

    nachoSD.opts.prefs.QueryInterface( Components.interfaces.nsIPrefBranch2 );
    nachoSD.opts.prefs.addObserver( "", nachoSD.opts, false );

    var autologin = nachoSD.opts.prefs.getBoolPref( 'autologin' );
    var username = nachoSD.opts.prefs.getCharPref( 'user' );

    document.getElementById( "nachoSD-password-pref" ).value = nachoSD.opts.getPassword( username );
    document.getElementById( "nachoSD-username-pref" ).disabled = !autologin;
    document.getElementById( "nachoSD-password-pref" ).disabled = !autologin;

    nachoSD.opts.initQueryGUI();
    nachoSD.opts.initServerGUI();

    document.getElementById( "nachoSD-tabs" ).selectedIndex = nachoSD.opts.prefs.getIntPref( 'tab' );
  },

  shutdown : function() {
	       nachoSD.opts.savePasswordShutdown();
	       nachoSD.opts.prefs.removeObserver( "" , nachoSD.opts );
	     },

  observe : function( subject, topic, data )
	    {
	      if ( topic == "nsPref:changed" )
	      {
		if ( data == "serverIP" || data == "fff" )
		  nachoSD.browserOverlay.firefoxFix();
	      }
	      else if ( topic == "alertclickcallback" )
		alert( "Abriendo la incidencia: " + data );
	    },

  savePasswordShutdown : function()
	     {
	       var password = document.getElementById( "nachoSD-password-pref" ).value;
	       var username = this.prefs.getCharPref( 'user' );

	       nachoSD.opts.createPassword( username, password );
	       nachoSD.opts.changePassword( username, password );
	     },

  savePassword : function()
	     {
	       var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
		 .getService(Components.interfaces.nsIWindowMediator);
	       var optWin = wm.getMostRecentWindow( "nachoSDprefWindow" );

	       if ( !optWin ) return;

	       var password = optWin.document.getElementById( "nachoSD-password-pref" ).value;
	       var username = this.prefs.getCharPref( 'user' );

	       nachoSD.opts.createPassword( username, password );
	       nachoSD.opts.changePassword( username, password );
	     },

   addQueryRow : function()
		{
		  var rows   = document.getElementById( "nachoSD-queryRows" );
		  var prefs  = document.getElementById( "nachoSD-preferences" );

		  var newRow = document.createElement( 'row' );
		  var newTB1 = document.createElement( 'textbox' );
		  var newTB2 = document.createElement( 'textbox' );
		  var newCB  = document.createElement( 'checkbox' );
		  var newML  = document.createElement( 'menulist' );
		  var newMP  = document.createElement( 'menupopup' );
		  var newMI1 = document.createElement( 'menuitem' );
		  var newMI2 = document.createElement( 'menuitem' );
		  var newMI3 = document.createElement( 'menuitem' );
		  var newMI4 = document.createElement( 'menuitem' );
		  var newMI5 = document.createElement( 'menuitem' );
		  var newMI6 = document.createElement( 'menuitem' );
		  var newAtrPref = document.createElement( 'preference' );
		  var newValPref = document.createElement( 'preference' );
		  var newRelPref = document.createElement( 'preference' );
		  var newActPref = document.createElement( 'preference' );


		  newMP.appendChild( newMI1 );
		  newMP.appendChild( newMI2 );
		  newMP.appendChild( newMI3 );
		  newMP.appendChild( newMI4 );
		  newMP.appendChild( newMI5 );
		  newMP.appendChild( newMI6 );
		  newML.appendChild( newMP );
		  newRow.appendChild( newTB1 );
		  newRow.appendChild( newML );
		  newRow.appendChild( newTB2 );
		  newRow.appendChild( newCB );
		  rows.appendChild( newRow );
		  prefs.appendChild( newValPref );
		  prefs.appendChild( newAtrPref );
		  prefs.appendChild( newRelPref );
		  prefs.appendChild( newActPref );

		  newMI1.selected = true;
		  newMI1.label = "Equals";
		  newMI1.value = "QBE.EQ.";
		  newMI2.label = "Not Equals";
		  newMI2.value = "QBE.NE.";
		  newMI3.label = "Null";
		  newMI3.value = "QBE.NU.";
		  newMI4.label = "Not null";
		  newMI4.value = "QBE.NN.";
		  newMI5.label = "Contains";
		  newMI5.value = "QBE.KY.";
		  newMI6.label = "IN";
		  newMI6.value = "QBE.IN.";
		  newCB.checked = true;

		  newTB1.addEventListener( "input" , function(){ nachoSD.opts.textInput( newTB1 )  } , false );
		  newTB2.addEventListener( "input" , function(){ nachoSD.opts.textInput( newTB2 )  } , false );
		  newML.addEventListener ( "command" , function(){ nachoSD.opts.selectInput( newML ) } , false );
		  newCB.addEventListener ( "command" , function(){ nachoSD.opts.disableRow( newCB )  } , false );

		  this.prefCount++;

		  //Set up the preferences
		  newRow.id       = "nachoSD-queryRow"  + this.prefCount;
		  newAtrPref.id   = "nachoSD-atr" 	+ this.prefCount;
		  newRelPref.id   = "nachoSD-rel"  	+ this.prefCount;
		  newValPref.id   = "nachoSD-val"     	+ this.prefCount;
		  newActPref.id   = "nachoSD-act"    	+ this.prefCount;
		  newAtrPref.name = "extensions.nachoSD.query.atr" + this.prefCount;
		  newRelPref.name = "extensions.nachoSD.query.rel" + this.prefCount;
		  newValPref.name = "extensions.nachoSD.query.val" + this.prefCount;
		  newActPref.name = "extensions.nachoSD.query.act" + this.prefCount;
		  newAtrPref.type = "string";
		  newRelPref.type = "string";
		  newValPref.type = "string";
		  newActPref.type = "bool";

		  newTB1.setAttribute( 'preference' , newAtrPref.id );
		  newTB2.setAttribute( 'preference' , newValPref.id );
		  newML.setAttribute ( 'preference' , newRelPref.id );
		  newCB.setAttribute ( 'preference' , newActPref.id );

		  sizeToContent();
		},

  delQueryRow : function( element )
		{ 
		  var prefnum = element.getAttribute( 'preference' ).substr( 11 );
		  var rows = element.parentNode.parentNode;
		  var atr = element.parentNode.childNodes[0].value;
		  var val = element.parentNode.childNodes[2].value;

		  if ( atr == '' && val == '' )
		    if ( rows.childElementCount > 2 )
		    {
		      rows.removeChild( element.parentNode );

		      try{ nachoSD.opts.prefs.clearUserPref( 'query.val' + prefnum ); }catch( e ){};
		      try{ nachoSD.opts.prefs.clearUserPref( 'query.atr' + prefnum ); }catch( e ){};
		      if ( rows.childElementCount > 2 )
			try{ nachoSD.opts.prefs.clearUserPref( 'query.rel' + prefnum ); }catch( e ){};
		      try{ nachoSD.opts.prefs.clearUserPref( 'query.act' + prefnum ); }catch( e ){};

		      if ( rows.childElementCount == 2 )
			nachoSD.opts.prefs.setCharPref( 'query.rel' + prefnum , 'QBE.EQ.' );
		      sizeToContent();
		    }
		},

  initQueryGUI: function()	//Generates the row contents according to stored preferences
		 {
		   var atrList = this.prefs.getChildList( "query.atr" , { value:null } );
		   var valList = this.prefs.getChildList( "query.val" , { value:null } );
		   var relList = this.prefs.getChildList( "query.rel" , { value:null } );
		   var actList = this.prefs.getChildList( "query.act" , { value:null } );
		   var atrs = [];
		   var vals = [];
		   var rels = [];
		   var acts = [];

		   for( var i = 0 ; i < atrList.length ; i++ )
		     atrs.push( this.prefs.getCharPref( atrList[i] ) );
		   for( var i = 0 ; i < valList.length ; i++ )
		     vals.push( this.prefs.getCharPref( valList[i] ) );
		   for( var i = 0 ; i < relList.length ; i++ )
		     rels.push( this.prefs.getCharPref( relList[i] ) );
		   for( var i = 0 ; i < actList.length ; i++ )
		     acts.push( this.prefs.getBoolPref( actList[i] ) );

		   //Find correspondence between rows (some fields might be empty in a row)
		   var row = [];
		   for( var i = 0 ; i < atrList.length ; i++ )
		   {
		     var num = atrList[i].substr( 9 );
		     if ( row[ num ] == undefined )
		       row[ num ] = [];
		     row[ num ][ 0 ] = atrs[ i ];
		   }
		   for( var i = 0 ; i < relList.length ; i++ )
		   {
		     var num = relList[i].substr( 9 );
		     if ( row[ num ] == undefined )
		       row[ num ] = [];
		     row[ num ][ 1 ] = rels[ i ];
		   }
		   for( var i = 0 ; i < valList.length ; i++ )
		   {
		     var num = valList[i].substr( 9 );
		     if ( row[ num ] == undefined )
		       row[ num ] = [];
		     row[ num ][ 2 ] = vals[ i ];
		   }
		   for( var i = 0 ; i < actList.length ; i++ )
		   {
		     var num = actList[i].substr( 9 );
		     if ( row[ num ] == undefined )
		       row[ num ] = [];
		     row[ num ][ 3 ] = acts[ i ];
		   }

		   //Remove old preferences
		   this.prefs.deleteBranch( 'query.' );

		   //REBUILD ROW CONTENTS, AND ASSOCIATE PREFERENCES
		   var rows = document.getElementById( "nachoSD-queryRows" );
		   this.prefCount = 0;
		   var allEmpty = true;
		   for( i in row )
		   {
		     //Set defaults
		     if( row[i][0] == undefined ) row[i][0] = '';
		     if( row[i][1] == undefined ) row[i][1] = 'QBE.EQ.';
		     if( row[i][2] == undefined ) row[i][2] = '';
		     if( row[i][3] == undefined ) row[i][3] = true;

		     if( row[i][0] != '' || row[i][2] != '' )
		     {
		       allEmpty = false;

		       //The first line goes in the existing box
		       if( this.prefCount == 0 )
			 this.prefCount++;
		       else
			 this.addQueryRow();

		       // Disable the row if not active
		       if( !row[i][3] )
		       {
			 rows.lastElementChild.childNodes[0].disabled = true;
			 rows.lastElementChild.childNodes[1].disabled = true;
			 rows.lastElementChild.childNodes[2].disabled = true;
		       }

		       // Disable second textbox if 'Null' or 'Not Null' selected 
		       if( /QBE.NN.|QBE.NU./.test( row[i][1] ) )
			 rows.lastElementChild.childNodes[2].disabled = true;

		       //Restore the values/preferences
		       try{ this.prefs.setCharPref( 'query.atr' + this.prefCount , row[i][0] ); }catch(e){}
		       try{ this.prefs.setCharPref( 'query.rel' + this.prefCount , row[i][1] ); }catch(e){}
		       try{ this.prefs.setCharPref( 'query.val' + this.prefCount , row[i][2] ); }catch(e){}
		       try{ this.prefs.setBoolPref( 'query.act' + this.prefCount , row[i][3] ); }catch(e){}
		     }
		   }
		   //... and the last empty one
		   if ( !allEmpty )
		     this.addQueryRow();
		   else
		   {
		      this.prefCount = 1;
		      this.prefs.setCharPref( 'query.rel1' , 'QBE.EQ.' );
		      this.prefs.setBoolPref( 'query.act1' , true ); 
		   }
		 },

  disableAutologinFields : function( element )
			   {
			     document.getElementById( "nachoSD-username-pref" ).disabled = !element.checked;
			     document.getElementById( "nachoSD-password-pref" ).disabled = !element.checked;
			   },

  createPassword : function( username, password )
		   {
		     var myLoginManager = Components.classes["@mozilla.org/login-manager;1"].
		       getService(Components.interfaces.nsILoginManager);

		     var nsLoginInfo = new Components.Constructor("@mozilla.org/login-manager/loginInfo;1",
			 Components.interfaces.nsILoginInfo, "init");
		     var nachoSDlogin = new nsLoginInfo( 'chrome://nachoSD', null, 'NachoSD', username, password, "", "" ); 
		       try{ myLoginManager.addLogin( nachoSDlogin ); }catch(e){}
		   },

  getPassword : function( username )
		{
		  var password = null;

		  // Get Login Manager 
		  var myLoginManager = Components.classes["@mozilla.org/login-manager;1"].
		    getService(Components.interfaces.nsILoginManager);

		  // Find users for the given parameters
		  var logins = myLoginManager.findLogins({}, 'chrome://nachoSD', null, 'NachoSD' );

		  // Find user from returned array of nsILoginInfo objects
		  for ( var i = 0 ; i < logins.length ; i++ ) 
		    if ( logins[i].username == username ) {
		      password = logins[i].password;
		      break;
		    }
		  return password;
		},

  changePassword : function( username, password )
		   {
		     var myLoginManager = Components.classes["@mozilla.org/login-manager;1"].
		       getService(Components.interfaces.nsILoginManager);
		     var nsLoginInfo = new Components.Constructor("@mozilla.org/login-manager/loginInfo;1",
			 Components.interfaces.nsILoginInfo, "init");

		     var newLogin = new nsLoginInfo( 'chrome://nachoSD', null, 'NachoSD', username, password, "", "" ); 

		       // Find users for the given parameters
		       var logins = myLoginManager.findLogins( {}, 'chrome://nachoSD', null, 'NachoSD' );

		     // Find user from returned array of nsILoginInfo objects
		     for ( var i = 0 ; i < logins.length ; i++ ) 
		       if ( logins[i].username == username ) {
			 myLoginManager.modifyLogin( logins[i], newLogin );
			 break;
		       }
		   },

  textInput : function( element )
	      {
		if ( element.parentNode.parentNode.lastElementChild === element.parentNode )
		  nachoSD.opts.addQueryRow();
		else
		  nachoSD.opts.delQueryRow( element );
	      },

  selectInput : function( element ) { element.parentNode.childNodes[2].disabled = element.value == 'QBE.NU.' || element.value == 'QBE.NN.'; },

  disableRow : function( element )
  {
    var row = element.parentNode.childNodes;

    row[0].disabled = !element.checked;
    row[1].disabled = !element.checked;
    row[2].disabled = row[1].value == 'QBE.NU.' || row[1].value == 'QBE.NN.' || !element.checked;
  },

  tabSelected : function( e ) { if ( this.prefs ) this.prefs.setIntPref( 'tab' , e.target.selectedIndex ); },

  serverSelected : function( e ) //TODO merge with setserver?
  { 
    let rowIndex = e.target.value;
    if ( rowIndex == null ) return;

    //Save the selection
    this.prefs.setIntPref( 'serverlistindex' , rowIndex );

    //Clear the checks -- TODO make this a function
    var prefs = this.prefs.getChildList( "serverlist." , { value:null } );
    var rowNum = prefs.length/5;
    for( var i = 0 ; i < rowNum ; i++ )
    {
      opener.document.getElementById( 'nachoSD_menuitem_serverlist_m_' + i ).setAttribute( 'checked' , 'false' );
      opener.document.getElementById( 'nachoSD_menuitem_serverlist_c_' + i ).setAttribute( 'checked' , 'false' );
    }

    //Set the check on the menues
    opener.document.getElementById( 'nachoSD_menuitem_serverlist_m_' + rowIndex ).setAttribute( 'checked' , 'true' );
    opener.document.getElementById( 'nachoSD_menuitem_serverlist_c_' + rowIndex ).setAttribute( 'checked' , 'true' );

    //Get the saved configuration
    let name = this.prefs.getCharPref( "serverlist." + rowIndex + '.nam' );
    let dir  = this.prefs.getCharPref( "serverlist." + rowIndex + '.dir' );
    let port = this.prefs.getCharPref( "serverlist." + rowIndex + '.prt' );
    let user = this.prefs.getCharPref( "serverlist." + rowIndex + '.usr' );
    let alog = this.prefs.getBoolPref( "serverlist." + rowIndex + '.alg' );

    //Fill in the boxes with the server configuration
    this.prefs.setCharPref( 'serverIP'   , dir  );
    this.prefs.setCharPref( 'serverName' , name );
    this.prefs.setCharPref( 'serverPort' , port );
    this.prefs.setCharPref( 'user'       , user );
    this.prefs.setBoolPref( 'autologin'  , alog );
    document.getElementById( "nachoSD-serverName-pref" ).value = name;
    document.getElementById( "nachoSD-serverIP-pref" ).value = dir;
    document.getElementById( "nachoSD-serverPort-pref" ).value = port;
    document.getElementById( "nachoSD-username-pref" ).value = user;
    document.getElementById( "nachoSD-autologin-pref" ).value = alog;
    document.getElementById( "nachoSD-password-pref" ).value = nachoSD.opts.getPassword( user );
    document.getElementById( "nachoSD-username-pref" ).disabled = !alog;
    document.getElementById( "nachoSD-password-pref" ).disabled = !alog;
  },

  saveServer : function()
	       {
		 var rowList = document.getElementById( "nachoSD-serv-pref" );
		 var rows = rowList.getElementsByTagName( 'listitem' );
		 var name = document.getElementById( 'nachoSD-serverName-pref' ).value;
		 
		 for( var i = 0 ; i < rows.length ; i++ )
		   if ( name == rows[i].childNodes[0].getAttribute( 'label' ) )
		   {
		     this.updateServer( i );
		     return;
		   }
		 var prefs = nachoSD.opts.prefs.getChildList( "serverlist." , { value:null } );
		 var rowNum = prefs.length/5;
		 this.prefs.setIntPref( 'serverlistindex' , rowNum );
		 this.addServer();
	       },

  addServer : function( name, dir, port, user, alog )
	      {
		var prefs = nachoSD.opts.prefs.getChildList( "serverlist." , { value:null } );
		var rowNum = prefs.length/5;

		name = name || document.getElementById( 'nachoSD-serverName-pref' ).value;
		dir  = dir  || document.getElementById( 'nachoSD-serverIP-pref' ).value;
		port = port || document.getElementById( 'nachoSD-serverPort-pref' ).value;
		user = user || document.getElementById( 'nachoSD-username-pref' ).value;
		alog = alog || document.getElementById( 'nachoSD-autologin-pref' ).checked;

		//Empty the menu
		nachoSD.browserOverlay.cleanMenuSD();

		//Fill the list
		this.addServerRow( name, dir, port, user, alog );

		//Set the preferences
		this.prefs.setCharPref( 'serverlist.' + rowNum + '.nam' , name );
		this.prefs.setCharPref( 'serverlist.' + rowNum + '.dir' , dir  );
		this.prefs.setCharPref( 'serverlist.' + rowNum + '.prt' , port );
		this.prefs.setCharPref( 'serverlist.' + rowNum + '.usr' , user );
		this.prefs.setBoolPref( 'serverlist.' + rowNum + '.alg' , alog );

		//Reload menues
		nachoSD.browserOverlay.initMenuSD();

		//sizeToContent();
	      },

  addServerRow : function( name, dir, port, user, alog )
	       {
		 var rowList = document.getElementById( "nachoSD-serv-pref" );
		 var rows = rowList.getElementsByTagName( 'listitem' );
		 var prefs  = document.getElementById( "nachoSD-preferences" );
		 var rowNum = rows.length;

		 name = name || document.getElementById( 'nachoSD-serverName-pref' ).value;
		 dir  = dir  || document.getElementById( 'nachoSD-serverIP-pref' ).value;
		 port = port || document.getElementById( 'nachoSD-serverPort-pref' ).value;
		 user = user || document.getElementById( 'nachoSD-username-pref' ).value;
		 alog = alog || document.getElementById( 'nachoSD-autologin-pref' ).checked;

		 //Create the row elements
		 var newRow = document.createElement( 'listitem' );
		 var newMI1 = document.createElement( 'listcell' );
		 var newMI2 = document.createElement( 'listcell' );
		 var newMI3 = document.createElement( 'listcell' );
		 var newNamPref = document.createElement( 'preference' );
		 var newDirPref = document.createElement( 'preference' );
		 var newPrtPref = document.createElement( 'preference' );
		 var newUsrPref = document.createElement( 'preference' );
		 var newAlgPref = document.createElement( 'preference' );

		 newRow.appendChild( newMI1 );
		 newRow.appendChild( newMI2 );
		 newRow.appendChild( newMI3 );
		 rowList.appendChild( newRow );
		 prefs.appendChild( newNamPref );
		 prefs.appendChild( newDirPref );
		 prefs.appendChild( newPrtPref );
		 prefs.appendChild( newUsrPref );
		 prefs.appendChild( newAlgPref );

		 //Create the preferences
		 newNamPref.id   = "nachoSD-nam"	+ rowNum;
		 newDirPref.id   = "nachoSD-dir"  	+ rowNum;
		 newPrtPref.id   = "nachoSD-prt"     	+ rowNum;
		 newUsrPref.id   = "nachoSD-usr"    	+ rowNum;
		 newAlgPref.id   = "nachoSD-alg"    	+ rowNum;
		 newNamPref.name = "extensions.nachoSD.serverlist." + rowNum + ".nam";
		 newDirPref.name = "extensions.nachoSD.serverlist." + rowNum + ".dir";
		 newPrtPref.name = "extensions.nachoSD.serverlist." + rowNum + ".prt";
		 newUsrPref.name = "extensions.nachoSD.serverlist." + rowNum + ".usr";
		 newAlgPref.name = "extensions.nachoSD.serverlist." + rowNum + ".alg";
		 newNamPref.type = "string";
		 newDirPref.type = "string";
		 newPrtPref.type = "string";
		 newUsrPref.type = "string";
		 newAlgPref.type = "bool";

		 //Set up values
		 newRow.value = rowNum;
		 newRow.setAttribute( 'id' , 'nachoSD-serverlist-' + rowNum );
		 newMI1.setAttribute( 'label' , name );
		 newMI2.setAttribute( 'label' , dir  );
		 newMI3.setAttribute( 'label' , user );

		 sizeToContent();
	       },
	      
  updateServer : function( rowNum, name, dir, port, user, alog )
		 {
		   if ( rowNum == undefined ) return;
		   name = name || document.getElementById( 'nachoSD-serverName-pref' ).value;
		   dir  = dir  || document.getElementById( 'nachoSD-serverIP-pref' ).value;
		   port = port || document.getElementById( 'nachoSD-serverPort-pref' ).value;
		   user = user || document.getElementById( 'nachoSD-username-pref' ).value;
		   alog = alog || document.getElementById( 'nachoSD-autologin-pref' ).checked;

		   var rowList = document.getElementById( "nachoSD-serv-pref" );
		   var rows = rowList.getElementsByTagName( 'listitem' );

		   let name = document.getElementById( 'nachoSD-serverName-pref' ).value;
		   let dir  = document.getElementById( 'nachoSD-serverIP-pref' ).value;
		   let port = document.getElementById( 'nachoSD-serverPort-pref' ).value;
		   let user = document.getElementById( 'nachoSD-username-pref' ).value;
		   let alog = document.getElementById( 'nachoSD-autologin-pref' ).checked;

		   //Set up the values
		   rows[ rowNum ].childNodes[0].setAttribute( 'label' , name );
		   rows[ rowNum ].childNodes[1].setAttribute( 'label' , dir  );
		   rows[ rowNum ].childNodes[2].setAttribute( 'label' , user );

		   //Set the preferences
		   this.prefs.setCharPref( 'serverlist.' + rowNum + '.nam' , name );
		   this.prefs.setCharPref( 'serverlist.' + rowNum + '.dir' , dir  );
		   this.prefs.setCharPref( 'serverlist.' + rowNum + '.prt' , port );
		   this.prefs.setCharPref( 'serverlist.' + rowNum + '.usr' , user );
		   this.prefs.setBoolPref( 'serverlist.' + rowNum + '.alg' , alog );

		   //Set the check on the menues
		   opener.document.getElementById( 'nachoSD_menuitem_serverlist_m_' + rowNum ).setAttribute( 'checked' , 'true' );
		   opener.document.getElementById( 'nachoSD_menuitem_serverlist_c_' + rowNum ).setAttribute( 'checked' , 'true' );
		 },

  delServer : function()
	      {
		var rowList = document.getElementById( "nachoSD-serv-pref" );
		if ( rowList.selectedItem )
		{
		  //Remove the preference
		  var i = rowList.selectedItem.id.substr( 19 );
		  try{ nachoSD.opts.prefs.clearUserPref( 'serverlist.' + i + '.nam' ); }catch( e ){};
		  try{ nachoSD.opts.prefs.clearUserPref( 'serverlist.' + i + '.dir' ); }catch( e ){};
		  try{ nachoSD.opts.prefs.clearUserPref( 'serverlist.' + i + '.prt' ); }catch( e ){};
		  try{ nachoSD.opts.prefs.clearUserPref( 'serverlist.' + i + '.usr' ); }catch( e ){};
		  try{ nachoSD.opts.prefs.clearUserPref( 'serverlist.' + i + '.alg' ); }catch( e ){};

		  //Clean the list
		  var rows = rowList.getElementsByTagName( 'listitem' );
		  while ( rows.length > 0 )
		    rowList.removeChild( rows[0] );

		  //Rebuild list, menus and remaining preferences
		  this.prefs.setIntPref( 'serverlistindex' , -1 );
		  this.initServerGUI();
		}
	      },

  initServerGUI: function()	//Generates the row contents according to stored preferences
		 {
		   var prefs = this.prefs.getChildList( "serverlist." , { value:null } );
		   var prefNum = prefs.length/5;

		   //REMOVE ALL PREFERENCES AND RESTORE THEM ANEW
		   //Get used indexes
		   var indexes = [];
		   for ( var n = 0 ; indexes.length < prefNum ; n++ )
		   {
		     var aux = this.prefs.getChildList( "serverlist." + n , { value:null } );
		     if ( aux.length > 0 )
		       indexes.push( n );
		   }

		   //Save current values
		   var vals = [];
		   for( var i = 0 ; i < indexes.length ; i++ )
		   {
		     let name = this.prefs.getCharPref( 'serverlist.' + indexes[i] + '.nam' );
		     let dir  = this.prefs.getCharPref( 'serverlist.' + indexes[i] + '.dir' );
		     let port = this.prefs.getCharPref( 'serverlist.' + indexes[i] + '.prt' );
		     let user = this.prefs.getCharPref( 'serverlist.' + indexes[i] + '.usr' );
		     let alog = this.prefs.getBoolPref( 'serverlist.' + indexes[i] + '.alg' );
		     vals.push( [ name,dir,port,user,alog ] );
		   }

		   //Clean the menus
		   nachoSD.browserOverlay.cleanMenuSD();

		   //Remove all preferences
		   this.prefs.deleteBranch( 'serverlist.' );

		   //Restore the list, including preferences
		   for( var i = 0 ; i < vals.length ; i++ )
		     this.addServer( vals[i][0], vals[i][1], vals[i][2], vals[i][3], vals[i][4] );
		 }
}

//
//
//
//function getField( whereclause, factory, processFunc, field )
//{
//  processFunc = processFunc || window.alert;
//  factory = factory || 'cr';
//  field = field || 'id';
//
//  var myRequest = new ajaxObject( nachoSD.browserOverlay.buildcgi(),     //Extrae de la respuesta una tabla de valores, y la pasa a la función
//      function ( responseText, responseStatus )
//      {
//      if ( responseStatus != 200 )
//      alert( responseStatus + ' -- Error procesando la petición' );
//      else
//      {
//      var mydiv = document.createElement( 'div' );	//<div> para extraer los valores de manera sencilla
//      mydiv.innerHTML = responseText;
//      var nodes = mydiv.getElementsByTagName( 'infovalue' );
//      var values = [];
//
//      for ( var i = 0 ; i < nodes.length ; i++ )
//      values.push( nodes[i].firstChild.nodeValue );
//
//      if ( processFunc )
//      processFunc( values );
//      }
//      } );
//  //myRequest.update( "SID=" + sid + "+FID=" fid + "+OP=JUST_GRONK_IT+HTMPL=query_field.htmpl+FACTORY=" + factory + "+WC=" + escape( whereclause ) + "+FIELD=" + field );
//}

//	<toolbarspring/>
//	<button id="nachoSD_cr_list" type="menu" label="7 Incidencias" style="color:#DC0000;font-weight:bold">
//	  <menupopup>
//	    <menuitem label="Incidencia Funcional..."/>
//	    <menuitem label="Incidencia Hardware..."/>
//	    <menuitem label="Incidencia Hardware..."/>
//	    <menuitem label="Incidencia Hardware..."/>
//	    <menuitem label="Incidencia Hardware..."/>
//	  </menupopup>
//	</button>

