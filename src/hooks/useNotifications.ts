import { useState, useEffect } from 'react';

// Centralized API URL - matches the pattern in api.ts
const API_URL = '/.netlify/functions';

const urlBase64ToUint8Array = (base64String: string) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

export const useNotifications = () => {
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = async () => {
    if (!('Notification' in window)) {
      setError('This browser does not support notifications');
      return false;
    }

    if (!('serviceWorker' in navigator)) {
      setError('This browser does not support service workers');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      setPermission(permission);

      if (permission === 'granted') {
        // Register service worker
        const registration = await navigator.serviceWorker.register('/sw.js');

        // Wait for service worker to be ready
        await navigator.serviceWorker.ready;

        // Subscribe to push notifications
        const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;

        if (!vapidPublicKey) {
          setError('VAPID public key not configured');
          return false;
        }

        const pushSubscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });

        setSubscription(pushSubscription);

        // Send subscription to server
        const response = await fetch(`${API_URL}/push-notifications/subscribe`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            subscription: pushSubscription.toJSON(),
            userUid: localStorage.getItem('userUid') || null,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to save subscription to server');
        }

        return true;
      } else if (permission === 'denied') {
        setError('Notification permission denied');
        return false;
      }
    } catch (err) {
      console.error('Error requesting notification permission:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }

    return false;
  };

  const unsubscribe = async () => {
    if (subscription) {
      try {
        await fetch(`${API_URL}/push-notifications/unsubscribe`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            endpoint: subscription.endpoint,
          }),
        });

        await subscription.unsubscribe();
        setSubscription(null);
      } catch (err) {
        console.error('Error unsubscribing:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    }
  };

  return {
    subscription,
    permission,
    error,
    requestPermission,
    unsubscribe,
  };
};
