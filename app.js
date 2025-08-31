// App State
let appState = {
    isOnline: navigator.onLine,
    currentLocation: null,
    sosTimer: null,
    sosCountdown: 0,
    map: null,
    isRegistered: false,
    userData: {
        id: generateUserId(),
        phone: '',
        emergencyContact: ''
    }
};

// Initialize App
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupServiceWorker();
    setupEventListeners();
    getCurrentLocation();
    updateNetworkStatus();
    updateTime();
});

function generateUserId() {
    return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function initializeApp() {
    // Check if user data exists in localStorage equivalent (using variables for offline storage)
    if (appState.userData.phone) {
        appState.isRegistered = true;
    }
    
    // Simulate receiving disaster alerts
    setTimeout(() => {
        if (shouldShowAlert()) {
            showDisasterAlert();
        }
    }, 3000);
}

function setupServiceWorker() {
    if ('serviceWorker' in navigator) {
        // Create inline service worker for PWA functionality
        const swCode = `
            self.addEventListener('install', (e) => {
                console.log('Service Worker installed');
            });
            
            self.addEventListener('fetch', (e) => {
                // Basic offline strategy
                e.respondWith(
                    fetch(e.request).catch(() => {
                        if (e.request.destination === 'document') {
                            return caches.match('/');
                        }
                    })
                );
            });
        `;
        
        const blob = new Blob([swCode], { type: 'application/javascript' });
        const swUrl = URL.createObjectURL(blob);
        navigator.serviceWorker.register(swUrl);
    }
}

function setupEventListeners() {
    // Network status
    window.addEventListener('online', () => {
        appState.isOnline = true;
        updateNetworkStatus();
    });
    
    window.addEventListener('offline', () => {
        appState.isOnline = false;
        updateNetworkStatus();
    });

    // SOS Button
    document.getElementById('sosButton').addEventListener('click', initiateSOS);

    // Update time every second
    setInterval(updateTime, 1000);
}

function updateNetworkStatus() {
    const statusDot = document.getElementById('networkStatus');
    const statusText = document.getElementById('networkText');
    
    if (appState.isOnline) {
        statusDot.classList.remove('offline');
        statusText.textContent = 'Online';
    } else {
        statusDot.classList.add('offline');
        statusText.textContent = 'Offline';
    }
}

function updateTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    document.getElementById('currentTime').textContent = timeString;
}

function getCurrentLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                appState.currentLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    accuracy: position.coords.accuracy
                };
                updateLocationDisplay();
            },
            (error) => {
                console.error('Geolocation error:', error);
                document.getElementById('locationText').textContent = '📍 Location access denied';
                document.getElementById('coordinates').textContent = 'Enable location services for emergency features';
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
        );
    }
}

function updateLocationDisplay() {
    if (appState.currentLocation) {
        const { lat, lng } = appState.currentLocation;
        document.getElementById('locationText').textContent = '📍 Current Location';
        document.getElementById('coordinates').textContent = `Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`;
    }
}

function shouldShowAlert() {
    // Simulate API call to disaster detection service
    // In real app, this would check against real-time disaster APIs
    return Math.random() > 0.7; // 30% chance to show alert for demo
}

function showDisasterAlert() {
    const alertBanner = document.getElementById('alertBanner');
    const alertText = document.getElementById('alertText');
    const alertDetails = document.getElementById('alertDetails');
    
    // Simulate different types of disasters
    const disasters = [
        { type: 'Flood Warning', details: 'Heavy rainfall detected. Move to higher ground immediately.' },
        { type: 'Earthquake Alert', details: 'Seismic activity detected. Take cover and stay calm.' },
        { type: 'Fire Emergency', details: 'Wildfire approaching. Evacuate immediately.' },
        { type: 'Severe Weather', details: 'High winds and storms expected. Stay indoors.' }
    ];
    
    const disaster = disasters[Math.floor(Math.random() * disasters.length)];
    alertText.textContent = disaster.type;
    alertDetails.textContent = disaster.details;
    
    alertBanner.classList.add('active');
    
    // Auto-hide after 10 seconds
    setTimeout(() => {
        alertBanner.classList.remove('active');
    }, 10000);

    // Send push notification if supported
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('DisasterAlert', {
            body: disaster.details,
            icon: 'icons/icon-192x192.png'
        });
    }
}

