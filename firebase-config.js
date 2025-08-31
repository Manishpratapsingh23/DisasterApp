// Firebase Configuration and Integration
// Replace with your actual Firebase config

const firebaseConfig = {
  apiKey: "your-api-key-here",
  authDomain: "your-project.firebaseapp.com",
  databaseURL: "https://your-project-default-rtdb.firebaseio.com/",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "your-app-id"
};

// Initialize Firebase
let firebase;
let database;
let messaging;

async function initializeFirebase() {
  try {
    // Import Firebase SDK
    if (typeof window !== 'undefined') {
      // For web environments
      const firebaseApp = await import('https://www.gstatic.com/firebasejs/9.0.0/firebase-app.js');
      const firebaseDatabase = await import('https://www.gstatic.com/firebasejs/9.0.0/firebase-database.js');
      const firebaseMessaging = await import('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging.js');
      
      firebase = firebaseApp.initializeApp(firebaseConfig);
      database = firebaseDatabase.getDatabase(firebase);
      messaging = firebaseMessaging.getMessaging(firebase);
    }
    
    console.log('Firebase initialized successfully');
    setupFirebaseListeners();
  } catch (error) {
    console.error('Firebase initialization failed:', error);
    // Fall back to simulation mode
    useSimulationMode();
  }
}

// Firebase Database Functions
class FirebaseManager {
  constructor() {
    this.isConnected = false;
    this.userRef = null;
    this.alertsRef = null;
  }

  async registerUser(userData) {
    try {
      if (!database) throw new Error('Firebase not initialized');
      
      const usersRef = firebase.database().ref('users');
      const userRef = usersRef.child(userData.id);
      
      await userRef.set({
        id: userData.id,
        phone: userData.phone,
        emergencyContact: userData.emergencyContact,
        location: userData.location,
        registeredAt: new Date().toISOString(),
        isActive: true
      });
      
      this.userRef = userRef;
      console.log('User registered in Firebase:', userData.id);
      return true;
    } catch (error) {
      console.error('Failed to register user:', error);
      return false;
    }
  }

  async updateUserLocation(userId, location) {
    try {
      if (!database) throw new Error('Firebase not initialized');
      
      const locationRef = firebase.database().ref(`users/${userId}/location`);
      await locationRef.set({
        lat: location.lat,
        lng: location.lng,
        accuracy: location.accuracy,
        timestamp: new Date().toISOString()
      });
      
      console.log('Location updated for user:', userId);
      return true;
    } catch (error) {
      console.error('Failed to update location:', error);
      return false;
    }
  }

  async sendSOSRequest(sosData) {
    try {
      if (!database) throw new Error('Firebase not initialized');
      
      const emergencyRef = firebase.database().ref('emergency-requests');
      const newRequestRef = emergencyRef.push();
      
      await newRequestRef.set({
        ...sosData,
        id: newRequestRef.key,
        status: 'active',
        createdAt: new Date().toISOString()
      });
      
      // Notify nearby users
      this.notifyNearbyUsers(sosData);
      
      // Trigger Twilio SMS via Cloud Function
      this.triggerEmergencyNotification(sosData);
      
      console.log('SOS request sent to Firebase:', newRequestRef.key);
      return newRequestRef.key;
    } catch (error) {
      console.error('Failed to send SOS request:', error);
      throw error;
    }
  }

  async triggerEmergencyNotification(sosData) {
    try {
      // Call Firebase Cloud Function that handles Twilio SMS
      const response = await fetch('/api/send-emergency-sms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          location: sosData.location,
          userId: sosData.userId,
          timestamp: sosData.timestamp,
          emergency: true
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to trigger emergency notification');
      }
      
      console.log('Emergency notification triggered');
    } catch (error) {
      console.error('Emergency notification failed:', error);
    }
  }

