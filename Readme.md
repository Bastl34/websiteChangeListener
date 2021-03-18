# websiteChangeListener

websiteChangeListener is a node.js website change listener.
You can define a website URL + a xPath/query Selector to watch and get immediately notified by eMail when something has changed.


# Installation

* clone this repository and run
  * `npm install`

# Configure

* copy config.user.js.dist to config.user.js
  * `cp config.user.js.dist config.user.js`
* configure your watcher:
  * enter a url to watch
  * open you website in chrome (or another browser) and find the xpath of the element to watch
  * you can use the developer tools and pick an item on the website (and right click copy xpath)
  * as an alternative: you can use a query selector
* enter the `mail`-credentials for your smtp mail service (like gmail)
  * if you are using gmail: enable usage for less secure apps in gmail
* if you want to get notified via slack: use a webhook

# Start

    node index.js

# Start using forever service

    sudo npm install -g forever
    sudo npm install -g forever-service

    #add new service
    sudo forever-service install websiteChangeListener --script index.js --noGracefulShutdown --start

    #if you want to uninstall the service
    sudo forever-service delete websiteChangeListener