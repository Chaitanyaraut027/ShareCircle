import React, { useMemo, useRef, useCallback } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';

const CARTO_VOYAGER = 'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png';
const CARTO_SATELLITE = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

/**
 * Leaflet-based map via WebView — no Google Maps API key required.
 *
 * Props:
 *  - latitude, longitude  : center of map (required)
 *  - zoom                 : initial zoom level (default 13)
 *  - markers              : array of donation objects with location.coordinates[lng, lat]
 *  - radiusKm             : draw a radius circle around user (km), 0 = disabled
 *  - draggable            : if true, show a draggable pin (location picker mode)
 *  - satellite            : if true, use satellite imagery tiles
 *  - onMarkerPress        : (id: string) => void — called when a donation marker is tapped
 *  - onCoordChange        : ({latitude, longitude}) => void — called when draggable pin moves
 *  - style                : View style
 */
export default function LeafletMap({
  latitude,
  longitude,
  zoom = 13,
  markers = [],
  radiusKm = 0,
  draggable = false,
  satellite = false,
  onMarkerPress,
  onCoordChange,
  style,
}) {
  const wvRef = useRef(null);

  const html = useMemo(() => {
    if (!latitude || !longitude) return '<html><body style="background:#E2F0E8"></body></html>';

    const tileUrl = satellite ? CARTO_SATELLITE : CARTO_VOYAGER;
    const tileAttr = satellite ? '&copy; ESRI' : '&copy; CartoDB';

    const markerJson = JSON.stringify(
      markers
        .map((m) => {
          const lat = parseFloat(m.location?.coordinates?.[1]);
          const lng = parseFloat(m.location?.coordinates?.[0]);
          if (isNaN(lat) || isNaN(lng)) return null;
          return {
            id: String(m._id || m.id || ''),
            lat,
            lng,
            title: (m.title || '').replace(/'/g, "\\'"),
            donor: ((m.donor?.fullName) || 'Unknown').replace(/'/g, "\\'"),
          };
        })
        .filter(Boolean)
    );

    const radiusCircle =
      radiusKm > 0
        ? `L.circle([${latitude},${longitude}],{
            radius:${radiusKm * 1000},
            color:'#2F7B5E',fillColor:'#2F7B5E',
            fillOpacity:0.07,weight:1.5
          }).addTo(map);`
        : '';

    const draggablePin = draggable
      ? `
        var pIcon=L.divIcon({
          className:'',
          html:'<div style="width:36px;height:36px;background:#2F7B5E;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(0,0,0,.3)"><span style="transform:rotate(45deg);font-size:18px">📍</span></div>',
          iconSize:[36,36],iconAnchor:[18,36]
        });
        var pp=L.marker([${latitude},${longitude}],{icon:pIcon,draggable:true}).addTo(map);
        function emitCoord(lt,ln){
          window.ReactNativeWebView.postMessage(JSON.stringify({t:'cc',lat:lt,lng:ln}));
        }
        pp.on('dragend',function(e){var p=e.target.getLatLng();emitCoord(p.lat,p.lng);});
        map.on('click',function(e){pp.setLatLng(e.latlng);emitCoord(e.latlng.lat,e.latlng.lng);});
      `
      : '';

    return `<!DOCTYPE html>
<html><head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
    integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin=""/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
    integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV/XN/WLs=" crossorigin=""></script>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body{width:100%;height:100%;overflow:hidden;background:#e8f0ec}
    #m{width:100%;height:100%}
    .leaflet-control-attribution{font-size:8px!important;opacity:.55;background:rgba(255,255,255,.7)!important}
    .leaflet-control-zoom{display:none}
    .u-dot{
      width:12px;height:12px;
      background:#2F7B5E;border-radius:50%;
      border:2.5px solid #fff;
      box-shadow:0 0 0 5px rgba(47,123,94,.2),0 0 0 10px rgba(47,123,94,.1);
      animation:pu 2s ease-in-out infinite;
    }
    @keyframes pu{0%,100%{box-shadow:0 0 0 5px rgba(47,123,94,.2),0 0 0 10px rgba(47,123,94,.1)}
      50%{box-shadow:0 0 0 8px rgba(47,123,94,.15),0 0 0 16px rgba(47,123,94,.05)}}
    .gift-wrap{
      width:36px;height:36px;
      background:linear-gradient(135deg,#F39C12,#e08b0a);
      border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);
      display:flex;align-items:center;justify-content:center;
      box-shadow:0 3px 12px rgba(0,0,0,.3);
      cursor:pointer;
      transition:transform .15s;
    }
    .gift-inner{transform:rotate(45deg);font-size:16px;line-height:1}
  </style>
</head>
<body><div id="m"></div>
<script>
  var map=L.map('m',{zoomControl:false,attributionControl:true,tap:false})
           .setView([${latitude},${longitude}],${zoom});

  L.tileLayer('${tileUrl}',{maxZoom:19,attribution:'${tileAttr}'}).addTo(map);

  /* User location dot */
  var uIcon=L.divIcon({className:'',html:'<div class="u-dot"></div>',iconSize:[12,12],iconAnchor:[6,6]});
  L.marker([${latitude},${longitude}],{icon:uIcon,interactive:false,zIndexOffset:2000}).addTo(map);

  /* Radius circle */
  ${radiusCircle}

  /* Donation markers */
  var donors=${markerJson};
  donors.forEach(function(d){
    var ic=L.divIcon({
      className:'',
      html:'<div class="gift-wrap"><div class="gift-inner">🎁</div></div>',
      iconSize:[36,36],iconAnchor:[18,36],popupAnchor:[0,-36]
    });
    var mrk=L.marker([d.lat,d.lng],{icon:ic}).addTo(map);
    mrk.on('click',function(){
      window.ReactNativeWebView.postMessage(JSON.stringify({t:'mp',id:d.id}));
    });
  });

  /* Draggable picker */
  ${draggablePin}

  /* Fix sizing after render */
  setTimeout(function(){map.invalidateSize();},250);
</script>
</body></html>`;
  }, [latitude, longitude, zoom, satellite, radiusKm, draggable, JSON.stringify(markers)]);

  const onMessage = useCallback(
    (e) => {
      try {
        const d = JSON.parse(e.nativeEvent.data);
        if (d.t === 'mp' && onMarkerPress) onMarkerPress(d.id);
        if (d.t === 'cc' && onCoordChange) onCoordChange({ latitude: d.lat, longitude: d.lng });
      } catch (_) {}
    },
    [onMarkerPress, onCoordChange]
  );

  if (!latitude || !longitude) {
    return <View style={[{ flex: 1, backgroundColor: '#E2F0E8' }, style]} />;
  }

  return (
    <WebView
      ref={wvRef}
      source={{ html }}
      style={[{ flex: 1 }, style]}
      scrollEnabled={false}
      javaScriptEnabled
      domStorageEnabled
      originWhitelist={['*']}
      mixedContentMode="always"
      onMessage={onMessage}
      startInLoadingState={false}
    />
  );
}
