import { useState } from 'react';
import {
  AlignLeft,
  Image as ImageIcon,
  Headphones,
  Video,
  Box,
  Images,
  CircleHelp,
  Route,
  ChevronRight,
  Check,
  Plus,
  GripVertical,
  Eye,
  ArrowUpRight,
  Volume2,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export const photo = (name: string) =>
  `${import.meta.env.BASE_URL}images/${name}.webp`;
const blocks = [
  { name: 'Текст', icon: AlignLeft },
  { name: 'Изображение', icon: ImageIcon },
  { name: 'Аудио', icon: Headphones },
  { name: 'Видео', icon: Video },
  { name: '3D / AR', icon: Box },
  { name: 'Галерея', icon: Images },
  { name: 'Квиз', icon: CircleHelp },
  { name: 'Маршрут', icon: Route },
];

function Quiz() {
  const [answer, setAnswer] = useState('');
  return (
    <div className="quiz-demo">
      <p>Посмотрите на картину. Что создает ощущение глубины?</p>
      <div>
        {['Изгиб реки', 'Размер рамы', 'Подпись художника'].map((option) => (
          <button
            key={option}
            aria-pressed={answer === option}
            onClick={() => setAnswer(option)}
          >
            {option}
            {answer === option && <Check size={14} />}
          </button>
        ))}
      </div>
      <p className="quiz-feedback" aria-live="polite">
        {answer &&
          (answer === 'Изгиб реки'
            ? 'Верно! Река ведет взгляд от переднего плана к горизонту.'
            : 'Посмотрите, как река уходит к горизонту. Попробуйте еще раз.')}
      </p>
    </div>
  );
}
function AudioExample() {
  const [transcript, setTranscript] = useState(false);
  return (
    <div className="audio-demo">
      <div className="audio-heading">
        <Volume2 size={24} />
        <div>
          <strong>Услышать пейзаж</strong>
          <span>Пример аудиоблока</span>
        </div>
      </div>
      <p>
        Добавьте рассказ куратора или звуки, которые помогают почувствовать
        атмосферу произведения.
      </p>
      <button
        className="text-link"
        onClick={() => setTranscript(!transcript)}
        aria-expanded={transcript}
      >
        {transcript ? 'Скрыть расшифровку' : 'Читать расшифровку'}
        <ChevronRight size={14} />
      </button>
      {transcript && (
        <p className="transcript">
          «Представьте тихий берег. Ветер едва касается деревьев, а река
          отражает вечерний свет…»
        </p>
      )}
    </div>
  );
}
export function ProductMockup({ onPreview }: { onPreview: () => void }) {
  const [active, setActive] = useState('Изображение');
  return (
    <div className="product-mockup">
      <div className="editor-topbar">
        <span className="editor-logo">
          В<span>•</span>
        </span>
        <div className="editor-breadcrumb">
          Мой музей
          <ChevronRight size={12} />
          Экспонаты
          <ChevronRight size={12} />
          <strong>Пейзаж с рекой</strong>
        </div>
        <span className="editor-status">Демонстрация</span>
        <button className="editor-preview" onClick={onPreview}>
          <Eye size={14} />
          <span>Предпросмотр</span>
        </button>
      </div>
      <Tabs
        className="editor-layout"
        orientation="vertical"
        value={active}
        onValueChange={(value) => setActive(String(value))}
      >
        <aside className="editor-sidebar">
          <p>ДОБАВИТЬ БЛОК</p>
          <TabsList className="editor-tabs" aria-label="Тип контента">
            {blocks.map(({ name, icon: Icon }) => (
              <TabsTrigger key={name} className="editor-tab" value={name}>
                <Icon size={17} />
                <span>{name}</span>
                <Plus size={12} />
              </TabsTrigger>
            ))}
          </TabsList>
          <div className="editor-sidebar-note">
            <LayersMark />
            <span>
              Ваша история.
              <br />
              Ваши правила.
            </span>
          </div>
        </aside>
        <div className="editor-workspace">
          <div className="workspace-caption">
            <span>ИСТОРИЯ ЭКСПОНАТА</span>
            <span>01</span>
          </div>
          <div className="editor-canvas">
            <div className="canvas-eyebrow">ЖИВОПИСЬ · УЧЕБНЫЙ ПРИМЕР</div>
            <h3>Пейзаж с рекой</h3>
            <p className="canvas-intro">
              История одного мгновения, которое осталось с нами навсегда.
            </p>
            {blocks.map(({ name }) => (
              <TabsContent key={name} value={name} className="block-preview">
                {name === 'Изображение' && (
                  <div className="selected-image">
                    <img
                      src={photo('editor-landscape')}
                      alt="Репродукция пейзажа с рекой, деревьями и мягким вечерним светом"
                      width={1536}
                      height={1024}
                      loading="lazy"
                    />
                    <span className="selected-label">
                      <ImageIcon size={12} />
                      Изображение
                    </span>
                    <span className="selection-handle tl" />
                    <span className="selection-handle tr" />
                    <span className="selection-handle bl" />
                    <span className="selection-handle br" />
                  </div>
                )}
                {name === 'Текст' && (
                  <div className="text-demo">
                    <div className="text-toolbar">
                      <strong>B</strong>
                      <em>I</em>
                      <AlignLeft size={14} />
                      <span>Основной текст</span>
                    </div>
                    <p>
                      Река становится главным героем этой картины. Ее спокойное
                      течение соединяет ближний берег с далеким горизонтом.
                    </p>
                    <p>
                      Обратите внимание на свет: теплые оттенки неба отражаются
                      в воде и собирают весь пейзаж в единое целое.
                    </p>
                  </div>
                )}
                {name === 'Аудио' && <AudioExample />}
                {name === 'Видео' && (
                  <div className="media-note">
                    <Video size={32} />
                    <h4>История в движении</h4>
                    <p>
                      Здесь можно разместить видео: рассказ хранителя, процесс
                      реставрации или архивную съемку.
                    </p>
                    <span>Демонстрационный блок · видео не добавлено</span>
                  </div>
                )}
                {name === '3D / AR' && (
                  <div className="ar-demo">
                    <img
                      src={photo('exhibit-sculpture')}
                      alt="Античная скульптура в музейном зале"
                      loading="lazy"
                    />
                    <div>
                      <Box size={24} />
                      <strong>Рассмотреть со всех сторон</strong>
                      <p>
                        В этом блоке размещается 3D-модель экспоната для
                        интерактивного просмотра.
                      </p>
                      <small>
                        На демо показана фотография. 3D-модель не подключена.
                      </small>
                    </div>
                  </div>
                )}
                {name === 'Галерея' && (
                  <div className="gallery-demo">
                    {[
                      'exhibit-landscape',
                      'exhibit-sculpture',
                      'exhibit-vase',
                    ].map((image, index) => (
                      <figure key={image}>
                        <img
                          src={photo(image)}
                          alt={
                            [
                              'Картина в музейной раме',
                              'Мраморный бюст',
                              'Декоративная ваза в витрине',
                            ][index]
                          }
                          loading="lazy"
                        />
                        <figcaption>0{index + 1}</figcaption>
                      </figure>
                    ))}
                  </div>
                )}
                {name === 'Квиз' && <Quiz />}
                {name === 'Маршрут' && (
                  <ol className="route-demo">
                    {[
                      'Пейзаж с рекой',
                      'Античный портрет',
                      'Искусство в деталях',
                    ].map((stop, index) => (
                      <li key={stop}>
                        <span>0{index + 1}</span>
                        <div>
                          <strong>{stop}</strong>
                          <small>
                            {index + 1}-я остановка · Зал {index + 1}
                          </small>
                        </div>
                        <ChevronRight size={14} />
                      </li>
                    ))}
                  </ol>
                )}
              </TabsContent>
            ))}
            <div className="canvas-paragraph">
              <GripVertical size={17} />
              <p>
                Иногда, чтобы увидеть больше, достаточно остановиться и
                присмотреться.
              </p>
            </div>
          </div>
          <p className="editor-hint">
            Выберите тип блока слева и посмотрите, как меняется история{' '}
            <ArrowUpRight size={13} />
          </p>
        </div>
        <aside className="editor-properties">
          <p>НАСТРОЙКИ БЛОКА</p>
          <strong>{active}</strong>
          <div className="property-label">Оформление</div>
          <div className="property-value">По ширине контента</div>
          <div className="property-label">Подпись</div>
          <div className="property-value">Пейзаж с рекой</div>
          <div className="property-divider" />
          <span className="property-check">
            <Check size={13} />
            Адаптировано для телефона
          </span>
        </aside>
      </Tabs>
    </div>
  );
}
function LayersMark() {
  return (
    <div className="layers-mark" aria-hidden="true">
      <Box size={26} />
    </div>
  );
}
