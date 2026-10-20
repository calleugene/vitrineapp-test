import {useState} from 'react';

import {mapFeedbackConversations} from './mappers';

export function useFeedbackData({selectedFeedbackId, setSelectedFeedbackId}) {
  const [feedbackMessages, setFeedbackMessages] = useState([]);

  const applyFeedbackResult = (result) => {
    if (result.status !== 'fulfilled') return;

    const mapped = mapFeedbackConversations(result.value.items);
    setFeedbackMessages(mapped);
    if (!mapped.some((item) => item.id === selectedFeedbackId)) {
      setSelectedFeedbackId(mapped[0]?.id || '');
    }
  };

  return {feedbackMessages, applyFeedbackResult};
}

