/**
 * Add all your dependencies here.
 *
 * @require widgets/Viewer.js
 * @require widgets/CrumbPanel.js
 * @require plugins/LayerTree.js
 * @require plugins/OLSource.js
 * @require plugins/OSMSource.js
 * @require plugins/WMSCSource.js
 * @require plugins/WMSSource.js
 * @require plugins/ZoomToExtent.js
 * @require plugins/NavigationHistory.js
 * @require plugins/Zoom.js
 * @require plugins/AddLayers.js
 * @require plugins/RemoveLayer.js
 * @require plugins/FeatureManager.js
 * @require plugins/FeatureEditor.js
 * @require plugins/FeatureGrid.js
 * @require plugins/WMSGetFeatureInfo.js
 * @require plugins/QueryForm.js
 * @require RowExpander.js
 * @require widgets/NewSourceDialog.js
 * @require RFIClickNewRequest.js
 */

var app;
Ext.onReady(function() {

    Ext.namespace("rfi");
    rfi.DJANGO_BASE_URL = "http://192.168.244.151:8000/rfi";
    //rfi.DJANGO_BASE_URL = "/rfi";

    function showMenu(grid, index, event) {
      event.stopEvent();
      var record = grid.getStore().getAt(index);
      var menu = new Ext.menu.Menu({
            items: [{
                text: 'Zoom to request',
                handler: function() {
                    bounds = record.get('feature').geometry.getBounds();
                    app.mapPanel.map.zoomToExtent(bounds);
                }
            }, {
                text: 'View request info',
                handler: function() {
                    id = record.get('id');
                    url = rfi.DJANGO_BASE_URL + "/info/" + id + "/";
                    //window.open(url, '_self');
                    Ext.Ajax.request({
                        url: url,
                        success: function(response){
                            var win = new Ext.Window({
                                title: 'Request Details',
                                width: 500,
                                height: 550,
                                autoScroll: true,
                                plain: true,
                                border: false,
                                html:response.responseText
                            });
                            win.show();
                        }
                    });
                }
            }, {
                text: 'Edit request info',
                handler: function() {
                    id = record.get('id');
                    url = rfi.DJANGO_BASE_URL + "/edit/" + id + "/";
                    window.open(url, '_self');
                }
            }]
        }).showAt(event.xy);
    }

    app = new gxp.Viewer({
        portalConfig: {
            layout: "border",
            region: "center",
            tbar: { 
                xtype: "toolbar",
                id: 'paneltbar',
                disabled: true,
                items: []
                },
            // by configuring items here, we don't need to configure portalItems
            // and save a wrapping container
            items: [{
                id: "centerpanel",
                xtype: "panel",
                layout: "fit",
                region: "center",
                border: false,
                items: ["mymap"]
            }, {
                id: "westpanel",
                xtype: "gxp_crumbpanel",
                //layout: "fit",
                region: "west",
                width: 200,
                split: true,
                collapsible: true,
                collapseMode: "mini",
                hideCollapseTool: true,
                header: false
            },{
                id: "south",
                xtype: "container",
                layout: "fit",
                region: "south",
                border: false,
                height: 200
            }
            ],
            bbar: {id: "mybbar"}
        },
        
        // configuration of all tool plugins for this application
        tools: [{
            ptype: "gxp_layertree",
            outputConfig: {
                id: "tree",
                border: true,
                tbar: [] // we will add buttons to "tree.bbar" later
            },
            outputTarget: "westpanel"
        }, {
            ptype: "gxp_addlayers",
            actionTarget: "tree.tbar"
        }, {
            ptype: "gxp_removelayer",
            actionTarget: ["tree.tbar", "tree.contextMenu"]
        }, {
            ptype: "gxp_wmsgetfeatureinfo", 
            format: 'grid',
            showButtonText: true,
            actionTarget: "map.tbar",
            toggleGroup: "maptools"
        }, {
            ptype: "gxp_zoomtoextent",
            actionTarget: "map.tbar"
        }, {
            ptype: "gxp_zoom",
            actionTarget: "map.tbar"
        }, {
            ptype: "gxp_navigationhistory",
            actionTarget: "map.tbar"
        },{
            ptype: "gxp_featuremanager",
            id: "requests_manager",
            paging: false,
            autoLoadFeatures: true,
            layer: {
                source: "local",
                name: "rfi:rfi_requestforimagery"
            }
        },{
            ptype: "gxp_featureeditor",
            featureManager: "requests_manager",
            autoLoadFeature: true,
            toggleGroup: "maptools"
        },{
            ptype: "gxp_featuregrid",
            featureManager: "requests_manager",
            outputConfig: {
                loadMask: true,
                listeners: {
                        rowcontextmenu: function(grid, index, event) {
                            showMenu(grid, index, event);
                        }
                }
            },
            outputTarget: "south"
        },{
            ptype: "gxp_queryform",
            featureManager: "requests_manager",
            actionTarget: "map.tbar"
        },{
            ptype: "rfi_rficlicknewrequest",
            actionTarget: "map.tbar",
            toggleGroup: "maptools"
        }],

        
        // layer sources
        sources: {
            local: {
                ptype: "gxp_wmscsource",
                url: "/geoserver/wms",
                version: "1.1.1"
            },
            osm: {
                ptype: "gxp_osmsource"
            }
        },
        
        // map and layers
        map: {
            id: "mymap", // id needed to reference map in portalConfig above
            //title: "Map",
            projection: "EPSG:900913",
            center: [-10764594.758211, 4523072.3184791],
            zoom: 3,
            layers: [{
                source: "osm",
                name: "mapnik",
                group: "background"
            }, {
                source: "local",
                name: "rfi:rfi_requestforimagery",
                selected: true
            }],
            items: [{
                xtype: "gx_zoomslider",
                vertical: true,
                height: 100
            }]
        },

        defaultSourceType: "gxp_wmssource",
        proxy: "proxy/?url="

    });
});