function initiateSOS() {
    // Show confirmation modal first
    document.getElementById('sosModal').classList.add('active');
}

function confirmSOS() {
    closeModal('sosModal');
    startSOSCountdown();
}

function startSOSCountdown() {
    const sosButton = document.getElementById('sosButton');
    const sosStatus = document.getElementById('sosStatus');
    
    appState.sosCountdown = 10;
    sosButton.classList.add('countdown');
    sosButton.innerHTML = `<div class="countdown-timer">${appState.sosCountdown}</div>`;
    sosStatus.textContent = 'Tap again to cancel';
    
    // Make button pulsate
    sosButton.classList.add('pulse');
    
    appState.sosTimer = setInterval(() => {
        appState.sosCountdown--;
        sosButton.innerHTML = `<div class="countdown-timer">${appState.sosCountdown}</div>`;
        
        if (appState.sosCountdown <= 0) {
            sendSOS();
            clearInterval(appState.sosTimer);
        }
    }, 1000);

    // Allow cancellation
    sosButton.onclick = cancelSOS;
}

function cancelSOS() {
    clearInterval(appState.sosTimer);
    const sosButton = document.getElementById('sosButton');
    const sosStatus = document.getElementById('sosStatus');
    
    sosButton.classList.remove('countdown', 'pulse');
    sosButton.innerHTML = 'SOS';
    sosStatus.textContent = 'Tap for Emergency Help';
    sosButton.onclick = initiateSOS;
}

function sendSOS() {
    const sosButton = document.getElementById('sosButton');
    const sosStatus = document.getElementById('sosStatus');
    
    sosButton.classList.remove('countdown', 'pulse');
    sosButton.classList.add('sent');
    sosButton.innerHTML = '✓';
    sosStatus.textContent = 'SOS Sent! Help is on the way';
    
    // Simulate sending SOS data to Firebase and Twilio
    const sosData = {
        userId: appState.userData.id,
        location: appState.currentLocation,
        timestamp: new Date().toISOString(),
        type: 'emergency_sos'
    };
    
    // In real app, this would:
    // 1. Send to Firebase database
    // 2. Trigger Twilio SMS to emergency services
    // 3. Notify nearby registered users
    console.log('SOS Data sent:', sosData);
    
    if (appState.isOnline) {
        // Simulate API call
        simulateSOSDispatch(sosData);
    } else {
        // Store for later transmission when online
        storeOfflineSOSData(sosData);
    }
    
    // Reset after 5 seconds
    setTimeout(() => {
        sosButton.classList.remove('sent');
        sosButton.innerHTML = 'SOS';
        sosStatus.textContent = 'Tap for Emergency Help';
        sosButton.onclick = initiateSOS;
    }, 5000);
}

function simulateSOSDispatch(sosData) {
    // Simulate different emergency services being notified
    setTimeout(() => {
        showNotification('🚑 Ambulance dispatched to your location');
    }, 2000);
    
    setTimeout(() => {
        showNotification('👮 Police notified of emergency');
    }, 4000);
    
    setTimeout(() => {
        showNotification('🔥 Fire department alerted');
    }, 6000);
}

function storeOfflineSOSData(sosData) {
    // In a real app, this would store in IndexedDB
    // For now, we'll use a simple variable
    if (!window.offlineSOSQueue) {
        window.offlineSOSQueue = [];
    }
    window.offlineSOSQueue.push(sosData);
    
    showNotification('⚠️ SOS stored for transmission when online');
}

function showNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 70px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0,0,0,0.8);
        color: white;
        padding: 15px 20px;
        border-radius: 25px;
        font-size: 14px;
        z-index: 3000;
        max-width: 90%;
        text-align: center;
        backdrop-filter: blur(10px);
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        document.body.removeChild(notification);
    }, 4000);
}

function toggleMap() {
    const mapSection = document.getElementById('mapSection');
    const isVisible = mapSection.style.display !== 'none';
    
    if (isVisible) {
        mapSection.style.display = 'none';
    } else {
        mapSection.style.display = 'block';
        initializeMap();
    }
}

function initializeMap() {
    if (!appState.map && appState.currentLocation) {
        const { lat, lng } = appState.currentLocation;
        
        appState.map = L.map('map').setView([lat, lng], 13);
        
        // Use OpenStreetMap tiles (works offline with cached tiles)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(appState.map);
        
        // Add user location
        L.marker([lat, lng])
            .addTo(appState.map)
            .bindPopup('📍 Your Location')
            .openPopup();
        
        // Add emergency resources
        addEmergencyResources();
    }
}

function addEmergencyResources() {
    if (!appState.currentLocation || !appState.map) return;
    
    const { lat, lng } = appState.currentLocation;
    
    // Simulate nearby emergency resources
    const resources = [
        { type: 'hospital', lat: lat + 0.01, lng: lng + 0.01, name: 'City General Hospital', icon: '🏥' },
        { type: 'hospital', lat: lat - 0.015, lng: lng + 0.008, name: 'Emergency Medical Center', icon: '🏥' },
        { type: 'police', lat: lat + 0.005, lng: lng - 0.012, name: 'Police Station District 5', icon: '👮' },
        { type: 'police', lat: lat - 0.008, lng: lng - 0.005, name: 'Emergency Response Unit', icon: '👮' },
        { type: 'safe-zone', lat: lat + 0.018, lng: lng - 0.002, name: 'Community Shelter', icon: '🛡️' },
        { type: 'safe-zone', lat: lat - 0.01, lng: lng + 0.015, name: 'Emergency Assembly Point', icon: '🛡️' },
        { type: 'fire', lat: lat + 0.007, lng: lng + 0.018, name: 'Fire Department Station 12', icon: '🚒' },
    ];
    
    resources.forEach(resource => {
        const color = resource.type === 'hospital' ? 'green' : 
                     resource.type === 'police' ? 'blue' : 
                     resource.type === 'fire' ? 'red' : 'purple';
        
        L.circleMarker([resource.lat, resource.lng], {
            color: color,
            fillColor: color,
            fillOpacity: 0.7,
            radius: 10
        })
        .addTo(appState.map)
        .bindPopup(`${resource.icon} ${resource.name}`)
        .on('click', () => {
            calculateRoute(resource.lat, resource.lng, resource.name);
        });
    });
}

function calculateRoute(destLat, destLng, destName) {
    if (!appState.currentLocation) return;
    
    const { lat, lng } = appState.currentLocation;
    const distance = calculateDistance(lat, lng, destLat, destLng);
    const estimatedTime = Math.round((distance * 3)); // Rough estimate in minutes
    
    showNotification(`📍 ${destName} - ${distance.toFixed(1)}km away (~${estimatedTime} min)`);
    
    // In a real app, you could integrate with routing services
    // For now, we'll show a simple line
    L.polyline([[lat, lng], [destLat, destLng]], {
        color: 'red',
        weight: 3,
        opacity: 0.7,
        dashArray: '5, 10'
    }).addTo(appState.map);
}

