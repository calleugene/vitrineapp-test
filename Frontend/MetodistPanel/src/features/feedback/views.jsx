import React, {useState} from 'react';
import {feedbackApi} from '../../api';
import {mapFeedbackConversations} from './mappers';
import {Button, Card, Label, Select, TextArea} from '@gravity-ui/uikit';
import {ArrowUpRightFromSquare, Camera, EllipsisVertical, Envelope} from '@gravity-ui/icons';
import {FEEDBACK_TABS} from './demo-data';
import {Field} from '../../components/ui';

export function FeedbackView({feedbackTab, setFeedbackTab, selectedFeedbackId, setSelectedFeedbackId, feedbackMessages}) {
  const [savedMessages, setSavedMessages] = useState({});
  const [drafts, setDrafts] = useState({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const originalMessage = feedbackMessages.find((item) => item.id === selectedFeedbackId) || feedbackMessages[0];
  const selectedMessage = savedMessages[originalMessage?.id] || originalMessage;
  const saveResponse = (response) => {const [item] = mapFeedbackConversations([response.feedback]);setSavedMessages((previous) => ({...previous,[item.id]:item}));};
  const submitReply = async () => {
    if (pending || !selectedMessage) return;
    setPending(true);setError('');
    try {saveResponse(await feedbackApi.reply(selectedMessage.id, drafts[selectedMessage.id] || '', 'published', selectedMessage.version));setDrafts((previous) => ({...previous,[selectedMessage.id]:''}));}
    catch {setError('Не удалось сохранить ответ. Повторите попытку.');}
    finally {setPending(false);}
  };
  const moderate = async (status) => {
    if (pending || !selectedMessage) return;
    setPending(true);setError('');
    try {saveResponse(await feedbackApi.moderate(selectedMessage.id,status,selectedMessage.version));}
    catch {setError('Не удалось изменить статус сообщения.');}
    finally {setPending(false);}
  };
  const filteredMessages = feedbackMessages.filter((item) => {
    if (feedbackTab === 'all') return true;
    if (feedbackTab === 'reviews') return item.type === 'Отзыв';
    if (feedbackTab === 'questions') return item.type === 'Вопрос';
    if (feedbackTab === 'suggestions') return item.type === 'Предложение';
    return true;
  });

  if (!selectedMessage) return <section className="page"><h1>Обратная связь</h1><p role="status">Сообщений пока нет. Здесь появятся отзывы, вопросы и предложения посетителей.</p></section>;

  return (
    <section className="page">
      <div className="page-heading">
        <div>
          <h1>Обратная связь</h1>
        </div>
      </div>

      <div className="profile-tabs stats-tabs">
        {FEEDBACK_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`profile-tab ${feedbackTab === tab.id ? 'is-active' : ''}`}
            onClick={() => setFeedbackTab(tab.id)}
          >
            {tab.title}
          </button>
        ))}
      </div>

      <div className="feedback-layout">
        <Card className="panel feedback-sidebar-panel" view="filled">
          <div className="feedback-filter-row">
            <Select size="l" value={['all']} options={[{value: 'all', content: 'Все типы'}]} />
            <Button view="outlined" size="l" aria-label="Дополнительные действия">
              <EllipsisVertical />
            </Button>
          </div>
          <div className="feedback-total">{filteredMessages.length} сообщения</div>
          <div className="feedback-conversation-list">
            {filteredMessages.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`feedback-thread-card ${selectedMessage.id === item.id ? 'is-active' : ''}`}
                onClick={() => setSelectedFeedbackId(item.id)}
              >
                <div className={`feedback-thread-avatar tone-${item.accent}`}>{item.initial}</div>
                <div className="feedback-thread-copy">
                  <div className="feedback-thread-top">
                    <strong>{item.author}</strong>
                    <Label theme={item.typeTheme} size="xs">{item.type}</Label>
                  </div>
                  <span>{item.museum}</span>
                  <p>{item.preview}</p>
                  <small>{item.time}</small>
                </div>
              </button>
            ))}
          </div>
          <Button view="flat" size="l" width="max">Показать ещё</Button>
        </Card>

        <Card className="panel feedback-detail-panel" view="filled">
          <div className="feedback-detail-head">
            <div className="feedback-detail-author">
              <div className={`feedback-thread-avatar tone-${selectedMessage.accent}`}>{selectedMessage.initial}</div>
              <div>
                <strong>{selectedMessage.author}</strong>
                <span>{selectedMessage.museum}</span>
                <small>{selectedMessage.time}</small>
              </div>
            </div>
            <div className="feedback-detail-actions">
              <Label theme={selectedMessage.typeTheme}>{selectedMessage.type}</Label>
              <Button view="outlined" size="m">
                <ArrowUpRightFromSquare />
                Открыть
              </Button>
              <Button view="outlined" size="m">
                <Envelope />
                Ответить
              </Button>
              <Button view="outlined" size="m" aria-label="Дополнительные действия">
                <EllipsisVertical />
              </Button>
            </div>
          </div>

          <div className="feedback-detail-body">
            <h3>{selectedMessage.title}</h3>
            <p>{selectedMessage.body}</p>
            {error ? <p role="alert">{error}</p> : null}
            {selectedMessage.type === 'Отзыв' ? <div><p>Статус модерации: {selectedMessage.moderationStatus}</p><Button disabled={pending || selectedMessage.moderationStatus === 'published'} onClick={() => moderate('published')}>Опубликовать отзыв</Button><Button disabled={pending || selectedMessage.moderationStatus === 'rejected'} onClick={() => moderate('rejected')}>Скрыть отзыв</Button></div> : null}
          </div>

          <div className="feedback-meta-grid">
            <div className="feedback-meta-item"><span>Тип</span><strong><Label theme={selectedMessage.typeTheme} size="xs">{selectedMessage.type}</Label></strong></div>
            <div className="feedback-meta-item"><span>Раздел</span><strong>{selectedMessage.section}</strong></div>
            <div className="feedback-meta-item"><span>Источник</span><strong>{selectedMessage.source}</strong></div>
            <div className="feedback-meta-item"><span>Маршрут</span><strong>{selectedMessage.route}</strong></div>
            <div className="feedback-meta-item"><span>Устройство</span><strong>{selectedMessage.device}</strong></div>
            <div className="feedback-meta-item">
              <span>Оценка</span>
              <strong>{selectedMessage.rating ? '★'.repeat(selectedMessage.rating) + '☆'.repeat(5 - selectedMessage.rating) : '—'}</strong>
            </div>
          </div>

          <div className="feedback-reply-section">
            <div className="panel-header">
              <div className="feedback-reply-title">
                <h3>Ответ музея</h3>
                <Label theme={selectedMessage.replyStatus === 'Опубликован' ? 'success' : 'utility'} size="xs">
                  {selectedMessage.replyStatus}
                </Label>
              </div>
              <Button view="outlined" size="m" onClick={() => setDrafts((previous) => ({...previous,[selectedMessage.id]:selectedMessage.reply || ''}))}>Редактировать ответ</Button>
            </div>

            <div className="feedback-reply-card">
              {selectedMessage.reply ? (
                <>
                  <p>{selectedMessage.reply}</p>
                  <strong>{selectedMessage.replyAuthor}</strong>
                  <small>{selectedMessage.replyTime}</small>
                </>
              ) : (
                <p>Ответ музея пока не опубликован.</p>
              )}
            </div>

            <Field label="Быстрый ответ">
              <div className="feedback-compose-box">
                <TextArea size="xl" rows={4} placeholder="Напишите ответ пользователю..." value={drafts[selectedMessage.id] || ''} onUpdate={(value) => setDrafts((previous) => ({...previous,[selectedMessage.id]:value}))} />
                <div className="feedback-compose-actions">
                  <div className="feedback-compose-icons">
                    <button type="button" className="feedback-inline-action">
                      <Envelope />
                      Шаблон
                    </button>
                    <button type="button" className="feedback-inline-action">
                      <Camera />
                      Медиа
                    </button>
                  </div>
                  <Button view="action" size="l" loading={pending} disabled={pending || !drafts[selectedMessage.id]?.trim()} onClick={submitReply}>Отправить ответ</Button>
                </div>
              </div>
            </Field>
          </div>
        </Card>
      </div>
    </section>
  );
}
