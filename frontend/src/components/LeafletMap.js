import React, { useMemo, useRef, useCallback } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

/**
 * Free map component using WebView + Leaflet.js.
 * No Google Maps API key required. Works in both Expo Go and standalone APK.
 *
 * Props:
 *  latitude, longitude - center coords (required)
 *  zoom               - initial zoom (default 13)
 *  markers            - array of donation objects {_id, location.coordinates[lng,lat], title, donor}
 *  radiusKm           - draw radius circle in km (0 = disabled)
 *  draggable          - if true, show draggable green pin for location picking
 *  satellite          - if true, show satellite imagery instead of street map
 *  onMarkerPress      - (id: string) => void
 *  onCoordChange      - ({latitude, longitude}) => void  — pin moved/tapped
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
    if (!latitude || !longitude) return '<html><body style="background:#e8f0ec;"></body></html>';

    // Tiles — Voyager for street, ESRI for satellite
    const tileUrl = satellite
      ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
      : 'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png';
    const tileAttr = satellite ? '&copy; ESRI' : '&copy; CARTO';

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
            title: String(m.title || '').replace(/\\/g, '').replace(/"/g, "'"),
            donor: String(m.donor?.fullName || 'Unknown').replace(/\\/g, '').replace(/"/g, "'"),
          };
        })
        .filter(Boolean)
    );

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta http-equiv="Content-Security-Policy"
    content="default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; img-src * data: blob:; connect-src *;">
  <meta name="viewport"
    content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet"
    href="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.min.css">
  <script src="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.min.js"></script>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body { width:100%; height:100%; overflow:hidden; background:#e8efeb; }
    #map { width:100vw; height:100vh; }
    .leaflet-control-zoom {
      border: none !important;
      box-shadow: 0 2px 10px rgba(0,0,0,0.18) !important;
      border-radius: 10px !important;
      overflow: hidden;
    }
    .leaflet-control-zoom a {
      width: 36px !important;
      height: 36px !important;
      line-height: 36px !important;
      font-size: 18px !important;
      font-weight: 700 !important;
      color: #2F7B5E !important;
      background: white !important;
    }
    .leaflet-control-zoom a:hover { background: #f0faf5 !important; }
    .leaflet-control-attribution {
      font-size:8px !important; opacity:0.6;
      background:rgba(255,255,255,0.75) !important;
    }
    /* User location — red drop-pin with pulse ring */
    .user-pin-wrap {
      position: relative;
      width: 20px;
      height: 20px;
    }
    .user-pin-ring {
      position: absolute;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      width: 42px; height: 42px;
      border-radius: 50%;
      background: rgba(220,38,38,0.15);
      animation: ring-pulse 2s ease-out infinite;
    }
    .user-pin-dot {
      position: absolute;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      width: 16px; height: 16px;
      background: #DC2626;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 2px 8px rgba(220,38,38,0.6);
      z-index: 2;
    }
    @keyframes ring-pulse {
      0%   { transform: translate(-50%,-50%) scale(0.6); opacity: 1; }
      100% { transform: translate(-50%,-50%) scale(2.0); opacity: 0; }
    }
    /* Gift marker */
    .gift-pin {
      width:36px; height:42px; position:relative;
    }
    .gift-bubble {
      width:36px; height:36px;
      background:linear-gradient(135deg,#F39C12,#d4880a);
      border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);
      display:flex; align-items:center; justify-content:center;
      box-shadow:0 4px 12px rgba(0,0,0,0.3);
      cursor:pointer;
    }
    .gift-emoji { transform:rotate(45deg); font-size:16px; line-height:1; }
    /* Draggable pin */
    .drag-pin {
      width:32px; height:38px; position:relative; cursor:grab;
    }
    .drag-bubble {
      width:32px; height:32px;
      background:linear-gradient(135deg,#2F7B5E,#1d5c46);
      border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);
      display:flex; align-items:center; justify-content:center;
      box-shadow:0 4px 12px rgba(0,0,0,0.3);
    }
    .drag-emoji { transform:rotate(45deg); font-size:15px; }
    /* Selected popup */
    .leaflet-popup-content-wrapper {
      border-radius:12px !important;
      box-shadow:0 8px 24px rgba(0,0,0,0.2) !important;
    }
    .leaflet-popup-content { margin:10px 14px !important; font-size:13px; }
  </style>