function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Radius of the Earth in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function showResources() {
    const modal = document.getElementById('alertModal');
    const modalContent = modal.querySelector('.modal-content');
    const alertsList = document.getElementById('alertsList');
    
    modalContent.querySelector('h3').textContent = '🏥 Nearby Emergency Resources';
    alertsList.innerHTML = `
        <div style="text-align: left; margin: 15px 0;">
            <p style="margin-bottom: 10px;"><strong>🏥 Hospitals (2.1km)</strong></p>
            <p style="margin-left: 20px; font-size: 14px;">• City General Hospital</p>
            <p style="margin-left: 20px; font-size: 14px;">• Emergency Medical Center</p>
            
            <p style="margin: 15px 0 10px 0;"><strong>👮 Police Stations (1.8km)</strong></p>
            <p style="margin-left: 20px; font-size: 14px;">• District 5 Police Station</p>
            <p style="margin-left: 20px; font-size: 14px;">• Emergency Response Unit</p>
            
            <p style="margin: 15px 0 10px 0;"><strong>🛡️ Safe Zones (1.5km)</strong></p>
            <p style="margin-left: 20px; font-size: 14px;">• Community Shelter</p>
            <p style="margin-left: 20px; font-size: 14px;">• Emergency Assembly Point</p>
        </div>
    `;
    
    modal.classList.add('active');
}

function showAlerts() {
    const modal = document.getElementById('alertModal');
    const modalContent = modal.querySelector('.modal-content');
    const alertsList = document.getElementById('alertsList');
    
    modalContent.querySelector('h3').textContent = '🚨 Active Disaster Alerts';
    alertsList.innerHTML = `
        <div style="text-align: left;">
            <p style="color: #f44336; font-weight: bold;">🌊 FLOOD WARNING - High Priority</p>
            <p style="margin-left: 20px; font-size: 14px; margin-bottom: 15px;">Heavy rainfall in upstream areas. Water level rising rapidly.</p>
            
            <p style="color: #ff9800; font-weight: bold;">💨 Wind Advisory - Medium Priority</p>
            <p style="margin-left: 20px; font-size: 14px; margin-bottom: 15px;">Sustained winds 35-45 mph expected until 8 PM.</p>
            
            <p style="color: #2196f3; font-weight: bold;">⚡ Storm Watch - Low Priority</p>
            <p style="margin-left: 20px; font-size: 14px;">Thunderstorms possible in the evening hours.</p>
        </div>
    `;
    
    modal.classList.add('active');
}

function shareLocation() {
    if (!appState.currentLocation) {
        showNotification('❌ Location not available');
        return;
    }
    
    const { lat, lng } = appState.currentLocation;
    const locationUrl = `https://maps.google.com/?q=${lat},${lng}`;
    const shareText = `Emergency Location Share: ${locationUrl}`;
    
    if (navigator.share) {
        navigator.share({
            title: 'My Emergency Location',
            text: shareText,
            url: locationUrl
        }).then(() => {
            showNotification('📍 Location shared successfully');
        }).catch(() => {
            fallbackShare(shareText);
        });
    } else {
        fallbackShare(shareText);
    }
}

function fallbackShare(text) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
            showNotification('📍 Location copied to clipboard');
        });
    } else {
        showNotification('📍 Share your coordinates manually: ' + text.split(': ')[1]);
    }
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// Request notification permission on load
if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
            new Notification('DisasterAlert Ready', {
                body: 'You will now receive emergency alerts',
                icon: 'icons/icon-192x192.png'
            });
        }
    });
}

// Simulate real-time disaster monitoring
setInterval(() => {
    if (appState.isOnline && Math.random() > 0.95) { // 5% chance every 30 seconds
        showDisasterAlert();
    }
}, 30000);

// Handle offline SOS queue when coming back online
window.addEventListener('online', () => {
    if (window.offlineSOSQueue && window.offlineSOSQueue.length > 0) {
        window.offlineSOSQueue.forEach(sosData => {
            simulateSOSDispatch(sosData);
        });
        window.offlineSOSQueue = [];
        showNotification('📡 Offline SOS requests transmitted');
    }
});

