import React, { useRef, useEffect } from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';

/**
 * FreeMap Component
 * Uses OpenStreetMap (OSM) and Leaflet.js inside a WebView.
 * Requires NO API Keys and is completely free.
 */
const FreeMap = ({ 
    region, 
    onRegionChangeComplete, 
    markers = [], 
    onMarkerPress,
    style,
    showUserLocation = false,
    userLocation = null,
    polyline = null,
    circle = null,
    selectedLocation = null // For adjustment mode
}) => {
    const webViewRef = useRef(null);
    const lastRegionRef = useRef(region);

    // Initial HTML with Leaflet
    const mapHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
            <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
            <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
            <style>
                body { margin: 0; padding: 0; }
                #map { height: 100vh; width: 100vw; background: #F1F5F9; }
                
                /* Gift Marker Style */
                .gift-marker {
                    background: transparent;
                }
                .gift-marker-content {
                    width: 34px;
                    height: 34px;
                    background: #2F7B5E;
                    border-radius: 17px;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    border: 2px solid #FFF;
                    box-shadow: 0 4px 10px rgba(0,0,0,0.25);
                }
                .gift-marker-arrow {
                    width: 0;
                    height: 0;
                    border-left: 6px solid transparent;
                    border-right: 6px solid transparent;
                    border-top: 8px solid #FFF;
                    margin-left: 11px;
                    margin-top: -1px;
                }

                /* User Marker Style */
                .user-marker {
                    width: 18px !important;
                    height: 18px !important;
                    background: #3B82F6;
                    border: 3px solid #FFF;
                    border-radius: 50%;
                    box-shadow: 0 0 15px rgba(59, 130, 246, 0.6);
                }
                .user-pulse {
                    position: absolute;
                    width: 100%;
                    height: 100%;
                    border-radius: 50%;
                    background: rgba(59, 130, 246, 0.4);
                    animation: pulse 2s infinite;
                }
                @keyframes pulse {
                    0% { transform: scale(1); opacity: 0.8; }
                    100% { transform: scale(3); opacity: 0; }
                }

                /* Selected/Adjustment Marker */
                .selected-marker {
                    width: 24px !important;
                    height: 24px !important;
                    background: #EF4444;
                    border: 3px solid #FFF;
                    border-radius: 50%;
                    box-shadow: 0 4px 10px rgba(239, 68, 68, 0.4);
                }

                /* Zoom Controls Premium Skin */
                .leaflet-bar { border: none !important; box-shadow: 0 4px 12px rgba(0,0,0,0.1) !important; }
                .leaflet-bar a { background-color: #FFF !important; color: #1E293B !important; width: 40px !important; height: 40px !important; line-height: 40px !important; font-size: 20px !important; }
            </style>
        </head>
        <body>
            <div id="map"></div>
            <script>
                var map = L.map('map', {
                    zoomControl: true,
                    attributionControl: false
                }).setView([${region?.latitude || 20}, ${region?.longitude || 78}], ${region?.latitudeDelta < 0.01 ? 16 : 14});

                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    maxZoom: 19
                }).addTo(map);

                var markersList = {};
                var userMarker = null;
                var polyLineLayer = null;
                var circleLayer = null;
                var selectedMarker = null;
                var isInteracting = false;

                map.on('movestart', () => { isInteracting = true; });
                map.on('moveend', () => { 
                    isInteracting = false; 
                    const center = map.getCenter();
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'onRegionChangeComplete',
                        payload: {
                            latitude: center.lat,
                            longitude: center.lng
                        }
                    }));
                });

                window.updateRegion = function(lat, lng, force = false) {
                    if (isInteracting && !force) return;
                    map.panTo([lat, lng], { animate: true, duration: 0.5 });
                };

                window.updateMarkers = function(newMarkers) {
                    Object.values(markersList).forEach(m => map.removeLayer(m));
                    markersList = {};

                    newMarkers.forEach(m => {
                        const iconHtml = \`
                            <div class="gift-marker">
                                <div class="gift-marker-content">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                        <polyline points="20 12 20 22 4 22 4 12"></polyline>
                                        <rect x="2" y="7" width="20" height="5"></rect>
                                        <line x1="12" y1="22" x2="12" y2="7"></line>
                                        <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"></path>
                                        <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"></path>
                                    </svg>
                                </div>
                                <div class="gift-marker-arrow"></div>
                            </div>
                        \`;
                        const icon = L.divIcon({
                            className: 'custom-div-icon',
                            html: iconHtml,
                            iconSize: [34, 42],
                            iconAnchor: [17, 42]
                        });
                        const marker = L.marker([m.latitude, m.longitude], { icon: icon })
                            .addTo(map)
                            .on('click', () => {
                                window.ReactNativeWebView.postMessage(JSON.stringify({
                                    type: 'onMarkerPress',
                                    payload: m
                                }));
                            });
                        markersList[m.id || m._id] = marker;
                    });
                };

                window.updateUserLocation = function(lat, lng) {
                    if (userMarker) map.removeLayer(userMarker);
                    const userIcon = L.divIcon({
                        className: 'user-marker-container',
                        html: '<div class="user-pulse"></div><div class="user-marker"></div>',
                        iconSize: [18, 18],
                        iconAnchor: [9, 9]
                    });
                    userMarker = L.marker([lat, lng], { icon: userIcon }).addTo(map);
                };

                window.updateSelectedLocation = function(lat, lng) {
                    if (selectedMarker) map.removeLayer(selectedMarker);
                    const selIcon = L.divIcon({
                        className: 'selected-marker',
                        iconSize: [24, 24],
                        iconAnchor: [12, 12]
                    });
                    selectedMarker = L.marker([lat, lng], { icon: selIcon }).addTo(map);
                };

                window.updatePolyline = function(coords) {
                    if (polyLineLayer) map.removeLayer(polyLineLayer);
                    if (!coords || coords.length === 0) return;
                    const latlngs = coords.map(c => [c.latitude, c.longitude]);
                    polyLineLayer = L.polyline(latlngs, {color: '#3B82F6', weight: 6, opacity: 0.8, lineCap: 'round'}).addTo(map);
                };

                window.updateCircle = function(lat, lng, radius) {
                    if (circleLayer) map.removeLayer(circleLayer);
                    if (!lat || !lng) return;
                    circleLayer = L.circle([lat, lng], {
                        color: '#2F7B5E',
                        fillColor: '#2F7B5E',
                        fillOpacity: 0.1,
                        weight: 2,
                        radius: radius
                    }).addTo(map);
                };
            </script>
        </body>
        </html>
    `;

    useEffect(() => {
        if (webViewRef.current && region) {
            // Anti-jitter: only move if significant change
            const dist = lastRegionRef.current 
                ? Math.abs(lastRegionRef.current.latitude - region.latitude) + Math.abs(lastRegionRef.current.longitude - region.longitude)
                : 1;
            
            if (dist > 0.0001) {
                const script = `window.updateRegion(${region.latitude}, ${region.longitude});`;
                webViewRef.current.injectJavaScript(script);
                lastRegionRef.current = region;
            }
        }
    }, [region?.latitude, region?.longitude]);

    useEffect(() => {
        if (webViewRef.current) {
            const script = `window.updateMarkers(${JSON.stringify(markers.map(m => ({
                id: m._id || m.id,
                latitude: m.location?.coordinates ? m.location.coordinates[1] : m.latitude,
                longitude: m.location?.coordinates ? m.location.coordinates[0] : m.longitude,
                ...m
            })))});`;
            webViewRef.current.injectJavaScript(script);
        }
    }, [markers]);

    useEffect(() => {
        if (webViewRef.current && polyline) {
            const script = `window.updatePolyline(${JSON.stringify(polyline)});`;
            webViewRef.current.injectJavaScript(script);
        }
    }, [polyline]);

    useEffect(() => {
        if (webViewRef.current && circle) {
            const script = `window.updateCircle(${circle.latitude}, ${circle.longitude}, ${circle.radius});`;
            webViewRef.current.injectJavaScript(script);
        }
    }, [circle]);

    useEffect(() => {
        if (webViewRef.current && selectedLocation) {
            const script = `window.updateSelectedLocation(${selectedLocation.latitude}, ${selectedLocation.longitude});`;
            webViewRef.current.injectJavaScript(script);
        }
    }, [selectedLocation]);

    useEffect(() => {
        if (webViewRef.current && userLocation) {
            const script = `window.updateUserLocation(${userLocation.latitude}, ${userLocation.longitude});`;
            webViewRef.current.injectJavaScript(script);
        }
    }, [userLocation]);

    const handleMessage = (event) => {
        try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'onMarkerPress' && onMarkerPress) {
                onMarkerPress(data.payload);
            } else if (data.type === 'onRegionChangeComplete' && onRegionChangeComplete) {
                onRegionChangeComplete(data.payload);
            }
        } catch (e) {
            // silent catch
        }
    };

    return (
        <View style={[styles.container, style]}>
            <WebView
                ref={webViewRef}
                originWhitelist={['*']}
                source={{ html: mapHtml }}
                style={styles.webview}
                onMessage={handleMessage}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                startInLoadingState={true}
                scrollEnabled={false}
                renderLoading={() => (
                    <View style={styles.loading}>
                        <ActivityIndicator size="large" color="#2F7B5E" />
                    </View>
                )}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, overflow: 'hidden' },
    webview: { flex: 1 },
    loading: { ...StyleSheet.absoluteFillObject, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center' }
});

export default FreeMap;