  async notifyNearbyUsers(sosData) {
    try {
      const usersRef = firebase.database().ref('users');
      const snapshot = await usersRef.once('value');
      const users = snapshot.val();
      
      if (!users) return;
      
      const nearbyUsers = [];
      const { lat, lng } = sosData.location;
      
      Object.values(users).forEach(user => {
        if (user.id === sosData.userId || !user.location) return;
        
        const distance = this.calculateDistance(
          lat, lng,
      Object.values(users).forEach(user => {
        if (user.id === sosData.userId || !user.location) return;
        
        const distance = this.calculateDistance(
          lat, lng,
          user.location.lat, user.location.lng
        );
        
        if (distance <= 5) { // Within 5km
          nearbyUsers.push({
            ...user,
            distance: distance
          });
        }
      });
      
      // Send push notifications to nearby users
      const notificationPromises = nearbyUsers.map(user => 
        this.sendPushNotification(user.id, {
          title: 'Emergency SOS Alert',
          body: `Emergency request ${distance.toFixed(1)}km from your location`,
          data: {
            type: 'sos',
            location: sosData.location,
            distance: user.distance
          }
        })
      );
      
      await Promise.all(notificationPromises);
      console.log(`Notified ${nearbyUsers.length} nearby users`);
    } catch (error) {
      console.error('Failed to notify nearby users:', error);
    }
  }

  async sendPushNotification(userId, notification) {
    try {
      const userTokenRef = firebase.database().ref(`users/${userId}/fcmToken`);
      const tokenSnapshot = await userTokenRef.once('value');
      const token = tokenSnapshot.val();
      
      if (!token) return;
      
      // Send via Firebase Cloud Messaging
      await messaging.send({
        token: token,
        notification: {
          title: notification.title,
          body: notification.body
        },
        data: notification.data,
        android: {
          priority: 'high',
          notification: {
            sound: 'emergency_alert'
          }
        },
        apns: {
          payload: {
            aps: {
              sound: 'emergency_alert.caf',
              badge: 1
            }
          }
        }
      });
    } catch (error) {
      console.error('Failed to send push notification:', error);
    }
  }

  setupDisasterAlertsListener(callback) {
    try {
      if (!database) throw new Error('Firebase not initialized');
      
      this.alertsRef = firebase.database().ref('disaster-alerts');
      this.alertsRef.on('child_added', (snapshot) => {
        const alert = snapshot.val();
        if (this.isAlertRelevant(alert)) {
          callback(alert);
        }
      });
      
      console.log('Disaster alerts listener setup complete');
    } catch (error) {
      console.error('Failed to setup alerts listener:', error);
    }
  }

  isAlertRelevant(alert) {
    if (!appState.currentLocation) return false;
    
    const distance = this.calculateDistance(
      appState.currentLocation.lat,
      appState.currentLocation.lng,
      alert.location.lat,
      alert.location.lng
    );
    
    // Show alerts within 50km radius
    return distance <= 50;
  }

  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Radius of Earth in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  async getEmergencyResources(location, radius = 10) {
    try {
      if (!database) throw new Error('Firebase not initialized');
      
      const resourcesRef = firebase.database().ref('emergency-resources');
      const snapshot = await resourcesRef.once('value');
      const resources = snapshot.val();
      
      if (!resources) return [];
      
      return Object.values(resources).filter(resource => {
        const distance = this.calculateDistance(
          location.lat, location.lng,
          resource.location.lat, resource.location.lng
        );
        return distance <= radius;
      }).sort((a, b) => {
        const distanceA = this.calculateDistance(location.lat, location.lng, a.location.lat, a.location.lng);
        const distanceB = this.calculateDistance(location.lat, location.lng, b.location.lat, b.location.lng);
        return distanceA - distanceB;
      });
    } catch (error) {
      console.error('Failed to get emergency resources:', error);
      return [];
    }
  }

  disconnect() {
    if (this.alertsRef) {
      this.alertsRef.off();
    }
    if (this.userRef) {
      this.userRef.off();
    }
  }
}

// Firebase Cloud Messaging Setup
async function setupFirebaseMessaging() {
  try {
    if (!messaging) return;
    
    // Request permission for notifications
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('Notification permission denied');
      return;
    }
    
    // Get FCM token
    const token = await messaging.getToken({
      vapidKey: 'your-vapid-key-here' // Replace with your VAPID key
    });
    
    console.log('FCM Token:', token);
    
    // Save token to Firebase for this user
    if (appState.userData.id) {
      const tokenRef = firebase.database().ref(`users/${appState.userData.id}/fcmToken`);
      await tokenRef.set(token);
    }
    
    // Handle foreground messages
    messaging.onMessage((payload) => {
      console.log('Foreground message received:', payload);
      
      // Show notification manually since it won't show automatically in foreground
      const { title, body } = payload.notification;
      showNotification(`${title}: ${body}`);
      
      // Handle different message types
      if (payload.data?.type === 'disaster-alert') {
        showDisasterAlert();
      } else if (payload.data?.type === 'sos') {
        handleSOSAlert(payload.data);
      }
    });
    
  } catch (error) {
    console.error('FCM setup failed:', error);
  }
}

function handleSOSAlert(data) {
  const alertBanner = document.getElementById('alertBanner');
  const alertText = document.getElementById('alertText');
  const alertDetails = document.getElementById('alertDetails');
  
  alertText.textContent = 'SOS Alert Nearby';
  alertDetails.textContent = `Emergency request ${data.distance}km from your location. Consider offering help if safe.`;
  
  alertBanner.classList.add('active');
  
  // Vibrate for SOS alerts
  if ('vibrate' in navigator) {
    navigator.vibrate([200, 100, 200, 100, 200]);
  }
}

// Twilio Integration (Backend Cloud Function)
// This would be implemented as a Firebase Cloud Function
const twilioCloudFunction = `
// functions/index.js
const functions = require('firebase-functions');
const twilio = require('twilio');

const accountSid = 'your-twilio-account-sid';
const authToken = 'your-twilio-auth-token';
const client = twilio(accountSid, authToken);

exports.sendEmergencySMS = functions.https.onRequest(async (req, res) => {
  try {
    const { location, userId, timestamp } = req.body;
    
    // Emergency services numbers
    const emergencyNumbers = [
      '+1234567890', // Local Emergency Services
      '+1234567891', // Police Department
      '+1234567892', // Fire Department
      '+1234567893'  // Medical Emergency
    ];
    
    const message = \`EMERGENCY SOS ALERT!
Location: \${location.lat}, \${location.lng}
Google Maps: https://maps.google.com/?q=\${location.lat},\${location.lng}
User ID: \${userId}
Time: \${timestamp}
Accuracy: \${location.accuracy}m

This is an automated emergency alert from DisasterAlert App.\`;

    // Send SMS to all emergency numbers
    const promises = emergencyNumbers.map(number => 
      client.messages.create({
        body: message,
        from: '+1234567899', // Your Twilio phone number
        to: number
      })
    );
    
    await Promise.all(promises);
    
    // Also log to Firebase for tracking
    const admin = require('firebase-admin');
    await admin.database().ref('emergency-logs').push({
      userId,
      location,
      timestamp,
      smsSent: true,
      recipientCount: emergencyNumbers.length
    });
    
    res.json({ success: true, messagesSent: emergencyNumbers.length });
  } catch (error) {
    console.error('Emergency SMS failed:', error);
    res.status(500).json({ error: error.message });
  }
});

exports.processDisasterAlerts = functions.pubsub
  .schedule('every 5 minutes')
  .onRun(async (context) => {
    // Check external disaster APIs and update Firebase
    const disasterSources = [
      'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_hour.geojson',
      'https://api.weather.gov/alerts/active'
      // Add more disaster monitoring APIs
    ];
    
    for (const source of disasterSources) {
      try {
        const response = await fetch(source);
        const data = await response.json();
        
        // Process and store relevant alerts
        await processDisasterData(data, source);
      } catch (error) {
        console.error('Failed to fetch from:', source, error);
      }
    }
  });
`;

// Simulation mode for development/testing
function useSimulationMode() {
  console.log('Running in simulation mode - Firebase unavailable');
  
  window.firebaseManager = {
    registerUser: (userData) => {
      console.log('SIMULATION: User registered', userData);
      return Promise.resolve(true);
    },
    updateUserLocation: (userId, location) => {
      console.log('SIMULATION: Location updated', userId, location);
      return Promise.resolve(true);
    },
    sendSOSRequest: (sosData) => {
      console.log('SIMULATION: SOS request sent', sosData);
      setTimeout(() => {
        simulateSOSDispatch(sosData);
      }, 1000);
      return Promise.resolve('sim_' + Date.now());
    },
    setupDisasterAlertsListener: (callback) => {
      console.log('SIMULATION: Alerts listener setup');
      // Simulate periodic alerts
      setInterval(() => {
        if (Math.random() > 0.95) {
          callback({
            type: 'flood',
            severity: 'medium',
            message: 'Flood warning in your area',
            location: appState.currentLocation
          });
        }
      }, 30000);
    },
    getEmergencyResources: (location) => {
      console.log('SIMULATION: Getting emergency resources');
      return Promise.resolve([
        { name: 'City Hospital', type: 'hospital', location: { lat: location.lat + 0.01, lng: location.lng + 0.01 }},
        { name: 'Police Station', type: 'police', location: { lat: location.lat - 0.01, lng: location.lng - 0.01 }}
      ]);
    }
  };
}

// Setup Firebase listeners
function setupFirebaseListeners() {
  if (!window.firebaseManager) return;
  
  // Listen for disaster alerts
  window.firebaseManager.setupDisasterAlertsListener((alert) => {
    console.log('Disaster alert received:', alert);
    showDisasterAlert();
  });
}

// Initialize Firebase when script loads
if (typeof window !== 'undefined') {
  initializeFirebase().then(() => {
    window.firebaseManager = new FirebaseManager();
    setupFirebaseMessaging();
  });
}