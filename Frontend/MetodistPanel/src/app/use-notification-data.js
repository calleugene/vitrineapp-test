import {useState} from 'react';

import {mapNotifications} from './notification-mappers';

export function useNotificationData() {
  const [notificationItems, setNotificationItems] = useState([]);
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);

  const applyNotificationResult = (result) => {
    if (result.status !== 'fulfilled') return;

    setNotificationItems(mapNotifications(result.value.items));
    setNotificationUnreadCount(result.value.unread_count ?? result.value.unreadCount ?? 0);
  };

  return {notificationItems, notificationUnreadCount, applyNotificationResult};
}

