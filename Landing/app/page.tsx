import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Box,
  QrCode,
  Layers3,
  Menu,
  X,
  ChevronDown,
  MapPin,
  FileText,
  UsersRound,
  Pencil,
  Link2,
  Check,
  Plus,
  Mail,
  Image as ImageIcon,
  Headphones,
  Route,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { photo } from '@/components/ProductMockup';
import { LeadForm } from '@/components/LeadForm';
import type { BillingPeriod } from '@/lib/leads';

const nav = [
  ['О продукте', 'product'],
  ['Возможности', 'features'],
  ['Как это работает', 'how-it-works'],
  ['Тарифы', 'pricing'],
  ['FAQ', 'faq'],
];
type ModalKind = 'demo' | 'story';
type OpenModal = (kind: ModalKind, title?: string) => void;
type Waitlist = (source: string, plan?: string) => void;
function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="section-label">
      <span />
      {children}
    </p>
  );
}
function Button({
  children,
  onClick,
  variant = '',
  className = '',
}: {
  children: ReactNode;
  onClick: () => void;
  variant?: string;
  className?: string;
}) {
  return (
    <button className={`button ${variant} ${className}`} onClick={onClick}>
      {children}
      <ArrowRight aria-hidden="true" />
    </button>
  );
}
function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const menuRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 20);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && menuOpen) {
        setMenuOpen(false);
        menuRef.current?.focus();
      }
    };
    const resize = () => {
      if (window.innerWidth > 900) setMenuOpen(false);
    };
    window.addEventListener('keydown', close);
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('keydown', close);
      window.removeEventListener('resize', resize);
    };
  }, [menuOpen]);
  return (
    <header className={`header ${scrolled ? 'is-scrolled' : ''}`}>
      <div className="container header-inner">
        <a href="#top" className="wordmark" aria-label="Витрина — начало">
          <img src={`${import.meta.env.BASE_URL}brand-mark.svg`} alt="" />
        </a>
        <nav
          id="main-navigation"
          className={menuOpen ? 'navigation is-open' : 'navigation'}
          aria-label="Основная навигация"
        >
          {nav.map(([label, id]) => (
            <a key={id} href={`#${id}`} onClick={() => setMenuOpen(false)}>
              {label}
            </a>
          ))}
        </nav>
        <a
          className="button header-cta"
          href="/methodist/"
        >
          Кабинет методиста
          <ArrowUpRight aria-hidden="true" size={16} />
        </a>
        <button
          ref={menuRef}
          className="menu-button"
          aria-label={menuOpen ? 'Закрыть меню' : 'Открыть меню'}
          aria-expanded={menuOpen}
          aria-controls="main-navigation"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? <X /> : <Menu />}
        </button>
      </div>
    </header>
  );
}
function Hero({ onWaitlist }: { onWaitlist: Waitlist }) {
  return (
    <section className="hero container" aria-labelledby="hero-heading">
      <div className="hero-copy">
        <SectionLabel>МУЗЕЙ БЛИЖЕ, ЧЕМ КАЖЕТСЯ</SectionLabel>
        <h1 id="hero-heading">
          <span className="hero-title-line">Создавайте</span>{' '}
          <span className="hero-title-line">музейные маршруты</span>{' '}
          <em className="hero-title-line">для телефона посетителя</em>
        </h1>
        <p className="hero-description">
          Подготовьте маршрут в кабинете методиста и опубликуйте его.
          Посетитель откроет историю музея по ссылке или QR-коду прямо
          в браузере — без установки приложения.
        </p>
        <div className="hero-actions">
          <Button onClick={() => onWaitlist('hero')}>Обсудить запуск</Button>
          <a className="video-button" href="/visitor/">
            Открыть панель посетителя
            <ArrowUpRight aria-hidden="true" size={18} />
          </a>
        </div>
      </div>
      <div className="hero-visual">
        <img
          className="hero-photo"
          src={photo('hero-museum')}
          alt="Античная статуя в светлом музейном зале и смартфон в руке посетителя"
          width={1536}
          height={1024}
          fetchPriority="high"
        />
        <div className="photo-index">
          <span>КУЛЬТУРА. В НОВОМ ФОРМАТЕ.</span>
          <span>ВИТРИНА</span>
        </div>
        <div className="floating-card">
          <span className="round-icon">
            <QrCode aria-hidden="true" size={20} />
          </span>
          <div>
            <small>Один QR-код</small>
            <strong>Целая история</strong>
          </div>
          <ArrowUpRight aria-hidden="true" size={18} />
        </div>
        <div className="route-card">
          <MapPin aria-hidden="true" size={18} />
          <span>
            Схема маршрута<strong>Экспонат → история → следующая точка</strong>
            <small>
              В браузере <ArrowRight aria-hidden="true" size={12} />
            </small>
          </span>
        </div>
      </div>
      <div className="hero-features">
        {[
          { icon: Box, label: 'Без разработки' },
          { icon: Layers3, label: 'Кабинет методиста' },
          { icon: QrCode, label: 'Ссылка или QR-код' },
          { icon: Route, label: 'Без установки приложения' },
        ].map(({ icon: Icon, label }) => (
          <span key={label}>
            <Icon aria-hidden="true" size={19} />
            {label}
          </span>
        ))}
      </div>
      <div className="hero-bottom">
        <span>Больше смысла. Ближе к посетителю.</span>
        <a href="#product" aria-label="Узнать о продукте">
          <ChevronDown size={18} />
        </a>
        <span>Музейный опыт начинается здесь</span>
      </div>
    </section>
  );
}
function FeatureCard({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
}) {
  return (
    <article className="feature-card">
      <Icon aria-hidden="true" size={25} />
      <h3>{title}</h3>
      <p>{children}</p>
    </article>
  );
}
function ProductValue() {
  return (
    <section id="product" className="section product-value">
      <div className="container value-layout reveal">
        <div className="section-copy">
          <SectionLabel>ОДИН ИНСТРУМЕНТ ДЛЯ МУЗЕЯ</SectionLabel>
          <h2>
            Музей создаёт маршрут.<br />
            Посетитель открывает <em>историю.</em>
          </h2>
        </div>
        <div className="value-grid">
          <FeatureCard icon={FileText} title="Подготовьте содержание">
            Соберите материалы и последовательность точек маршрута.
          </FeatureCard>
          <FeatureCard icon={QrCode} title="Опубликуйте маршрут">
            Поделитесь готовой историей по ссылке или QR-коду.
          </FeatureCard>
          <FeatureCard
            icon={Route}
            title="Откройте на телефоне"
          >
            Посетитель проходит маршрут в мобильном браузере.
          </FeatureCard>
          <FeatureCard icon={UsersRound} title="Сохраните свой голос">
            Содержание и авторский замысел остаются за командой музея.
          </FeatureCard>
        </div>
      </div>
    </section>
  );
}
const scenarios = [
  {
    icon: Box,
    title: 'Постоянная экспозиция',
    text: 'Объедините знакомые экспонаты в историю и предложите посетителю рассмотреть детали.',
  },
  {
    icon: Pencil,
    title: 'Временная выставка',
    text: 'Подготовьте маршрут к новой выставке и дополните встречу с экспозицией авторским рассказом.',
  },
  {
    icon: Link2,
    title: 'Тематический маршрут',
    text: 'Свяжите объекты одной эпохой, человеком или идеей и откройте новый взгляд на коллекцию.',
  },
];
function Scenarios() {
  return (
    <section className="section problems">
      <div className="container problem-layout reveal">
        <div className="section-copy">
          <SectionLabel>ДЛЯ ВАШИХ ИСТОРИЙ</SectionLabel>
          <h2>
            Один музей.<br />Разные поводы <em>вернуться.</em>
          </h2>
          <p>
            Выберите тему, которая важна вашему музею. Цифровой маршрут
            помогает выстроить последовательное знакомство с ней.
          </p>
        </div>
        <div className="problem-grid">
          {scenarios.map(({ icon: Icon, title, text }) => (
            <article key={title}>
              <span className="problem-icon">
                <Icon aria-hidden="true" size={23} />
              </span>
              <div>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
function EditorDemo({ open }: { open: OpenModal }) {
  return (
    <section id="features" className="section editor-section">
      <div className="container reveal">
        <div className="section-top">
          <div>
            <SectionLabel>ОТ ЗАМЫСЛА К ИСТОРИИ</SectionLabel>
            <h2>Создавайте цифровые истории</h2>
            <p>
              Методист или куратор собирает сценарий
              <br className="desktop-break" /> из готовых блоков в визуальном
              редакторе.
            </p>
          </div>
          <Button variant="outline-button" onClick={() => open('demo')}>
            Обсудить запуск
          </Button>
        </div>
        <div className="experience-panels">
          <article>
            <span className="experience-label">ДЛЯ КОМАНДЫ МУЗЕЯ</span>
            <h3>Кабинет методиста</h3>
            <p>Подготовьте точки маршрута, проверьте содержание и опубликуйте готовую версию.</p>
            <a className="text-link" href="/methodist/">Открыть кабинет <ArrowUpRight size={18} aria-hidden="true" /></a>
          </article>
          <article>
            <span className="experience-label">ДЛЯ ПОСЕТИТЕЛЯ</span>
            <h3>Панель посетителя</h3>
            <p>Браузерный интерфейс для знакомства с опубликованным музейным маршрутом.</p>
            <a className="text-link" href="/visitor/">Открыть панель <ArrowUpRight size={18} aria-hidden="true" /></a>
          </article>
        </div>
        <figure className="service-photo-wrap">
          <img
            className="service-photo"
            src={photo('service-in-museum')}
            alt="Посетитель музея открывает цифровую историю экспоната на смартфоне рядом с картиной и QR-кодом"
            width={1536}
            height={1024}
            loading="lazy"
          />
          <figcaption className="service-photo-caption">
            <span>
              <QrCode size={16} aria-hidden="true" />
              Один QR-код открывает историю экспоната
            </span>
            <span>Иллюстрация сценария использования</span>
          </figcaption>
        </figure>
        <div className="editor-caption service-caption">
          <span>Цифровая история появляется там, где посетитель встречает экспонат.</span>
          <span>Без отдельного приложения</span>
        </div>
      </div>
    </section>
  );
}
const steps = [
  { icon: FileText, title: 'Подготовьте', text: 'материалы и точки маршрута' },
  { icon: Route, title: 'Проверьте', text: 'как маршрут увидит посетитель' },
  { icon: QrCode, title: 'Опубликуйте', text: 'готовую версию маршрута' },
  {
    icon: UsersRound,
    title: 'Пригласите',
    text: 'посетителя по ссылке или QR-коду',
  },
];
function HowItWorks() {
  return (
    <section id="how-it-works" className="section how-section">
      <div className="container reveal">
        <div className="center-heading">
          <SectionLabel>ПРОСТОЙ ПУТЬ К НОВОМУ ОПЫТУ</SectionLabel>
          <h2>Как это работает?</h2>
          <p>От идеи до работающего маршрута — в одном понятном процессе.</p>
        </div>
        <div className="steps">
          {steps.map(({ icon: Icon, title, text }, i) => (
            <article className="step" key={title}>
              <div className="step-top">
                <span>0{i + 1}</span>
                <Icon aria-hidden="true" size={23} />
              </div>
              <div className="step-rule">
                <span />
              </div>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
const exhibits = [
  {
    image: 'exhibit-landscape',
    category: 'ЖИВОПИСЬ',
    title: 'Тишина у воды',
    description: 'Свет, который остается',
    icon: Headphones,
  },
  {
    image: 'exhibit-sculpture',
    category: 'СКУЛЬПТУРА',
    title: 'Античный портрет',
    description: 'Диалог через столетия',
    icon: QrCode,
  },
  {
    image: 'exhibit-vase',
    category: 'ДЕКОРАТИВНОЕ ИСКУССТВО',
    title: 'Искусство в деталях',
    description: 'Каждый узор — история',
    icon: Box,
  },
];
function ImageCard({ index, open }: { index: number; open: OpenModal }) {
  const { image, category, title, description, icon: Icon } = exhibits[index];
  return (
    <button
      className={`image-card image-card-${index}`}
      onClick={() => open('story')}
      aria-label={`Смотреть историю: ${title}`}
    >
      <div className="image-card-photo">
        <img
          src={photo(image)}
          alt={title}
          width={1024}
          height={1536}
          loading="lazy"
        />
        <span className="image-badge">
          <Icon size={17} aria-hidden="true" />
        </span>
      </div>
      <div className="image-card-copy">
        <span>{category}</span>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </button>
  );
}
function ExhibitStories({ open }: { open: OpenModal }) {
  return (
    <section id="stories" className="section story-section">
      <div className="container stories-layout reveal">
        <div className="section-copy">
          <SectionLabel>БОЛЬШЕ, ЧЕМ ЭТИКЕТКА</SectionLabel>
          <h2>
            Каждый экспонат
            <br />
            может иметь
            <br />
            <em>собственную историю</em>
          </h2>
          <p>
            Расскажите больше, покажите дополнительные материалы, добавьте
            интерактивное взаимодействие.
          </p>
          <button className="text-link" onClick={() => open('story')}>
            Смотреть пример
            <ArrowRight size={18} />
          </button>
        </div>
        <div className="image-stack">
          {exhibits.map((item, i) => (
            <ImageCard key={item.image} index={i} open={open} />
          ))}
        </div>
      </div>
    </section>
  );
}
const freeFeatures = [
  'До 10 экспонатов',
  'Базовые блоки контента',
  'Публикация по QR-коду',
  'Базовая аналитика',
];
const plusFeatures = [
  'Безлимит экспонатов',
  'Все типы контента',
  '3D и AR',
  'Публикация по QR',
  'Расширенная аналитика',
  'Командная работа',
];
const largeFeatures = [
  'Мультиплощадочный доступ',
  'Интеграции с вашими системами',
  'Расширенная аналитика',
  'Выделенная поддержка',
  'Обучение команды',
];
const monthlyMuseumPlusPrice = 9_990;
const annualMuseumPlusTotal = monthlyMuseumPlusPrice * 12 * 0.75;
const formatRubles = (value: number) =>
  `${new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value)} ₽`;
function PricingCard({
  title,
  description,
  price,
  note,
  features,
  popular = false,
  children,
}: {
  title: string;
  description: string;
  price: ReactNode;
  note: ReactNode;
  features: string[];
  popular?: boolean;
  children: ReactNode;
}) {
  return (
    <article className={`pricing-card ${popular ? 'popular-card' : ''}`}>
      {popular && (
        <span className="popular-badge">
          <Sparkles size={12} aria-hidden="true" />
          Популярный
        </span>
      )}
      <h3>{title}</h3>
      <p className="pricing-description">{description}</p>
      <div className="price">{price}</div>
      <p className="price-note">{note}</p>
      <ul>
        {features.map((item) => (
          <li key={item}>
            <Check aria-hidden="true" size={16} />
            {item}
          </li>
        ))}
      </ul>
      {children}
    </article>
  );
}
function Pricing({
  period,
  setPeriod,
  onWaitlist,
}: {
  period: BillingPeriod;
  setPeriod: (value: BillingPeriod) => void;
  onWaitlist: Waitlist;
}) {
  return (
    <section id="pricing" className="section pricing-section">
      <div className="container reveal">
        <div className="pricing-heading">
          <SectionLabel>ТАРИФЫ</SectionLabel>
          <h2>
            Выберите формат,
            <br />
            который подходит вашему музею
          </h2>
          <p>
            Все тарифы включают доступ к визуальному редактору,
            <br className="desktop-break" /> публикацию через QR-код и базовую
            аналитику.
          </p>
          <fieldset className="billing-toggle" aria-label="Период оплаты">
            <button
              aria-pressed={period === 'month'}
              onClick={() => setPeriod('month')}
            >
              Месяц
            </button>
            <button
              aria-pressed={period === 'year'}
              onClick={() => setPeriod('year')}
            >
              Год <span className="billing-discount">−25%</span>
            </button>
          </fieldset>
        </div>
        <div className="pricing-grid">
          <PricingCard
            title="Пробный"
            description="Для небольших проектов и тестирования."
            price={<>0 ₽</>}
            note="навсегда"
            features={freeFeatures}
          >
            <Button
              variant="outline-button"
              onClick={() => onWaitlist('pricing', 'trial')}
            >
              Обсудить тариф
            </Button>
          </PricingCard>
          <PricingCard
            title="Музей+"
            description="Для музеев и растущих проектов."
            price={
              <>
                <span>от </span>
                {formatRubles(
                  period === 'year'
                    ? annualMuseumPlusTotal / 12
                    : monthlyMuseumPlusPrice,
                )}
              </>
            }
            note={
              period === 'year' ? (
                <>
                  в месяц при оплате за год
                  <span className="pricing-year-total">
                    Итого: от {formatRubles(annualMuseumPlusTotal)} за 12 месяцев
                  </span>
                </>
              ) : (
                'в месяц при помесячной оплате'
              )
            }
            features={plusFeatures}
            popular
          >
            <Button
              variant="light-button"
              onClick={() => onWaitlist('pricing', 'museum-plus')}
            >
              Обсудить тариф
            </Button>
          </PricingCard>
          <PricingCard
            title="Большой музей"
            description="Для крупных институций и сетей музеев."
            price="Индивидуально"
            note="под задачи вашего музея"
            features={largeFeatures}
          >
            <a
              className="button outline-button"
              href="mailto:hello@vitrineapp.ru?subject=Витрина%20—%20Большой%20музей"
            >
              Связаться
              <ArrowRight aria-hidden="true" />
            </a>
          </PricingCard>
        </div>
      </div>
    </section>
  );
}
const faqs = [
  [
    'Что подготовить для первого маршрута?',
    'Выберите тему, составьте список точек и соберите материалы, которые раскрывают историю экспозиции. На встрече обсудим вашу задачу и подходящий первый маршрут.',
  ],
  [
    'Нужно ли приложение или специальное оборудование?',
    'Нет. Базовый маршрут открывается по ссылке или QR-коду в современном мобильном браузере. Устанавливать приложение и использовать AR или VR для его прохождения не требуется.',
  ],
  [
    'Нужны ли разработчики для работы с платформой?',
    'Нет. Методист или куратор собирает цифровую историю из готовых блоков в визуальном редакторе. Для публикации истории через QR-код не нужно разрабатывать отдельное приложение.',
  ],
  [
    'Можно ли использовать свои изображения, аудио и видео?',
    'Да. В истории можно добавлять собственные тексты, изображения, аудио и видео. Используйте материалы, на размещение которых у музея есть права.',
  ],
  [
    'Как публикуется контент для посетителей?',
    'Музей публикует историю или маршрут и размещает QR-код рядом с экспонатом. Посетитель сканирует его камерой смартфона и открывает контент в браузере.',
  ],
  [
    'Поддерживается ли 3D, AR и интерактивный контент?',
    'В платформе предусмотрены блоки 3D, AR, галерей и квизов. Доступность типов контента зависит от тарифа; 3D и AR входят в «Музей+». Подходящий сценарий можно обсудить на демо.',
  ],
  [
    'Можно ли работать командой?',
    'Да, командная работа предусмотрена в тарифе «Музей+». На демонстрации мы покажем, как организовать совместную работу над музейными историями.',
  ],
  [
    'Какие есть ограничения в пробном тарифе?',
    'Пробный тариф включает до 10 экспонатов, базовые блоки контента, публикацию по QR-коду и базовую аналитику. Стоимость — 0 ₽ навсегда.',
  ],
  [
    'Можно ли перенести уже существующий контент?',
    'Существующие тексты и медиаматериалы можно использовать при создании историй. Возможность автоматического переноса зависит от исходного формата — напишите нам, чтобы обсудить ваши материалы.',
  ],
  [
    'Как работает аналитика?',
    'Аналитика помогает понять, какие цифровые истории и маршруты используют посетители, и оценить интерес к контенту. Базовая аналитика входит во все тарифы, расширенная — в «Музей+» и «Большой музей».',
  ],
];
function FAQ() {
  const [expanded, setExpanded] = useState<string[]>([]);
  const all = expanded.length === faqs.length;
  return (
    <section id="faq" className="section faq-section">
      <div className="container faq-layout reveal">
        <div className="section-copy">
          <SectionLabel>FAQ</SectionLabel>
          <h2>Частые вопросы</h2>
          <p>
            Здесь мы собрали ответы на самые популярные вопросы. Если вы не
            нашли нужную информацию —{' '}
            <a href="mailto:hello@vitrineapp.ru">напишите нам.</a>
          </p>
          <Button
            variant="outline-button"
            onClick={() =>
              setExpanded(all ? [] : faqs.map((_, i) => String(i)))
            }
          >
            {all ? 'Свернуть ответы' : 'Все вопросы'}
          </Button>
        </div>
        <Accordion
          className="faq-list"
          multiple
          value={expanded}
          onValueChange={(next) => {
            const added = next.find((value) => !expanded.includes(value));
            setExpanded(added ? [added] : next);
          }}
        >
          {faqs.map(([question, answer], i) => (
            <AccordionItem
              value={String(i)}
              key={question}
              className="faq-item"
            >
              <AccordionTrigger className="faq-trigger">
                <span>{question}</span>
                <span className="faq-plus" aria-hidden="true">
                  <Plus size={16} />
                </span>
              </AccordionTrigger>
              <AccordionContent className="faq-answer">
                <p>{answer}</p>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
function FinalCTA({
  onWaitlist,
}: {
  onWaitlist: Waitlist;
}) {
  return (
    <section
      id="waitlist"
      className="final-cta"
      aria-labelledby="waitlist-heading"
    >
      <img
        className="cta-photo"
        src={photo('museum-cta')}
        alt="Большой музейный зал с арками и античной скульптурой в мягком дневном свете"
        width={2172}
        height={724}
        loading="lazy"
      />
      <div className="container cta-inner">
        <div className="cta-copy">
          <SectionLabel>СДЕЛАЕМ КУЛЬТУРУ ДОСТУПНЕЕ</SectionLabel>
          <h2 id="waitlist-heading">
            Какую историю<br />расскажет ваш музей?
          </h2>
          <p>
            Расскажите о музее, экспозиции и вашей задаче.
            Обсудим, с какого маршрута начать.
          </p>
          <Button onClick={() => onWaitlist('final-cta')}>Обсудить запуск</Button>
          <p className="cta-note">
            Или напишите нам: <a href="mailto:hello@vitrineapp.ru">hello@vitrineapp.ru</a>
          </p>
        </div>
        <div className="cta-side-note">
          ИСКУССТВО
          <br />
          ОБЪЕДИНЯЕТ
          <br />
          ЛЮДЕЙ
          <span />
        </div>
      </div>
    </section>
  );
}
function Footer({
  onWaitlist,
}: {
  onWaitlist: Waitlist;
}) {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <a className="wordmark" href="#top">
              <img src={`${import.meta.env.BASE_URL}brand-mark.svg`} alt="Витрина" />
            </a>
            <p>
              Платформа для создания и управления интерактивным опытом музеев.
            </p>
          </div>
          <div className="footer-column">
            <h3>Продукт</h3>
            <a href="#features">Возможности</a>
            <a href="#pricing">Тарифы</a>
            <a href="#stories">Примеры</a>
            <a href="#faq">FAQ</a>
          </div>
          <div className="footer-column">
            <h3>Начать работу</h3>
            <a href="/methodist/">Кабинет методиста</a>
            <a href="/visitor/">Панель посетителя</a>
            <a href="mailto:hello@vitrineapp.ru">Контакты</a>
          </div>
          <div className="footer-column">
            <h3>Документы</h3>
            <a
              href="./legal/politika-obrabotki-personalnyh-dannyh.html"
              target="_blank"
              rel="noreferrer"
            >
              Политика обработки персональных данных
            </a>
            <a
              href="./legal/soglasie-na-obrabotku-personalnyh-dannyh.html"
              target="_blank"
              rel="noreferrer"
            >
              Согласие на обработку персональных данных
            </a>
            <a
              href="./legal/soglasie-na-reklamnye-rassylki.html"
              target="_blank"
              rel="noreferrer"
            >
              Согласие на получение рекламных рассылок
            </a>
          </div>
          <div className="footer-contact">
            <Button onClick={() => onWaitlist('footer')}>Обсудить запуск</Button>
            <a href="mailto:hello@vitrineapp.ru">
              <Mail size={17} aria-hidden="true" />
              hello@vitrineapp.ru
            </a>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© Витрина, 2026</span>
          <span>
            С заботой о культуре <span className="small-rule" />
          </span>
        </div>
      </div>
    </footer>
  );
}
function StoryExample() {
  return (
    <Tabs defaultValue="exhibit-landscape" className="story-example">
      <TabsList className="story-tabs" aria-label="Истории экспонатов">
        {exhibits.map(({ image, category }) => (
          <TabsTrigger value={image} key={image}>
            {category === 'ДЕКОРАТИВНОЕ ИСКУССТВО'
              ? 'Детали'
              : category === 'ЖИВОПИСЬ'
                ? 'Живопись'
                : 'Скульптура'}
          </TabsTrigger>
        ))}
      </TabsList>
      {exhibits.map(({ image, title, description }, index) => (
        <TabsContent
          value={image}
          key={image}
          className="story-example-content"
        >
          <img src={photo(image)} alt={title} width={1024} height={1536} />
          <div>
            <span className="story-number">ИСТОРИЯ 0{index + 1}</span>
            <h3>{title}</h3>
            <p className="story-subtitle">{description}</p>
            <p>
              {
                [
                  'Проследите взглядом за рекой. Ее изгиб ведет в глубину картины, мимо деревьев и светлого берега. В этой тишине художник сохраняет мгновение, которое мы можем прожить заново.',
                  'Перед нами — мраморный портрет. Свет скользит по поверхности камня и делает строгие черты удивительно живыми. Присмотритесь к тому, как скульптор передает фактуру волос.',
                  'История вещи складывается из деталей: силуэта, узора, материала. Найдите повторяющийся мотив на поверхности вазы и проследите, как он меняется от основания к горлышку.',
                ][index]
              }
            </p>
            <div className="story-observation">
              <ImageIcon size={20} />
              <span>
                {
                  [
                    'Найдите на картине самый теплый оттенок. Как он меняет настроение пейзажа?',
                    'Посмотрите на лицо с разных сторон. Что меняется вместе со светом?',
                    'Какая деталь первой привлекла ваше внимание?',
                  ][index]
                }
              </span>
            </div>
            <p className="sample-disclaimer">
              Демонстрационная история. Изображение создано для примера.
            </p>
          </div>
        </TabsContent>
      ))}
    </Tabs>
  );
}
export default function App() {
  const [modal, setModal] = useState<ModalKind>('demo');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [period, setPeriod] = useState<BillingPeriod>('month');
  const [leadContext, setLeadContext] = useState<{
    source: string;
    plan?: string;
  }>({ source: 'final-cta' });
  const trigger = useRef<HTMLElement | null>(null);
  const open: OpenModal = (kind) => {
    if (!isModalOpen) trigger.current = document.activeElement as HTMLElement;
    if (kind === 'demo') setLeadContext({ source: 'demo-modal' });
    setModal(kind);
    setIsModalOpen(true);
  };
  const waitlist: Waitlist = (source, plan) => {
    if (!isModalOpen) trigger.current = document.activeElement as HTMLElement;
    setLeadContext({ source, plan });
    setModal('demo');
    setIsModalOpen(true);
  };
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
      },
      { threshold: 0.08 },
    );
    document
      .querySelectorAll('.reveal')
      .forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);
  return (
    <>
      <div id="top" />
      <a className="skip-link" href="#main">
        К содержанию
      </a>
      <Header />
      <main id="main">
        <Hero onWaitlist={waitlist} />
        <ProductValue />
        <Scenarios />
        <EditorDemo open={open} />
        <HowItWorks />
        <ExhibitStories open={open} />
        <Pricing period={period} setPeriod={setPeriod} onWaitlist={waitlist} />
        <FAQ />
        <FinalCTA onWaitlist={waitlist} />
      </main>
      <Footer onWaitlist={waitlist} />
      <Dialog
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
      >
        <DialogContent
          className={`vitrina-dialog ${modal === 'story' ? 'wide-dialog' : ''}`}
          showCloseButton={false}
          finalFocus={trigger}
        >
          <DialogClose className="dialog-close" aria-label="Закрыть окно">
            <X size={21} />
          </DialogClose>
          <SectionLabel>
            {modal === 'demo'
              ? 'ПОЗНАКОМИМСЯ БЛИЖЕ'
              : modal === 'story'
                ? 'ВЗГЛЯД ПОСЕТИТЕЛЯ'
                : 'ВИТРИНА'}
          </SectionLabel>
          <DialogTitle className="dialog-heading">
            {modal === 'demo'
              ? 'Записаться на демо'
              : 'У каждого экспоната — история'}
          </DialogTitle>
          <DialogDescription className="dialog-description">
            {modal === 'demo'
              ? 'Оставьте контакты. Покажем, как Витрина может работать в вашем музее.'
              : 'Демонстрационный пример содержания. Так дополнительные материалы помогают посетителю увидеть больше.'}
          </DialogDescription>
          {modal === 'demo' && <LeadForm intent="demo" source={leadContext.source} plan={leadContext.plan} billingPeriod={leadContext.plan ? period : undefined} />}
          {modal === 'story' && <StoryExample />}
        </DialogContent>
      </Dialog>
    </>
  );
}