// Simulate Firebase real-time listener for disaster alerts
function simulateFirebaseListener() {
    // This would normally connect to Firebase real-time database
    // and listen for disaster alerts in the user's area
    setInterval(() => {
        if (appState.currentLocation && Math.random() > 0.98) {
            const alertTypes = [
                'earthquake', 'flood', 'fire', 'storm', 'evacuation'
            ];
            const alertType = alertTypes[Math.floor(Math.random() * alertTypes.length)];
            
            // Simulate receiving push notification from Firebase
            receivePushAlert({
                type: alertType,
                severity: Math.random() > 0.7 ? 'high' : 'medium',
                message: `${alertType.charAt(0).toUpperCase() + alertType.slice(1)} alert in your area`,
                timestamp: new Date().toISOString()
            });
        }
    }, 45000); // Check every 45 seconds
}

function receivePushAlert(alert) {
    // Show visual alert
    showDisasterAlert();
    
    // Vibrate if supported
    if ('vibrate' in navigator) {
        navigator.vibrate([200, 100, 200]);
    }
    
    // Play alert sound (you could add an audio element)
    console.log('Alert received:', alert);
}

// Initialize Firebase simulation
simulateFirebaseListener();

// PWA Installation prompt
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    
    // Show install prompt after a delay
    setTimeout(() => {
        const installBanner = document.createElement('div');
        installBanner.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 20px;
            right: 20px;
            background: rgba(102, 126, 234, 0.95);
            color: white;
            padding: 15px;
            border-radius: 15px;
            text-align: center;
            z-index: 4000;
            backdrop-filter: blur(10px);
        `;
        installBanner.innerHTML = `
            <p style="margin-bottom: 10px;">Install DisasterAlert for quick emergency access</p>
            <button onclick="installApp()" style="background: white; color: #667eea; border: none; padding: 8px 16px; border-radius: 20px; font-weight: bold; margin-right: 10px;">Install</button>
            <button onclick="this.parentElement.remove()" style="background: transparent; color: white; border: 1px solid white; padding: 8px 16px; border-radius: 20px;">Later</button>
        `;
        document.body.appendChild(installBanner);
    }, 10000);
});

function installApp() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((result) => {
            if (result.outcome === 'accepted') {
                showNotification('✅ App installed successfully!');
            }
            deferredPrompt = null;
        });
    }
}

// Battery optimization for offline usage
if ('getBattery' in navigator) {
    navigator.getBattery().then(battery => {
        if (battery.level < 0.2) {
            showNotification('🔋 Low battery detected. Consider power saving mode.');
        }
        
        battery.addEventListener('levelchange', () => {
            if (battery.level < 0.1) {
                // Reduce app functionality to save battery
                clearInterval(); // Stop unnecessary timers
                showNotification('🔋 Critical battery. App in power save mode.');
            }
        });
    });
}

// Simulate Twilio SMS integration
function simulateTwilioIntegration(sosData) {
    // In real implementation, this would be handled by your backend
    const twilioMessage = {
        to: '+1234567890', // Emergency services number
        from: '+0987654321', // Your Twilio number
        body: `EMERGENCY SOS Alert! Location: ${sosData.location.lat}, ${sosData.location.lng}. Time: ${sosData.timestamp}. User ID: ${sosData.userId}`,
    };
    
    console.log('Twilio SMS would be sent:', twilioMessage);
    
    // Also notify nearby registered users
    notifyNearbyUsers(sosData);
}

function notifyNearbyUsers(sosData) {
    // Simulate finding nearby users from Firebase and sending them alerts
    const nearbyUsers = [
        { id: 'user_123', distance: 0.5 },
        { id: 'user_456', distance: 1.2 },
        { id: 'user_789', distance: 2.1 }
    ];
    
    nearbyUsers.forEach(user => {
        if (user.distance < 5) { // Within 5km
            console.log(`Notifying nearby user ${user.id} about SOS`);
            // In real app, this would send push notification to nearby users
        }
    });
}