</head>
<body>
<div id="map"></div>
<script>
(function() {
  'use strict';

  var lat = ${latitude};
  var lng = ${longitude};
  var z   = ${zoom};

  var map = L.map('map', {
    zoomControl: true,
    attributionControl: true,
    tap: true,
    touchZoom: true,
    scrollWheelZoom: true,
    doubleClickZoom: true,
    fadeAnimation: true,
    zoomAnimation: true
  }).setView([lat, lng], z);

  /* ── Tile layer ── */
  L.tileLayer('${tileUrl}', {
    maxZoom: 19,
    subdomains: ['a','b','c'],
    attribution: '${tileAttr}',
    crossOrigin: true
  }).addTo(map);

  /* ── User location — bold red pin with pulsing ring ── */
  var uIcon = L.divIcon({
    className: '',
    html: '<div class="user-pin-wrap"><div class="user-pin-ring"></div><div class="user-pin-dot"></div></div>',
    iconSize: [42, 42],
    iconAnchor: [21, 21]
  });
  L.marker([lat, lng], { icon: uIcon, interactive: false, zIndexOffset: 2000 }).addTo(map);

  /* ── Radius circle ── */
  ${radiusKm > 0 ? `
  L.circle([lat, lng], {
    radius: ${radiusKm * 1000},
    color: '#2F7B5E', fillColor: '#2F7B5E',
    fillOpacity: 0.07, weight: 1.5
  }).addTo(map);` : ''}

  /* ── Donation markers ── */
  var donors = ${markerJson};
  donors.forEach(function(d) {
    if (isNaN(d.lat) || isNaN(d.lng)) return;
    var icon = L.divIcon({
      className: '',
      html: '<div class="gift-pin"><div class="gift-bubble"><span class="gift-emoji">🎁</span></div></div>',
      iconSize: [36,42],
      iconAnchor: [18,42],
      popupAnchor: [0,-44]
    });
    var mrk = L.marker([d.lat, d.lng], { icon: icon }).addTo(map);
    mrk.bindPopup('<b>' + d.title + '</b><br><small>' + d.donor + '</small>');
    mrk.on('click', function() {
      window.ReactNativeWebView.postMessage(JSON.stringify({ t: 'mp', id: d.id }));
    });
  });

  /* ── Draggable picker ── */
  ${draggable ? `
  var pIcon = L.divIcon({
    className: '',
    html: '<div class="drag-pin"><div class="drag-bubble"><span class="drag-emoji">📍</span></div></div>',
    iconSize: [32,38],
    iconAnchor: [16,38]
  });
  var pp = L.marker([lat, lng], { icon: pIcon, draggable: true }).addTo(map);

  function emit(lt, ln) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ t: 'cc', lat: lt, lng: ln }));
  }
  pp.on('dragend', function(e) {
    var p = e.target.getLatLng();
    emit(p.lat, p.lng);
  });
  map.on('click', function(e) {
    pp.setLatLng(e.latlng);
    emit(e.latlng.lat, e.latlng.lng);
  });
  ` : ''}

  /* ── Fix sizing after WebView renders ── */
  function invalidate() { map.invalidateSize(true); }
  window.addEventListener('load', invalidate);
  setTimeout(invalidate, 300);
  setTimeout(invalidate, 800);
  setTimeout(invalidate, 1500);
})();
</script>
</body>
</html>`;
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    return <View style={[styles.placeholder, style]} />;
  }

  return (
    <WebView
      ref={wvRef}
      key={`${latitude},${longitude},${zoom},${satellite},${radiusKm},${draggable}`}
      source={{ html, baseUrl: 'https://localhost' }}
      style={[{ flex: 1 }, style]}

      // JavaScript & storage
      javaScriptEnabled
      domStorageEnabled

      // Allow all origins (needed for CDN tile requests)
      originWhitelist={['*']}
      allowsInlineMediaPlayback={false}
      allowUniversalAccessFromFileURLs
      allowFileAccess

      // Android-specific
      mixedContentMode="always"
      androidLayerType="hardware"
      cacheEnabled={false}
      incognito={false}

      // Message bridge
      onMessage={onMessage}

      // Show loading state while Leaflet initialises
      renderLoading={() => (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#2F7B5E" />
        </View>
      )}
      startInLoadingState
    />
  );
}

const styles = StyleSheet.create({
  placeholder: {
    flex: 1,
    backgroundColor: '#E2F0E8',
  },
  loader: {
    position: 'absolute',
    inset: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E2F0E8',
  },
});
