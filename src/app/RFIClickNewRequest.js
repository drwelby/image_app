/**
 * @requires plugins/Tool.js
 * @requires GeoExt/widgets/Popup.js
 * @requires OpenLayers/Control/WMSGetFeatureInfo.js
 * @requires OpenLayers/Format/WMSGetFeatureInfo.js
 * @requires OpenLayers/Format/WKT.js
 */

/** api: (define)
 *  module = rfi
 *  class = RFIClickNewRequest
 */

/** api: (extends)
 *  plugins/Tool.js
 */
Ext.namespace("rfi");

/** api: constructor
 *  .. class:: RFIClickNewRequest(config)
 *
 *    This plugins provides an action which, when active, will issue a
 *    GetFeatureInfo request to the WMS of all layers on the map. The first
 *    polygon feature found will be used to populate a new image request
 */   
rfi.RFIClickNewRequest = Ext.extend(gxp.plugins.Tool, {
    
    /** api: ptype = gxp_wmsgetfeatureinfo */
    ptype: "rfi_rficlicknewrequest",
    
    /** api: config[outputTarget]
     *  ``String`` Popups created by this tool are added to the map by default.
     */
    outputTarget: "map",


    /** api: config[infoActionTip]
     *  ``String``
     *  Text for feature info action tooltip (i18n).
     */
    infoActionTip: "New Request From Feature",

    /** api: config[popupTitle]
     *  ``String``
     *  Title for info popup (i18n).
     */
    popupTitle: "New Request From Feature",
    
    /** api: config[format]
     *  ``String`` Either "html" or "grid". If set to "grid", GML will be
     *  requested from the server and displayed in an Ext.PropertyGrid.
     *  Since we need the boundary, this needs to be "grid"
     *  TODO: hardcode this in so only gml-capable layers are queried
     */
    format: "grid",
    
    /** api: config[vendorParams]
     *  ``Object``
     *  Optional object with properties to be serialized as vendor specific
     *  parameters in the requests (e.g. {buffer: 10}).
     */
    
    /** api: config[layerParams]
     *  ``Array`` List of param names that should be taken from the layer and
     *  added to the GetFeatureInfo request (e.g. ["CQL_FILTER"]).
     */
     
    /** api: config[itemConfig]
     *  ``Object`` A configuration object overriding options for the items that
     *  get added to the popup for each server response or feature. By default,
     *  each item will be configured with the following options:
     *
     *  .. code-block:: javascript
     *
     *      xtype: "propertygrid", // only for "grid" format
     *      title: feature.fid ? feature.fid : title, // just title for "html" format
     *      source: feature.attributes, // only for "grid" format
     *      html: text, // responseText from server - only for "html" format
     */

    /** api: method[addActions]
     */
    addActions: function() {
        this.popupCache = {};
        
        var actions = rfi.RFIClickNewRequest.superclass.addActions.call(this, [{
            tooltip: this.infoActionTip,
            iconCls: "rfi-clicknewrequest",
            toggleGroup: this.toggleGroup,
            enableToggle: true,
            allowDepress: true,
            toggleHandler: function(button, pressed) {
                for (var i = 0, len = info.controls.length; i < len; i++){
                    if (pressed) {
                        info.controls[i].activate();
                    } else {
                        info.controls[i].deactivate();
                    }
                }
             }
        }]);
        var infoButton = this.actions[0].items[0];

        var info = {controls: []};
        var updateInfo = function() {
            // or just use the current/active layer?
            var queryableLayers = this.target.mapPanel.layers.queryBy(function(x){
                return x.get("queryable");
            });

            var map = this.target.mapPanel.map;
            var control;
            for (var i = 0, len = info.controls.length; i < len; i++){
                control = info.controls[i];
                control.deactivate();  // TODO: remove when http://trac.openlayers.org/ticket/2130 is closed
                control.destroy();
            }

            info.controls = [];
            queryableLayers.each(function(x){
                var layer = x.getLayer();
                var vendorParams = Ext.apply({}, this.vendorParams), param;
                if (this.layerParams) {
                    for (var i=this.layerParams.length-1; i>=0; --i) {
                        param = this.layerParams[i].toUpperCase();
                        vendorParams[param] = layer.params[param];
                    }
                }
                var infoFormat = x.get("infoFormat");
                // TODO: skip layers that return text/html
                if (infoFormat === undefined) {
                    // TODO: check if chosen format exists in infoFormats array
                    // TODO: this will not work for WMS 1.3 (text/xml instead for GML)
                    infoFormat = this.format == "html" ? "text/html" : "application/vnd.ogc.gml";
                }
                var control = new OpenLayers.Control.WMSGetFeatureInfo(Ext.applyIf({
                    url: layer.url,
                    queryVisible: true,
                    layers: [layer],
                    infoFormat: infoFormat,
                    vendorParams: vendorParams,
                    eventListeners: {
                        getfeatureinfo: function(evt) {
                            var title = x.get("title") || x.get("name");
                            if (infoFormat == "text/html") {
                                    return;
                            } else if (infoFormat == "text/plain") {
                                return;
                            } else if (evt.features && evt.features.length > 0) {
                                this.displayPopup(evt, title);
                            }
                        },
                        scope: this
                    }
                }, this.controlOptions));
                map.addControl(control);
                info.controls.push(control);
                if(infoButton.pressed) {
                    control.activate();
                }
            }, this);

        };
        
        this.target.mapPanel.layers.on("update", updateInfo, this);
        this.target.mapPanel.layers.on("add", updateInfo, this);
        this.target.mapPanel.layers.on("remove", updateInfo, this);
        
        return actions;
    },

    /** private: method[displayPopup]
     * :arg evt: the event object from a 
     *     :class:`OpenLayers.Control.GetFeatureInfo` control
     * :arg title: a String to use for the title of the results section 
     *     reporting the info to the user
     * :arg text: ``String`` Body text.
     */
    displayPopup: function(evt, title, text) {

        var features = evt.features, items = [];
        if (features) {
            // loop through and pick polygons
            var isPolygon = function(f){
                return f.geometry.CLASS_NAME == "OpenLayers.Geometry.Polygon";
            }
            var polygons = OpenLayers.Array.filter(features, isPolygon);

            for (var i=0,ii=polygons.length; i<ii; ++i) {
                feature = polygons[i];
                items.push(
                        Ext.apply({
                        xtype: "propertygrid",
                        listeners: {
                            'beforeedit': function (e) { 
                                return false; 
                            } 
                        },
                        source: feature.attributes
                        }, this.itemConfig));
            }
        } 
        var popup;
        var activeItem = 0;

        var changecard = function(step){
            activeItem = activeItem + step;
            if (activeItem >= (features.length - 1)) {
                Ext.getCmp('nextButton').disable();
                Ext.getCmp('prevButton').enable();
            }  
            else if (activeItem <= 0) {
               Ext.getCmp('prevButton').disable();
                Ext.getCmp('nextButton').enable();
            }
            else {
                Ext.getCmp('prevButton').enable();
                Ext.getCmp('nextButton').enable();
            }
            popup.layout.setActiveItem(activeItem);
            featureCount.setText(String(activeItem + 1) + "/" + features.length);

        }
        
        var featureCount = new Ext.Toolbar.TextItem({text: '1/' + features.length});
        if (features.length == 1) {featureCount.addClass('x-item-disabled');}

        popup = this.addOutput({
            xtype: "gx_popup",
            title: this.popupTitle,
            layout: "card",
            activeItem: activeItem,
            fill: false,
            autoScroll: true,
            location: evt.xy,
            map: this.target.mapPanel,
            width: 250,
            height: 300,
            defaults: {
                layout: "fit",
                autoScroll: true,
                autoHeight: true,
                autoWidth: true
            },
            items: items,
            bbar:[{
                id: "prevButton",
                text: "< Prev",
                disabled: true,
                handler: function(){
                    changecard(-1);
                }
                 },' ',
                featureCount,
                ' ',{
                id: "nextButton",
                text: "Next >",
                disabled: features.length <= 1 ? true : false,
                scope: this,
                handler: function(){
                    changecard(1);
                }
                 },'->',{
                text: "Use This Feature",
                handler: function(){
                    geom = features[activeItem].geometry.toString();
                    url = rfi.DJANGO_BASE_URL + "/new/?bounds=" + escape(geom);
                    window.open(url);
                }
                 }]
        });


        popup.doLayout();
    }
    
});

Ext.preg(rfi.RFIClickNewRequest.prototype.ptype, rfi.RFIClickNewRequest);
